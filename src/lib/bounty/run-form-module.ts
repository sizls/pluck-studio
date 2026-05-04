// ---------------------------------------------------------------------------
// bountyRunFormModule — Directive module for the BOUNTY file form
// ---------------------------------------------------------------------------
//
// Phase 6 program — autonomous bounty filer. Wraps an existing
// DRAGNET / FINGERPRINT / MOLE Rekor anchor into an EvidencePacket
// and dispatches to a bounty platform (HackerOne or Bugcrowd).
//
// Form shape:
//   - sourceRekorUuid: UUID of the source evidence (red dot / delta /
//     verdict). Studio will fetch its body to assemble the packet.
//   - target: "hackerone" | "bugcrowd"
//   - program: vendor slug for the platform-specific program (e.g.
//     "openai" for hackerone.com/openai). Free-form short slug.
//   - vendor + model: canonical Bureau identifiers for the affected
//     vendor/model pair, included in the EvidencePacket body so
//     readers don't have to parse the rekor uuid to learn the target.
//   - ToS-ack: required.
//
// Auth-token deliberately NOT in the form. The CLI takes
// `--auth-env H1_TOKEN`; Studio's hosted mode reads the operator's
// stored platform credentials at dispatch time. Tokens never enter
// the form body or the receipt — same posture as the CLI.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

export type Target = "hackerone" | "bugcrowd";

export const TARGET_LABELS: Readonly<Record<Target, string>> = Object.freeze({
  hackerone: "HackerOne (600 / hr local rate limit)",
  bugcrowd: "Bugcrowd (300 / hr local rate limit)",
});

const REKOR_UUID_PATTERN = /^[0-9a-f]{64,80}$/i;

export function isValidRekorUuid(s: string): boolean {
  return REKOR_UUID_PATTERN.test(s);
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function isValidProgramSlug(s: string): boolean {
  return SLUG_PATTERN.test(s) && s.length <= 64;
}

export const bountyRunFormModule = createModule("bounty-run-form", {
  schema: {
    facts: {
      sourceRekorUuid: t.string(),
      target: t.string<Target>(),
      program: t.string(),
      vendor: t.string(),
      model: t.string(),
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
    },
  },

  init: (facts) => {
    facts.sourceRekorUuid = "";
    facts.target = "hackerone";
    facts.program = "";
    facts.vendor = "";
    facts.model = "";
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
      if (
        !facts.sourceRekorUuid.trim() ||
        !facts.program.trim() ||
        !facts.vendor.trim() ||
        !facts.model.trim()
      ) {
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
