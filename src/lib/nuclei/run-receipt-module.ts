// ---------------------------------------------------------------------------
// nucleiRunReceiptModule — Directive module for NUCLEI receipt
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "publish pending"
  | "verifying-sbom"
  | "signing"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "published"
  | "sbom-not-found"
  | "sbom-mismatch"
  | "pack-already-published"
  | "malformed-vendor-scope"
  | "license-not-allowed";

/**
 * Trust tier — published with verified SBOM-AI cross-ref = "verified",
 * published without = "ingested" (consumers refuse to honor). Per
 * landing's "trust model — registry ingest is TOFU" section.
 */
export type TrustTier = "verified" | "ingested";

/** NUCLEI's three predicates. */
export const NUCLEI_PACK_ENTRY_PREDICATE_URI =
  "https://pluck.run/NucleiPackEntry/v1";

export const BOUNTY_OFFER_PREDICATE_URI =
  "https://pluck.run/BountyOffer/v1";

export const BOUNTY_CLAIM_PREDICATE_URI =
  "https://pluck.run/BountyClaim/v1";

export const nucleiRunReceiptModule = createModule("nuclei-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      author: t.string().nullable(),
      packName: t.string().nullable(),
      sbomRekorUuid: t.string().nullable(),
      vendorScope: t.array<string>().nullable(),
      license: t.string().nullable(),
      recommendedInterval: t.string().nullable(),
      trustTier: t.string<TrustTier>().nullable(),
      packEntryUrl: t.string().nullable(),
      signerFingerprint: t.string().nullable(),
      rekorUuid: t.string().nullable(),
      publishedAt: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isPublished: t.boolean(),
      isFailure: t.boolean(),
      isVerifiedTier: t.boolean(),
      verdictColor: t.string<"gray" | "red" | "amber" | "green">(),
      packDossierUrl: t.string().nullable(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "publish pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.author = null;
    facts.packName = null;
    facts.sbomRekorUuid = null;
    facts.vendorScope = null;
    facts.license = null;
    facts.recommendedInterval = null;
    facts.trustTier = null;
    facts.packEntryUrl = null;
    facts.signerFingerprint = null;
    facts.rekorUuid = null;
    facts.publishedAt = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "publish pending" ||
      facts.status === "verifying-sbom" ||
      facts.status === "signing" ||
      facts.status === "anchoring",
    isPublished: (facts) =>
      facts.status === "anchored" && facts.verdict === "published",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "published"),
    isVerifiedTier: (facts) => facts.trustTier === "verified",
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "gray";
      }
      if (facts.verdict === "published") {
        // Published-but-ingested = amber (consumers refuse to honor).
        // Published-and-verified = green.
        if (facts.trustTier === "ingested") {
          return "amber";
        }
        return "green";
      }
      return "red";
    },
    packDossierUrl: (facts) => {
      if (facts.author === null || facts.packName === null) {
        return null;
      }
      // packName is "<slug>@<version>"; the existing dossier route at
      // /bureau/nuclei/[author]/[pack] takes the bare slug, NOT the
      // versioned form, so strip the @<version>.
      const bareSlug = facts.packName.split("@")[0];
      return `/bureau/nuclei/${facts.author}/${bareSlug}`;
    },
  },
});
