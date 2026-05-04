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
// Verification verdicts (canonical):
//   - verified           — DSSE signature valid, Origin matches body's
//                          `vendor`, content-type correct, within TTL
//   - signature-failed   — DSSE envelope did not verify
//   - origin-mismatch    — body.vendor !== fetch URL's hostname
//   - expired            — body.expiresAt < now (sealed-claim semantics)
//   - not-found          — 404 / no oath served
//   - fetch-failed       — non-200, redirect, > 256 KiB, > 10s, etc.
//
// The full taxonomy lives at /bureau/oath landing → "Sealed-claim
// semantics" + "Operator flow" sections.
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
  | "expired"
  | "not-found"
  | "fetch-failed";

export interface OathClaim {
  id: string;
  text: string;
  expiresAt: string; // ISO 8601
}

export const oathRunReceiptModule = createModule("oath-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      vendorDomain: t.string().nullable(),
      expectedOrigin: t.string().nullable(),
      signerFingerprint: t.string().nullable(),
      claimsCount: t.number().nullable(),
      claims: t.array<OathClaim>().nullable(),
      expiresAt: t.string().nullable(),
      receiptUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isVerified: t.boolean(),
      isFailure: t.boolean(),
      isExpired: t.boolean(),
      verdictColor: t.string<"red" | "amber" | "green">(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "verification pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.vendorDomain = null;
    facts.expectedOrigin = null;
    facts.signerFingerprint = null;
    facts.claimsCount = null;
    facts.claims = null;
    facts.expiresAt = null;
    facts.receiptUrl = null;
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
    isExpired: (facts) => facts.verdict === "expired",
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "amber";
      }
      if (facts.verdict === "verified") {
        return "green";
      }
      if (facts.verdict === "expired") {
        return "amber";
      }
      return "red";
    },
  },
});
