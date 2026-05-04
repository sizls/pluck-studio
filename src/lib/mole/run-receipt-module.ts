// ---------------------------------------------------------------------------
// moleRunReceiptModule — Directive module for MOLE seal receipt
// ---------------------------------------------------------------------------
//
// Receipt = the canary seal. Per landing's posture: canary BODY never
// enters the public log; only sha256 + fingerprint phrases. Receipt
// must reproduce that posture — the receipt URL is publicly
// addressable, so the body must NEVER appear in the receipt module
// schema.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "seal pending"
  | "fetching-canary"
  | "hashing"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "sealed"
  | "canary-too-short"
  | "fingerprints-not-found"
  | "duplicate-canary"
  | "fetch-failed";

/** MOLE's two predicates per landing. */
export const CANARY_DOCUMENT_PREDICATE_URI =
  "https://pluck.run/CanaryDocument/v1";

export const MEMORIZATION_VERDICT_PREDICATE_URI =
  "https://pluck.run/MemorizationVerdict/v1";

export const CASSETTE_HASH_PREFIX = "local:";

export function formatCassetteHash(raw: string): string {
  if (raw.length === 0) return raw;
  if (raw.startsWith(CASSETTE_HASH_PREFIX)) return raw;
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return `${CASSETTE_HASH_PREFIX}${raw.toLowerCase()}`;
  }
  return raw;
}

export const moleRunReceiptModule = createModule("mole-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      canaryId: t.string().nullable(),
      // Sha256 of the canary body — public, since the body never
      // enters the log. Operator holds raw text locally.
      canarySha256: t.string().nullable(),
      // Length in characters of the canary body; surfaced because
      // canaries that are too short (< threshold) won't memorize
      // uniquely against any large model.
      canaryByteLength: t.number().nullable(),
      // The fingerprint phrases enter the public canary manifest;
      // surfaced on the receipt.
      fingerprintPhrases: t.array<string>().nullable(),
      // NB: canary BODY is INTENTIONALLY NOT a fact — the receipt
      // URL is publicly addressable, and per landing the body must
      // stay with the operator for the journalist conversation.
      signerFingerprint: t.string().nullable(),
      manifestUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
      sealedAt: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isSealed: t.boolean(),
      isFailure: t.boolean(),
      verdictColor: t.string<"gray" | "red" | "green">(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "seal pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.canaryId = null;
    facts.canarySha256 = null;
    facts.canaryByteLength = null;
    facts.fingerprintPhrases = null;
    facts.signerFingerprint = null;
    facts.manifestUrl = null;
    facts.rekorUuid = null;
    facts.sealedAt = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "seal pending" ||
      facts.status === "fetching-canary" ||
      facts.status === "hashing" ||
      facts.status === "anchoring",
    isSealed: (facts) =>
      facts.status === "anchored" && facts.verdict === "sealed",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "sealed"),
    // MOLE seal is binary — sealed or rejected. No amber state; a
    // canary that's too short or has wrong fingerprints isn't
    // partially-sealed, it's not sealed.
    verdictColor: (facts) => {
      if (facts.verdict === null) return "gray";
      if (facts.verdict === "sealed") return "green";
      return "red";
    },
  },
});
