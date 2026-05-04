// ---------------------------------------------------------------------------
// whistleRunReceiptModule — Directive module for the WHISTLE receipt
// ---------------------------------------------------------------------------
//
// Holds the live state of a single WHISTLE submission. Output shape
// is fundamentally different from the verify programs:
//   - Top-level `submission status` (accepted / failed)
//   - Redaction summary (what scrubbers fired, what survived)
//   - Routing delivery status (per-partner: pending / delivered / refused)
//   - Ephemeral signing-key fingerprint (NOT the operator's stable key —
//     WHISTLE rotates per-submission for anonymity)
//
// Verdicts (canonical, anchored on /bureau/whistle landing):
//   - accepted          — bundle parsed, redaction passed, routed to
//                          partner endpoint, Rekor anchor emitted
//   - held-redaction    — secret-scrub OR k-anonymity floor OR
//                          stylometric refusal triggered; the bundle
//                          is HELD (not failed) — operator addresses
//                          the flagged signal and resubmits. No Rekor
//                          entry, no partner delivery, but the
//                          submission is not terminal.
//   - routing-failed    — partner endpoint rejected (e.g. partner's
//                          quota exceeded, schema mismatch). Terminal.
//   - bundle-malformed  — JSON / schema invalid. Terminal.
//   - not-found         — HTTPS 404 / no bundle at the URL. Terminal.
//   - fetch-failed      — non-200, redirect, oversize, timeout, non-https.
//                          Terminal.
//
// Layered redaction = TRIPWIRE secret-scrub + k-anonymity floor +
// stylometric refusal (per the landing's "layered redaction" line).
// Each layer reports independently so the operator (and the receipt
// reader) can audit the chain.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "submission pending"
  | "redacting"
  | "routing"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "accepted"
  | "held-redaction"
  | "routing-failed"
  | "bundle-malformed"
  | "not-found"
  | "fetch-failed";

export type DeliveryStatus = "pending" | "delivered" | "refused";

export interface RoutingDelivery {
  partner: string; // RoutingPartner slug
  status: DeliveryStatus;
  /** Partner-side acknowledgement ID, when delivered. */
  partnerAck?: string | null;
  /** Why refused, when refused (partner-supplied or local). */
  refusalReason?: string | null;
}

export interface RedactionLayer {
  /** "secret-scrub" / "k-anonymity-floor" / "stylometric-refusal" */
  layer: string;
  /** True when the layer let the bundle through. */
  passed: boolean;
  /** Patterns / signals the layer matched, if any. */
  signals: ReadonlyArray<string>;
}

/** WHISTLE spec predicateType (canonical, surfaced on the receipt). */
export const WHISTLE_PREDICATE_URI =
  "https://pluck.run/WhistleSubmission/v1";

/** Bureau cassette wire prefix (shared across programs). */
export const CASSETTE_HASH_PREFIX = "local:";

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

export const whistleRunReceiptModule = createModule("whistle-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      category: t.string().nullable(),
      // NB: bundle source URL is INTENTIONALLY not on the receipt
      // — receipt URLs are publicly addressable, and the bundle's
      // origin is the operator's secret. Only the bundle hash
      // (post-redaction) is published.
      bundleHash: t.string().nullable(),
      redactionLayers: t.array<RedactionLayer>().nullable(),
      routingDeliveries: t.array<RoutingDelivery>().nullable(),
      // Ephemeral key SPKI fingerprint — rotates per-submission for
      // anonymity. NOT the operator's stable key.
      ephemeralSignerFingerprint: t.string().nullable(),
      submittedAt: t.string().nullable(),
      rekorUuid: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isAccepted: t.boolean(),
      isHeld: t.boolean(),
      isFailure: t.boolean(),
      verdictColor: t.string<"gray" | "amber" | "red" | "green">(),
      redactionTriggered: t.boolean(),
      anyDelivered: t.boolean(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "submission pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.category = null;
    facts.bundleHash = null;
    facts.redactionLayers = null;
    facts.routingDeliveries = null;
    facts.ephemeralSignerFingerprint = null;
    facts.submittedAt = null;
    facts.rekorUuid = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "submission pending" ||
      facts.status === "redacting" ||
      facts.status === "routing" ||
      facts.status === "anchoring",
    isAccepted: (facts) =>
      facts.status === "anchored" && facts.verdict === "accepted",
    /**
     * `held-redaction` is fixable (operator addresses signal +
     * resubmits) — distinguished from terminal failures so the UI
     * can show a different next-action surface.
     */
    isHeld: (facts) => facts.verdict === "held-redaction",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null &&
        facts.verdict !== "accepted" &&
        facts.verdict !== "held-redaction"),
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "gray";
      }
      if (facts.verdict === "accepted") {
        return "green";
      }
      // `held-redaction` is amber — the operator can fix and retry.
      // Other named verdicts are red — terminal.
      if (facts.verdict === "held-redaction") {
        return "amber";
      }
      return "red";
    },
    redactionTriggered: (facts) =>
      facts.redactionLayers !== null &&
      facts.redactionLayers.some((l) => !l.passed),
    anyDelivered: (facts) =>
      facts.routingDeliveries !== null &&
      facts.routingDeliveries.some((d) => d.status === "delivered"),
  },
});
