// ---------------------------------------------------------------------------
// nucleiRunFormModule — Directive module for NUCLEI publish form
// ---------------------------------------------------------------------------
//
// Authors publish probe-packs to the NUCLEI registry. Per the
// landing's trust-model section: every NucleiPackEntry/v1 MUST
// cross-reference an SBOM-AI Rekor uuid for the same pack. Without
// that cross-reference, the pack lands at trustTier: "ingested" and
// consumers refuse to honor it. The form enforces the cross-ref —
// no SBOM-AI uuid means rejection.
//
// Form shape:
//   - author: slug ("alice", "openai-eng", ...)
//   - packName: slug + version ("canon-honesty@0.1", "alignment-probe@1.0")
//   - sbomRekorUuid: required UUID of the SBOM-AI provenance entry
//   - vendorScope: comma-separated vendor/model pairs
//   - license: SPDX identifier (curated list)
//   - recommendedInterval: cron expression (free-form, validated)
//   - ToS-ack
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

/** OSI-approved licenses we accept on registry entries. */
export const ALLOWED_LICENSES: ReadonlyArray<string> = [
  "MIT",
  "Apache-2.0",
  "BSD-3-Clause",
  "BSD-2-Clause",
  "ISC",
  "MPL-2.0",
  "GPL-3.0-only",
  "AGPL-3.0-only",
  "CC-BY-4.0",
  "CC0-1.0",
];

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const PACK_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?@[a-zA-Z0-9._+-]+$/;
const REKOR_UUID_PATTERN = /^[0-9a-f]{64,80}$/i;

export function isValidAuthor(s: string): boolean {
  return SLUG_PATTERN.test(s) && s.length <= 32;
}

export function isValidPackName(s: string): boolean {
  return PACK_NAME_PATTERN.test(s) && s.length <= 96;
}

export function isValidRekorUuid(s: string): boolean {
  return REKOR_UUID_PATTERN.test(s);
}

const VENDOR_SCOPE_ITEM = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?\/[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

/** "openai/gpt-4o,anthropic/claude-3-5-sonnet" → array of valid pairs. */
export function parseVendorScope(s: string): {
  pairs: ReadonlyArray<string>;
  invalid: ReadonlyArray<string>;
} {
  const items = s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter((x) => x.length > 0);
  const pairs: string[] = [];
  const invalid: string[] = [];
  for (const item of items) {
    if (VENDOR_SCOPE_ITEM.test(item)) {
      pairs.push(item);
    } else {
      invalid.push(item);
    }
  }
  return { pairs, invalid };
}

export function isAllowedLicense(s: string): boolean {
  return ALLOWED_LICENSES.includes(s);
}

export const nucleiRunFormModule = createModule("nuclei-run-form", {
  schema: {
    facts: {
      author: t.string(),
      packName: t.string(),
      sbomRekorUuid: t.string(),
      vendorScope: t.string(),
      license: t.string(),
      recommendedInterval: t.string(),
      authorizationAcknowledged: t.boolean(),
      submitStatus: t.string<SubmitStatus>(),
      errorMessage: t.string().nullable(),
      signInUrl: t.string().nullable(),
      lastResult: t.object<SubmitResult>().nullable(),
    },
    derivations: {
      isSubmitting: t.boolean(),
      canSubmit: t.boolean(),
      hasError: t.boolean(),
      needsSignIn: t.boolean(),
      vendorScopeIsValid: t.boolean(),
      vendorScopeCount: t.number(),
    },
  },

  init: (facts) => {
    facts.author = "";
    facts.packName = "";
    facts.sbomRekorUuid = "";
    facts.vendorScope = "";
    facts.license = "MIT";
    facts.recommendedInterval = "0 */4 * * *"; // every 4 hours
    facts.authorizationAcknowledged = false;
    facts.submitStatus = "idle";
    facts.errorMessage = null;
    facts.signInUrl = null;
    facts.lastResult = null;
  },

  derive: {
    isSubmitting: (facts) => facts.submitStatus === "submitting",
    canSubmit: (facts) => {
      if (facts.submitStatus === "submitting") {
        return false;
      }
      if (!isValidAuthor(facts.author.trim().toLowerCase())) {
        return false;
      }
      if (!isValidPackName(facts.packName.trim())) {
        return false;
      }
      if (!isValidRekorUuid(facts.sbomRekorUuid.trim())) {
        return false;
      }
      const { pairs, invalid } = parseVendorScope(facts.vendorScope);
      if (pairs.length === 0 || invalid.length > 0) {
        return false;
      }
      if (!isAllowedLicense(facts.license.trim())) {
        return false;
      }
      if (!facts.authorizationAcknowledged) {
        return false;
      }
      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
    vendorScopeIsValid: (facts) => {
      const { pairs, invalid } = parseVendorScope(facts.vendorScope);
      return invalid.length === 0 && pairs.length > 0;
    },
    vendorScopeCount: (facts) => parseVendorScope(facts.vendorScope).pairs.length,
  },
});
