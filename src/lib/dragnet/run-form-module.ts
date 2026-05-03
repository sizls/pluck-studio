// ---------------------------------------------------------------------------
// dragnetRunFormModule — Directive module for the DRAGNET activation form
// ---------------------------------------------------------------------------
//
// Replaces the day-1 stub's 5×useState pattern. Form state lives in
// Directive facts; user-facing booleans (canSubmit, hasError, etc.)
// are auto-tracked derivations off those facts. Submit, redirect, and
// auth-fail handling are imperative effects fired from useFact /
// useDerived consumers — not buried in the component file.
//
// This is the architectural seed Studio's other forms (recipe creator,
// feed builder, monitor scheduler) will compose against. Day-1 commits
// it small but intentional: every Directive primitive Studio needs has
// a use here (facts, derivations, types) so future forms only add
// fields, not paradigms.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type Cadence = "once" | "continuous";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

export const dragnetRunFormModule = createModule("dragnet-run-form", {
  schema: {
    facts: {
      targetUrl: t.string(),
      probePackId: t.string(),
      cadence: t.string<Cadence>(),
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
    facts.targetUrl = "";
    facts.probePackId = "canon-honesty";
    facts.cadence = "once";
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
      if (!facts.targetUrl.trim() || !facts.probePackId.trim()) {
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
