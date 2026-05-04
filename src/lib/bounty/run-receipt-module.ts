// ---------------------------------------------------------------------------
// bountyRunReceiptModule — Directive module for the BOUNTY receipt
// ---------------------------------------------------------------------------
//
// Holds the live state of a single BOUNTY filing. Two predicate URIs
// involved (matches the landing's "Predicate URIs" section):
//   - https://pluck.run/EvidencePacket/v1 — subpoena-quality body
//   - https://pluck.run/BountySubmission/v1 — post-submission record
//
// Verdicts:
//   - filed                — packet built, dispatched to platform,
//                             platform returned a submission ID,
//                             local Rekor anchor emitted
//   - rate-limited         — local pre-flight refused (>= local cap)
//   - platform-rejected    — platform returned 4xx (program closed,
//                             duplicate, out-of-scope, etc)
//   - source-not-found     — sourceRekorUuid didn't resolve
//   - source-malformed     — fetched source body wasn't a recognised
//                             EvidencePacket-compatible predicate
//   - dispatch-failed      — network / 5xx / timeout calling platform
//
// Auth tokens NEVER appear on the receipt. Adapter strips Bearer
// strings from upstream error responses before they reach this module.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "filing pending"
  | "assembling-packet"
  | "dispatching"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "filed"
  | "rate-limited"
  | "platform-rejected"
  | "source-not-found"
  | "source-malformed"
  | "dispatch-failed";

/** BOUNTY's two canonical predicates per the landing page. */
export const EVIDENCE_PACKET_PREDICATE_URI =
  "https://pluck.run/EvidencePacket/v1";

export const BOUNTY_SUBMISSION_PREDICATE_URI =
  "https://pluck.run/BountySubmission/v1";

export const SPKI_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export const bountyRunReceiptModule = createModule("bounty-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      target: t.string().nullable(), // platform slug
      program: t.string().nullable(),
      vendor: t.string().nullable(),
      model: t.string().nullable(),
      sourceRekorUuid: t.string().nullable(),
      // Platform-side ID returned on `filed`. Studio doesn't generate
      // it; the platform owns the namespace.
      platformSubmissionId: t.string().nullable(),
      bountyAmount: t.number().nullable(), // USD, when claimed
      submittedAt: t.string().nullable(),
      signerFingerprint: t.string().nullable(),
      packetUrl: t.string().nullable(),
      submissionUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isFiled: t.boolean(),
      isFailure: t.boolean(),
      verdictColor: t.string<"gray" | "red" | "amber" | "green">(),
      programDossierUrl: t.string().nullable(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "filing pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.target = null;
    facts.program = null;
    facts.vendor = null;
    facts.model = null;
    facts.sourceRekorUuid = null;
    facts.platformSubmissionId = null;
    facts.bountyAmount = null;
    facts.submittedAt = null;
    facts.signerFingerprint = null;
    facts.packetUrl = null;
    facts.submissionUrl = null;
    facts.rekorUuid = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "filing pending" ||
      facts.status === "assembling-packet" ||
      facts.status === "dispatching" ||
      facts.status === "anchoring",
    isFiled: (facts) =>
      facts.status === "anchored" && facts.verdict === "filed",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "filed"),
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "gray";
      }
      if (facts.verdict === "filed") {
        return "green";
      }
      // `rate-limited` is a transient amber — operator can resubmit
      // after the window. Other failures are red (terminal).
      if (facts.verdict === "rate-limited") {
        return "amber";
      }
      return "red";
    },
    programDossierUrl: (facts) => {
      if (facts.vendor === null || facts.model === null) {
        return null;
      }
      // Re-uses the FINGERPRINT timeline route per landing convention.
      return `/bureau/fingerprint/${facts.vendor}/${facts.model}`;
    },
  },
});
