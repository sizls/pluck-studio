// ---------------------------------------------------------------------------
// tripwireRunFormModule — Directive module for TRIPWIRE configuration
// ---------------------------------------------------------------------------
//
// First *configuration* program through the activation pattern.
// TRIPWIRE is a continuous JS-layer interceptor — one-shot
// "execution" doesn't fit. Studio's activation IS the configuration:
// operator picks a machine identifier + policy, Studio issues a
// signed TripwirePolicy/v1, returns the install snippet + ingestion
// endpoint URL. Each receipt represents one active tripwire
// deployment.
//
// Form shape:
//   - machineId: short slug naming the dev machine (e.g.
//     "alice-mbp", "ci-runner-3"). Used as the phrase prefix so each
//     machine's installation has its own permanent receipt URL.
//   - policySource: "default" (use Studio's bundled allowlist) or
//     "custom" (fetch operator-supplied policy URL)
//   - customPolicyUrl: required when policySource === "custom"
//   - notarize: whether non-green cassettes auto-publish to Rekor
//   - ToS-ack required
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

export type PolicySource = "default" | "custom";

export const POLICY_SOURCE_LABELS: Readonly<Record<PolicySource, string>> =
  Object.freeze({
    default:
      "Default allowlist (OpenAI, Anthropic, Google AI, OpenRouter, Ollama)",
    custom: "Custom policy (HTTPS-only public URL)",
  });

const MACHINE_ID_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

export function isValidMachineId(s: string): boolean {
  return MACHINE_ID_PATTERN.test(s) && s.length <= 48;
}

export const tripwireRunFormModule = createModule("tripwire-run-form", {
  schema: {
    facts: {
      machineId: t.string(),
      policySource: t.string<PolicySource>(),
      customPolicyUrl: t.string(),
      notarize: t.boolean(),
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
      requiresPolicyUrl: t.boolean(),
    },
  },

  init: (facts) => {
    facts.machineId = "";
    facts.policySource = "default";
    facts.customPolicyUrl = "";
    facts.notarize = false;
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
      if (!isValidMachineId(facts.machineId.trim().toLowerCase())) {
        return false;
      }
      if (facts.policySource === "custom") {
        const url = facts.customPolicyUrl.trim();
        if (url.length === 0) {
          return false;
        }
        // Soft URL check — server enforces HTTPS-only + private-IP
        // block, but client guards an obviously-bad shape early.
        if (!/^https:\/\//i.test(url)) {
          return false;
        }
      }
      if (!facts.authorizationAcknowledged) {
        return false;
      }
      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
    requiresPolicyUrl: (facts) => facts.policySource === "custom",
  },
});
