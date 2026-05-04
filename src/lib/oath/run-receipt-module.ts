// ---------------------------------------------------------------------------
// oathRunReceiptModule — Directive module backing the OATH receipt page
// ---------------------------------------------------------------------------
//
// Holds the live state of an OATH verification cycle. Output shape is
// fundamentally different from DRAGNET's:
//
//   - DRAGNET: cycles emit per-probe TimelineDots + classification counts
//   - OATH: a single fetch+verify produces a verdict and a structured
//     `oath body` (the vendor's commitments, claim by claim).
//
// Verification verdicts (canonical wire form, anchored on the
// /bureau/oath landing page):
//   - verified         — DSSE signature valid, hosting Origin matches
//                         body's `vendor`, content-type correct,
//                         envelope itself within TTL
//   - signature-failed — DSSE envelope did not verify
//   - origin-mismatch  — body.vendor !== fetch URL's hostname
//   - oath-expired     — at least one claim is past `expiresAt`
//                         (sealed-claim semantics — see landing page)
//   - did-not-commit   — vendor has no oath at all (per landing
//                         page's "did not commit" badge)
//   - not-found        — HTTP 404 specifically (vendor expected one;
//                         distinct from `did-not-commit`)
//   - fetch-failed     — non-200, redirect, > 256 KiB, > 10s, etc.
//
// `did-not-commit` is the social-pressure verdict. `not-found` is the
// "operator expected this vendor to publish; they didn't" mistake. The
// distinction matters for the badge on the public leaderboard.
//
// Per-claim verdicts: `OathClaim.verdict` carries `active` |
// `oath-expired` so the UI can render an envelope-OK + claim-stale state
// (top-level verdict = `verified`, individual claims = mixed). Top-level
// `verdict` reflects the envelope+origin+TTL rollup; per-claim is in
// the claims array.
//
// TODO: extend OathClaim with `claimType`, `evidenceUrls`,
// `signingContext` when /v1/oath/verify ships and the wire format firms.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "verification pending"
  | "fetching"
  | "verifying"
  | "anchored"
  | "failed";

export type Verdict =
  | "verified"
  | "signature-failed"
  | "origin-mismatch"
  | "oath-expired"
  | "did-not-commit"
  | "not-found"
  | "fetch-failed";

/** Canonical fetch-failure detail strings (sub-buckets of `fetch-failed`). */
export type FetchFailureDetail =
  | "oversized"
  | "timeout"
  | "redirect-attempted"
  | "non-https"
  | "network-error";

export type ClaimVerdict = "active" | "oath-expired";

export interface OathClaim {
  id: string;
  text: string;
  expiresAt: string; // ISO 8601
  verdict: ClaimVerdict;
}

/** OATH spec predicateType (canonical, surfaced in the receipt UI). */
export const OATH_PREDICATE_URI = "https://pluck.run/PluckOath/v1";

/** Bureau R1 convention: 64-char hex SPKI fingerprint. */
export const SPKI_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

export const oathRunReceiptModule = createModule("oath-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      vendorDomain: t.string().nullable(),
      // Where the oath envelope was fetched from. Distinct from
      // `body.vendor` (the vendor's self-declared identity, which
      // verify cross-checks against this hosting Origin).
      hostingOrigin: t.string().nullable(),
      signerFingerprint: t.string().nullable(),
      claimsCount: t.number().nullable(),
      claims: t.array<OathClaim>().nullable(),
      expiresAt: t.string().nullable(),
      receiptUrl: t.string().nullable(),
      oathEnvelopeUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isVerified: t.boolean(),
      isFailure: t.boolean(),
      isOathExpired: t.boolean(),
      hasStaleClaim: t.boolean(),
      verdictColor: t.string<"red" | "amber" | "green">(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "verification pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.vendorDomain = null;
    facts.hostingOrigin = null;
    facts.signerFingerprint = null;
    facts.claimsCount = null;
    facts.claims = null;
    facts.expiresAt = null;
    facts.receiptUrl = null;
    facts.oathEnvelopeUrl = null;
    facts.rekorUuid = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "verification pending" ||
      facts.status === "fetching" ||
      facts.status === "verifying",
    isVerified: (facts) =>
      facts.status === "anchored" && facts.verdict === "verified",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "verified"),
    isOathExpired: (facts) => facts.verdict === "oath-expired",
    hasStaleClaim: (facts) =>
      facts.claims !== null &&
      facts.claims.some((c) => c.verdict === "oath-expired"),
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "amber";
      }
      if (facts.verdict === "verified") {
        return "green";
      }
      // Sealed-claim + did-not-commit are non-failure amber states.
      // "did-not-commit" is the social-pressure badge, not a hard error.
      if (
        facts.verdict === "oath-expired" ||
        facts.verdict === "did-not-commit"
      ) {
        return "amber";
      }
      return "red";
    },
  },
});
