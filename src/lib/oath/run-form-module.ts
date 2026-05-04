// ---------------------------------------------------------------------------
// oathRunFormModule — Directive module for the OATH verify-fetch form
// ---------------------------------------------------------------------------
//
// OATH's flow is fundamentally different from DRAGNET's:
//   - DRAGNET *executes* a probe-pack against a target endpoint.
//   - OATH *fetches* a vendor's `/.well-known/pluck-oath.json` and
//     verifies the DSSE envelope's signature + Origin claim. No
//     probe-pack, no cadence (it's a one-shot read-and-verify).
//
// Form shape:
//   - vendorDomain: bare hostname ("openai.com") — Studio derives the
//     full URL `https://<domain>/.well-known/pluck-oath.json` server-side.
//   - expectedOrigin: optional override; defaults to `https://<domain>`.
//     Used as the `--expected-origin` parameter on `pluck bureau oath
//     verify` so we cross-check the served Origin against the body's
//     `vendor` field.
//   - authorizationAcknowledged: required, same legal posture as DRAGNET.
//
// This is the second program wired through the Studio activation
// pattern. Per the v1 plan: "Wire OATH same way to prove
// generalizability." If OATH activates cleanly using the shared
// `bureau-ui/forms` primitives + sibling Directive module, the
// remaining 9 alpha programs can follow the same shape.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

export const oathRunFormModule = createModule("oath-run-form", {
  schema: {
    facts: {
      vendorDomain: t.string(),
      expectedOrigin: t.string(),
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
      effectiveExpectedOrigin: t.string(),
    },
  },

  init: (facts) => {
    facts.vendorDomain = "";
    facts.expectedOrigin = "";
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
      if (!facts.vendorDomain.trim()) {
        return false;
      }
      if (!facts.authorizationAcknowledged) {
        return false;
      }
      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
    effectiveExpectedOrigin: (facts) => {
      const explicit = facts.expectedOrigin.trim();
      if (explicit.length > 0) {
        return explicit;
      }
      const domain = facts.vendorDomain.trim().toLowerCase();
      if (domain.length === 0) {
        return "";
      }
      return `https://${domain}`;
    },
  },
});
