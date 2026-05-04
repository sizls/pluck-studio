// ---------------------------------------------------------------------------
// rotateRunReceiptModule — Directive module for the ROTATE receipt
// ---------------------------------------------------------------------------
//
// Holds the live state of a single ROTATE rotation. Two artifacts get
// emitted per rotation:
//   - KeyRevocation/v1: signed by the OLD key, marks it revoked
//   - one-or-many ReWitnessReport/v1: signed by the NEW key, annotates
//     prior cassettes signed by the old key with the compromise window
//
// Verdicts (canonical):
//   - rotated                 — KeyRevocation anchored + re-witness
//                                annotations queued for all prior
//                                cassettes signed by old key
//   - old-key-not-found       — old SPKI doesn't match any prior
//                                Bureau signer the operator owns
//   - new-key-already-active  — new SPKI is in use elsewhere; pick a
//                                fresh key and resubmit
//   - old-key-already-revoked — old key was already revoked in a
//                                prior rotation
//   - signature-failed        — old-key signature didn't verify (i.e.
//                                operator can't prove ownership)
//   - dispatch-failed         — couldn't anchor to Rekor
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "rotation pending"
  | "revoking"
  | "re-witnessing"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "rotated"
  | "old-key-not-found"
  | "new-key-already-active"
  | "old-key-already-revoked"
  | "signature-failed"
  | "dispatch-failed";

/** ROTATE's three predicate URIs per landing. */
export const KEY_REVOCATION_PREDICATE_URI =
  "https://pluck.run/KeyRevocation/v1";

export const RE_WITNESS_REPORT_PREDICATE_URI =
  "https://pluck.run/ReWitnessReport/v1";

export const KEY_FREEZE_PREDICATE_URI = "https://pluck.run/KeyFreeze/v1";

export const SPKI_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export const rotateRunReceiptModule = createModule("rotate-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      oldKeyFingerprint: t.string().nullable(),
      newKeyFingerprint: t.string().nullable(),
      reason: t.string().nullable(),
      operatorNote: t.string().nullable(),
      // Number of prior cassettes annotated by the re-witness pass.
      // Surfaced so operators (and any downstream verifier) can see
      // the blast radius at a glance.
      reWitnessedCassetteCount: t.number().nullable(),
      revocationUrl: t.string().nullable(),
      reWitnessReportUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
      rotatedAt: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isRotated: t.boolean(),
      isFailure: t.boolean(),
      verdictColor: t.string<"gray" | "red" | "amber" | "green">(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "rotation pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.oldKeyFingerprint = null;
    facts.newKeyFingerprint = null;
    facts.reason = null;
    facts.operatorNote = null;
    facts.reWitnessedCassetteCount = null;
    facts.revocationUrl = null;
    facts.reWitnessReportUrl = null;
    facts.rekorUuid = null;
    facts.rotatedAt = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "rotation pending" ||
      facts.status === "revoking" ||
      facts.status === "re-witnessing" ||
      facts.status === "anchoring",
    isRotated: (facts) =>
      facts.status === "anchored" && facts.verdict === "rotated",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "rotated"),
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "gray";
      }
      if (facts.verdict === "rotated") {
        return "green";
      }
      // `old-key-already-revoked` is amber: not a failure but not a
      // success — operator is trying to revoke something already
      // revoked, which is harmless idempotency.
      if (facts.verdict === "old-key-already-revoked") {
        return "amber";
      }
      return "red";
    },
  },
});
