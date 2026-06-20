// ---------------------------------------------------------------------------
// watchFormModule — Directive module for the Watch creation form
// ---------------------------------------------------------------------------
//
// Mirrors dragnet-run-form-module pattern. Form state lives in Directive
// facts; canSubmit / hasError / needsSignIn are derivations. Submit,
// redirect, and auth-fail handling are imperative effects fired from
// useFact / useDerived consumers in the client component.
//
// One module per Studio form was the lesson learned from DRAGNET — fields
// are local to the form; cross-form reasoning (if any) lives in a separate
// module the system composes against.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

import type {
  AlertChannels,
  AutonomyMode,
  FetcherKind,
} from "../v1/watch-spec";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  /** The newly-created watch's phrase-id (also the receipt URL slug). */
  readonly watchId: string;
  readonly receiptUrl: string;
}

export const watchFormModule = createModule("watch-form", {
  schema: {
    facts: {
      name: t.string(),
      url: t.string(),
      cron: t.string(),
      intent: t.string(),
      fetcherKind: t.string<FetcherKind>(),
      autonomyMode: t.string<AutonomyMode>(),
      alertChannels: t.object<AlertChannels>(),
      confidenceThreshold: t.number(),
      diffThreshold: t.number(),
      dailyBudgetUsd: t.number(),
      useVisionDefault: t.boolean(),
      // Submit lifecycle
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
      anyChannelEnabled: t.boolean(),
    },
  },

  init: (facts) => {
    facts.name = "";
    facts.url = "";
    facts.cron = "@daily";
    facts.intent = "";
    facts.fetcherKind = "playwright";
    facts.autonomyMode = "diff-gated";
    facts.alertChannels = {
      dashboard: true,
      email: [],
      webhook: [],
      slack: [],
      phraseId: true,
    };
    facts.confidenceThreshold = 0.75;
    facts.diffThreshold = 0.02;
    facts.dailyBudgetUsd = 2.0;
    facts.useVisionDefault = false;
    facts.submitStatus = "idle";
    facts.errorMessage = null;
    facts.signInUrl = null;
    facts.lastResult = null;
  },

  derive: {
    isSubmitting: (facts) => facts.submitStatus === "submitting",
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
    anyChannelEnabled: (facts) => {
      const c = facts.alertChannels;
      if (c.dashboard || c.phraseId) {
        return true;
      }
      if (c.email.length > 0 || c.webhook.length > 0 || c.slack.length > 0) {
        return true;
      }

      return false;
    },
    canSubmit: (facts, derived) => {
      if (facts.submitStatus === "submitting") {
        return false;
      }
      if (facts.name.trim().length === 0) {
        return false;
      }
      if (facts.url.trim().length === 0) {
        return false;
      }
      if (facts.cron.trim().length === 0) {
        return false;
      }
      if (facts.intent.trim().length < 20) {
        return false;
      }
      if (!derived.anyChannelEnabled) {
        return false;
      }

      return true;
    },
  },
});
