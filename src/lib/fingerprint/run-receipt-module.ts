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

export interface ProbeResponse {
  probeId: string;
  prompt: string;
  responseText: string;
  tokens?: number | null;
}

/** FINGERPRINT spec predicateType (canonical, surfaced in receipt UI). */
export const FINGERPRINT_PREDICATE_URI =
  "https://pluck.run/ModelFingerprint/v1";

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
        fingerprintHash: t.string().nullable(),
        priorFingerprintHash: t.string().nullable(),
        probeCount: t.number().nullable(),
        probes: t.array<ProbeResponse>().nullable(),
        signerFingerprint: t.string().nullable(),
        cassetteUrl: t.string().nullable(),
        rekorUuid: t.string().nullable(),
        scannedAt: t.string().nullable(),
      },
      derivations: {
        isPending: t.boolean(),
        isAnchored: t.boolean(),
        isSwap: t.boolean(),
        classificationColor: t.string<"red" | "amber" | "green">(),
        targetDossierUrl: t.string().nullable(),
      },
    },

    init: (facts) => {
      facts.id = "";
      facts.status = "scan pending";
      facts.vendor = null;
      facts.model = null;
      facts.classification = null;
      facts.fingerprintHash = null;
      facts.priorFingerprintHash = null;
      facts.probeCount = null;
      facts.probes = null;
      facts.signerFingerprint = null;
      facts.cassetteUrl = null;
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
      classificationColor: (facts) => {
        if (facts.classification === null) {
          return "amber";
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
