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

/**
 * OSI-approved licenses + CC0 (public-domain dedication for sample-data
 * packs). CC-BY-4.0 is intentionally excluded — it's a Creative Commons
 * content license, not a software license; FSF + OSI flag CC-BY for
 * software bodies as inappropriate.
 */
export const ALLOWED_LICENSES: ReadonlyArray<string> = [
  "MIT",
  "Apache-2.0",
  "BSD-3-Clause",
  "BSD-2-Clause",
  "ISC",
  "MPL-2.0",
  "GPL-3.0-only",
  "AGPL-3.0-only",
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

// ---------------------------------------------------------------------------
// Cron grammar — 5-field validator for `recommendedInterval`
// ---------------------------------------------------------------------------
//
// Fields (in order):
//   minute        0-59
//   hour          0-23
//   day-of-month  1-31
//   month         1-12
//   day-of-week   0-7  (0 and 7 both = Sun)
//
// Each field is one of: `*`, integer, list (`a,b,c`), range (`a-b`),
// step (`*/n` or `a-b/n`), or a comma-list combining the above.
// Whitespace between fields is one-or-more spaces or tabs; leading /
// trailing whitespace on the whole expression is rejected.
//
// Additionally accepts the standard Vixie/ISC `@`-macros — these are
// honored by every real-world cron daemon (Vixie cron, ISC cron,
// Cloudflare Workers cron, GitHub Actions cron) and every Node lib
// (`cron-parser`, `croner`, `node-cron`). Probe-pack authors using
// `@daily` via the CLI would otherwise round-trip-fail at our submit
// boundary. Macros are case-sensitive (per POSIX). `@reboot` is
// intentionally rejected — runtime-relative, doesn't make sense for
// a registry-published interval.
const CRON_MACRO_PATTERN =
  /^@(yearly|annually|monthly|weekly|daily|midnight|hourly)$/;

interface CronFieldBounds {
  readonly min: number;
  readonly max: number;
}

const CRON_FIELD_BOUNDS: ReadonlyArray<CronFieldBounds> = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day-of-month
  { min: 1, max: 12 }, // month
  { min: 0, max: 7 }, // day-of-week (0 + 7 = Sun)
];

function isValidCronInteger(token: string, bounds: CronFieldBounds): boolean {
  if (!/^\d+$/.test(token)) {
    return false;
  }
  const n = Number.parseInt(token, 10);

  return n >= bounds.min && n <= bounds.max;
}

function isValidCronAtom(atom: string, bounds: CronFieldBounds): boolean {
  // Handle step: <range-or-star>/<positive-int>
  const slashIdx = atom.indexOf("/");
  if (slashIdx !== -1) {
    const head = atom.slice(0, slashIdx);
    const step = atom.slice(slashIdx + 1);
    if (!/^\d+$/.test(step)) {
      return false;
    }
    const stepN = Number.parseInt(step, 10);
    if (stepN <= 0) {
      return false;
    }
    if (head === "*") {
      return true;
    }
    // Range or single int as the head of a step is allowed.
    return isValidCronAtom(head, bounds);
  }

  if (atom === "*") {
    return true;
  }

  // Range: a-b
  const dashIdx = atom.indexOf("-");
  if (dashIdx !== -1) {
    const a = atom.slice(0, dashIdx);
    const b = atom.slice(dashIdx + 1);
    if (!isValidCronInteger(a, bounds) || !isValidCronInteger(b, bounds)) {
      return false;
    }

    return Number.parseInt(a, 10) <= Number.parseInt(b, 10);
  }

  return isValidCronInteger(atom, bounds);
}

function isValidCronField(field: string, bounds: CronFieldBounds): boolean {
  if (field.length === 0) {
    return false;
  }
  // Comma-list of atoms; an empty atom (",,") is invalid.
  const atoms = field.split(",");
  for (const atom of atoms) {
    if (atom.length === 0) {
      return false;
    }
    if (!isValidCronAtom(atom, bounds)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a 5-field cron expression. Tight grammar: rejects 6-field
 * (seconds), trailing whitespace, and out-of-range values.
 */
export function validateCron(s: string): boolean {
  if (typeof s !== "string") {
    return false;
  }
  // Reject leading/trailing whitespace explicitly — operators paste
  // values from chat; trailing spaces silently breaking schedules is
  // worse than a hard fail at submit time.
  if (s !== s.trim() || s.length === 0) {
    return false;
  }
  // Accept standard `@`-macros before falling through to 5-field grammar.
  // Case-sensitive — that's the POSIX/Vixie standard.
  if (CRON_MACRO_PATTERN.test(s)) {
    return true;
  }
  const fields = s.split(/[\t ]+/);
  if (fields.length !== CRON_FIELD_BOUNDS.length) {
    return false;
  }
  for (let i = 0; i < fields.length; i += 1) {
    const field = fields[i];
    const bounds = CRON_FIELD_BOUNDS[i];
    if (field === undefined || bounds === undefined) {
      return false;
    }
    if (!isValidCronField(field, bounds)) {
      return false;
    }
  }

  return true;
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
      parsedVendorScope: t.object<{
        pairs: ReadonlyArray<string>;
        invalid: ReadonlyArray<string>;
      }>(),
      recommendedIntervalIsValid: t.boolean(),
      sbomRekorUuidIsValid: t.boolean(),
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
    // Base derivation: parse once, reused by vendorScopeCount,
    // vendorScopeIsValid, and canSubmit. Auto-tracking would otherwise
    // re-run parseVendorScope() three times per keystroke.
    parsedVendorScope: (facts) => parseVendorScope(facts.vendorScope),
    vendorScopeCount: (facts, derived) => derived.parsedVendorScope.pairs.length,
    vendorScopeIsValid: (facts, derived) => {
      const { pairs, invalid } = derived.parsedVendorScope;

      return invalid.length === 0 && pairs.length > 0;
    },
    recommendedIntervalIsValid: (facts) =>
      validateCron(facts.recommendedInterval),
    sbomRekorUuidIsValid: (facts) =>
      isValidRekorUuid(facts.sbomRekorUuid.trim()),
    canSubmit: (facts, derived) => {
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
      if (!derived.vendorScopeIsValid) {
        return false;
      }
      if (!isAllowedLicense(facts.license.trim())) {
        return false;
      }
      if (!derived.recommendedIntervalIsValid) {
        return false;
      }
      if (!facts.authorizationAcknowledged) {
        return false;
      }

      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
  },
});
