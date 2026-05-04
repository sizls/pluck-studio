// ---------------------------------------------------------------------------
// fingerprintRunReceiptModule — Directive module backing the FINGERPRINT receipt
// ---------------------------------------------------------------------------
//
// Holds the live state of a single FINGERPRINT scan. Output shape is
// fundamentally different from both DRAGNET and OATH:
//
//   - DRAGNET: classification counts (contradict/mirror/shadow/snare)
//   - OATH: a single binary verdict (verified or named failure)
//   - FINGERPRINT: a *delta classification* relative to a prior scan
//     of the same target, plus the raw fingerprint hash + per-probe
//     responses
//
// Classifications (canonical, anchored on the /bureau/fingerprint
// landing page):
//   - stable  — fingerprint matches the previous scan within tolerance
//   - minor   — measurable drift but not load-bearing (e.g. small
//                temperature/sampling change)
//   - major   — significant capability shift (vendor probably swapped
//                a quantization, fine-tune, or system prompt)
//   - swap    — fingerprint hash diverges entirely; vendor swapped
//                the underlying model without telling anyone
//
// The whole point of FINGERPRINT is `swap` detection: a vendor
// silently changing the model behind a stable model-name is the
// load-bearing dishonesty signal. Receipt UI surfaces this as a red
// dot when classification === "swap".
//
// Wire formats (two distinct predicates):
//   - `https://pluck.run/ModelFingerprint/v1` — cassette envelope (one
//     scan, with probe responses + hash). Emitted on every scan.
//   - `https://pluck.run/FingerprintDelta/v1` — delta envelope (two
//     scans, with per-probe diff + classification). Emitted by
//     `pluck bureau fingerprint delta from.json to.json`.
//
// A receipt with `classification` set is a delta receipt — surfaces
// both URIs; a receipt without `priorFingerprintHash` is the first
// scan of a target and only renders the cassette URI.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "scan pending"
  | "calibrating"
  | "scanning"
  | "anchoring"
  | "anchored"
  | "failed";

export type Classification = "stable" | "minor" | "major" | "swap";

/**
 * Hosted-mode transport identifiers — disclosed on the receipt so
 * operators can audit the call path. Each transport corresponds to
 * a different responder shape under the hood.
 */
export type Transport =
  | "openai-direct"
  | "anthropic-direct"
  | "openrouter"
  | "ollama-local";

export interface ProbeResponse {
  probeId: string;
  prompt: string;
  responseText: string;
  tokens?: number | null;
}

/**
 * Bureau cassette wire spec — `local:<sha256-hex>` is the canonical
 * local-cassette address per the FINGERPRINT landing page. The receipt
 * always renders hashes through `formatCassetteHash` so the prefix is
 * never silently dropped.
 */
export const CASSETTE_HASH_PREFIX = "local:";

/**
 * Canonicalize a raw 64-hex-char SHA-256 into the Bureau wire form
 * `local:<sha256>`. Idempotent: passing already-prefixed input is
 * returned unchanged. Returns the raw input on a malformed hash so
 * the receipt UI doesn't drop debug info.
 */
export function formatCassetteHash(raw: string): string {
  if (raw.length === 0) {
    return raw;
  }
  if (raw.startsWith(CASSETTE_HASH_PREFIX)) {
    return raw;
  }
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return `${CASSETTE_HASH_PREFIX}${raw.toLowerCase()}`;
  }
  return raw;
}

/** Canonical drift-classification thresholds, surfaced on the receipt. */
export const CLASSIFICATION_THRESHOLDS: Readonly<
  Record<Classification, string>
> = Object.freeze({
  stable: "drift score ≤ 0.02 across all 5 probes (within sampling noise)",
  minor: "drift score 0.02–0.10 (measurable but bounded; routine)",
  major: "drift score 0.10–0.50 (capability shift; investigate)",
  swap: "drift score > 0.50 OR fingerprint hash diverges entirely (vendor swapped the model)",
});

export const FINGERPRINT_PREDICATE_URI =
  "https://pluck.run/ModelFingerprint/v1";

export const FINGERPRINT_DELTA_PREDICATE_URI =
  "https://pluck.run/FingerprintDelta/v1";

/** Bureau R1 convention: 64-char hex SPKI fingerprint. */
export const SPKI_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export const fingerprintRunReceiptModule = createModule(
  "fingerprint-run-receipt",
  {
    schema: {
      facts: {
        id: t.string(),
        status: t.string<ReceiptStatus>(),
        vendor: t.string().nullable(),
        model: t.string().nullable(),
        classification: t.string<Classification>().nullable(),
        // Numeric drift score (0.0 to 1.0+). Anchors `classification`
        // to a verifiable measurement; `null` until scan completes.
        driftScore: t.number().nullable(),
        fingerprintHash: t.string().nullable(),
        priorFingerprintHash: t.string().nullable(),
        probeCount: t.number().nullable(),
        // The probe-set version pins WHICH 5 probes were used — two
        // scans against the same model with different probe-set
        // versions are not directly comparable.
        probeSetVersion: t.string().nullable(),
        probes: t.array<ProbeResponse>().nullable(),
        // Hosted-mode transport identifier — see Transport union.
        transport: t.string<Transport>().nullable(),
        signerFingerprint: t.string().nullable(),
        cassetteUrl: t.string().nullable(),
        deltaUrl: t.string().nullable(),
        rekorUuid: t.string().nullable(),
        scannedAt: t.string().nullable(),
      },
      derivations: {
        isPending: t.boolean(),
        isAnchored: t.boolean(),
        isSwap: t.boolean(),
        hasDelta: t.boolean(),
        classificationColor: t.string<"gray" | "red" | "amber" | "green">(),
        targetDossierUrl: t.string().nullable(),
      },
    },

    init: (facts) => {
      facts.id = "";
      facts.status = "scan pending";
      facts.vendor = null;
      facts.model = null;
      facts.classification = null;
      facts.driftScore = null;
      facts.fingerprintHash = null;
      facts.priorFingerprintHash = null;
      facts.probeCount = null;
      facts.probeSetVersion = null;
      facts.probes = null;
      facts.transport = null;
      facts.signerFingerprint = null;
      facts.cassetteUrl = null;
      facts.deltaUrl = null;
      facts.rekorUuid = null;
      facts.scannedAt = null;
    },

    derive: {
      isPending: (facts) =>
        facts.status === "scan pending" ||
        facts.status === "calibrating" ||
        facts.status === "scanning" ||
        facts.status === "anchoring",
      isAnchored: (facts) => facts.status === "anchored",
      isSwap: (facts) => facts.classification === "swap",
      hasDelta: (facts) => facts.priorFingerprintHash !== null,
      classificationColor: (facts) => {
        if (facts.classification === null) {
          // Distinguishes "no scan yet" from "minor drift" (also amber).
          // gray = unknown; render with neutral hue.
          return "gray";
        }
        if (facts.classification === "stable") {
          return "green";
        }
        if (facts.classification === "minor") {
          return "amber";
        }
        // major + swap both red — vendor changed something material.
        return "red";
      },
      targetDossierUrl: (facts) => {
        if (facts.vendor === null || facts.model === null) {
          return null;
        }
        return `/bureau/fingerprint/${facts.vendor}/${facts.model}`;
      },
    },
  },
);
