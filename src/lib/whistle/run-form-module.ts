// ---------------------------------------------------------------------------
// whistleRunFormModule — Directive module for the WHISTLE submit form
// ---------------------------------------------------------------------------
//
// First *capture* program through the Studio activation pattern.
// DRAGNET / OATH / FINGERPRINT / CUSTODY all VERIFY a remote artifact;
// WHISTLE CAPTURES — the operator IS the source. The receipt proves
// the submission was logged + routed; it doesn't verify the truth of
// the tip.
//
// V2-A scope (intentionally narrow):
//   - Single routing partner (radio); multi-select = follow-on
//   - URL-fetched bundle only; pasted JSON = follow-on
//   - Single optional manual-redact phrase
//
// The CLI's full surface (`pluck bureau whistle submit ./bundle.json
// --routing "propublica,bellingcat" --manual-redact "phrase"`) shrinks
// to a one-target activation here. Operators with multi-target needs
// run the CLI; Studio's job is the 60-second hosted submit.
//
// Anonymity caveat is non-negotiable per the landing-page CalloutStyle:
// best-effort, NOT absolute. The form surfaces the caveat above the
// submit button so operators can't miss it.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

/**
 * Submission categories — anchored on the /bureau/whistle landing's
 * CLI examples (`--category training-data | policy-violation |
 * safety-incident`).
 */
export type Category = "training-data" | "policy-violation" | "safety-incident";

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = Object.freeze(
  {
    "training-data": "Training-data leak (model trained on data it shouldn't be)",
    "policy-violation": "Policy violation (vendor breaking its own rules)",
    "safety-incident": "Safety incident (model causing real-world harm)",
  },
);

/**
 * Newsroom routing partners. Anchored on the /bureau/whistle landing's
 * "ProPublica / Bellingcat / 404Media / EFF Press" list. EFF Press is
 * the legal-aid + amplification path for non-newsroom-routable tips.
 */
export type RoutingPartner =
  | "propublica"
  | "bellingcat"
  | "404media"
  | "eff-press";

export const ROUTING_PARTNER_LABELS: Readonly<Record<RoutingPartner, string>> =
  Object.freeze({
    propublica: "ProPublica (US investigative)",
    bellingcat: "Bellingcat (open-source intel)",
    "404media": "404 Media (tech accountability)",
    "eff-press": "EFF Press (legal aid + amplification)",
  });

export const whistleRunFormModule = createModule("whistle-run-form", {
  schema: {
    facts: {
      bundleUrl: t.string(),
      category: t.string<Category>(),
      routingPartner: t.string<RoutingPartner>(),
      manualRedactPhrase: t.string(),
      anonymityCaveatAcknowledged: t.boolean(),
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
    facts.bundleUrl = "";
    facts.category = "training-data";
    facts.routingPartner = "propublica";
    facts.manualRedactPhrase = "";
    facts.anonymityCaveatAcknowledged = false;
    facts.authorizationAcknowledged = false;
    facts.submitStatus = "idle";
    facts.errorMessage = null;
    facts.signInUrl = null;
    facts.lastResult = null;
  },

  derive: {
    isSubmitting: (facts) => facts.submitStatus === "submitting",
    // WHISTLE has TWO ack checkboxes — anonymity caveat AND
    // authorization. Both required because the legal/safety posture
    // is materially heavier than the verify programs.
    canSubmit: (facts) => {
      if (facts.submitStatus === "submitting") {
        return false;
      }
      if (!facts.bundleUrl.trim()) {
        return false;
      }
      if (
        !facts.anonymityCaveatAcknowledged ||
        !facts.authorizationAcknowledged
      ) {
        return false;
      }
      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
  },
});
