// ---------------------------------------------------------------------------
// moleRunFormModule — Directive module for MOLE seal-a-canary form
// ---------------------------------------------------------------------------
//
// MOLE is a two-step program (seal → probe) but Studio's activation
// surfaces the *seal* operation — the load-bearing crypto-graphic
// claim. Per landing's "Sealing comes BEFORE probing" callout: the
// canary commit is signed + notarized before any probe touches the
// vendor; the Rekor timestamp predates every probe-run record.
//
// Form shape:
//   - canaryId: short slug identifying the canary (e.g.
//     "nyt-2024-01-15", "pii-leak-test-1")
//   - canaryUrl: HTTPS URL of the canary content (Studio fetches +
//     hashes; the body itself is NEVER published, only sha256)
//   - fingerprintPhrases: comma-separated short phrases the operator
//     wants tracked; these appear in the public canary manifest, the
//     full body does not
//   - ToS-ack: required (with explicit canary-content-stays-private
//     posture)
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

const CANARY_ID_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
// Fingerprint phrases must be short + concrete enough to memorize but
// not so long they're effectively the whole canary. Per MOLE practice:
// 10–80 chars, ≤ 7 phrases per canary.
const FP_MIN_LENGTH = 10;
const FP_MAX_LENGTH = 80;
const FP_MAX_COUNT = 7;

export function isValidCanaryId(s: string): boolean {
  return CANARY_ID_PATTERN.test(s) && s.length <= 48;
}

/**
 * Parses a comma-separated list of fingerprint phrases. Returns the
 * cleaned list + a list of phrases that fell outside the length bounds.
 * Empty entries are silently dropped.
 */
export function parseFingerprintPhrases(s: string): {
  phrases: ReadonlyArray<string>;
  outOfBounds: ReadonlyArray<string>;
} {
  const items = s
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  const phrases: string[] = [];
  const outOfBounds: string[] = [];
  for (const item of items) {
    if (item.length < FP_MIN_LENGTH || item.length > FP_MAX_LENGTH) {
      outOfBounds.push(item);
    } else {
      phrases.push(item);
    }
  }
  return { phrases, outOfBounds };
}

export const moleRunFormModule = createModule("mole-run-form", {
  schema: {
    facts: {
      canaryId: t.string(),
      canaryUrl: t.string(),
      fingerprintPhrases: t.string(),
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
      fingerprintCount: t.number(),
      fingerprintsValid: t.boolean(),
      parsedFingerprints: t.object<{
        phrases: ReadonlyArray<string>;
        outOfBounds: ReadonlyArray<string>;
      }>(),
    },
  },

  init: (facts) => {
    facts.canaryId = "";
    facts.canaryUrl = "";
    facts.fingerprintPhrases = "";
    facts.authorizationAcknowledged = false;
    facts.submitStatus = "idle";
    facts.errorMessage = null;
    facts.signInUrl = null;
    facts.lastResult = null;
  },

  derive: {
    isSubmitting: (facts) => facts.submitStatus === "submitting",
    // Base derivation: parse once, reused by fingerprintCount,
    // fingerprintsValid, and canSubmit. Auto-tracking would otherwise
    // re-run parseFingerprintPhrases() three times per keystroke.
    parsedFingerprints: (facts) =>
      parseFingerprintPhrases(facts.fingerprintPhrases),
    fingerprintCount: (facts, derived) =>
      derived.parsedFingerprints.phrases.length,
    fingerprintsValid: (facts, derived) => {
      const { phrases, outOfBounds } = derived.parsedFingerprints;

      return (
        outOfBounds.length === 0 &&
        phrases.length > 0 &&
        phrases.length <= FP_MAX_COUNT
      );
    },
    canSubmit: (facts, derived) => {
      if (facts.submitStatus === "submitting") {
        return false;
      }
      if (!isValidCanaryId(facts.canaryId.trim().toLowerCase())) {
        return false;
      }
      const url = facts.canaryUrl.trim();
      if (!url || !/^https:\/\//i.test(url)) {
        return false;
      }
      if (!derived.fingerprintsValid) {
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

export const FINGERPRINT_BOUNDS = {
  MIN_LENGTH: FP_MIN_LENGTH,
  MAX_LENGTH: FP_MAX_LENGTH,
  MAX_COUNT: FP_MAX_COUNT,
} as const;
