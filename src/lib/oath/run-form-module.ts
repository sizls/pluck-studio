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
//     Renamed-from "vendor URL" because OATH targets a domain, not a URL.
//   - hostingOrigin: optional override; defaults to `https://<domain>`.
//     Distinct from `body.vendor` (the vendor's *self-declared*
//     identity) — at verify time we cross-check the served Origin
//     against `body.vendor`. Renamed-from `expectedOrigin` because
//     "expected" was conflating these two distinct concepts.
//   - authorizationAcknowledged: required, same legal posture as DRAGNET.
//
// Helper: `normalizeVendorDomain` accepts both bare hostnames
// ("openai.com") AND full URLs ("https://openai.com/v1/foo") and
// extracts the canonical lowercase hostname. The form's onChange uses
// it so users can paste either shape.
//
// This is the second program wired through the Studio activation
// pattern. Per the v1 plan: "Wire OATH same way to prove
// generalizability."
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

/**
 * Accept either a bare hostname (`openai.com`) or a full URL
 * (`https://openai.com/v1/...`) and return the lowercase hostname.
 * Returns the trimmed input lowercased on parse failure so the
 * downstream HOSTNAME_PATTERN check can produce a clear error.
 */
export function normalizeVendorDomain(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return "";
  }
  // Quick path: looks like a URL → parse → take hostname.
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }
  return trimmed.toLowerCase();
}

export const oathRunFormModule = createModule("oath-run-form", {
  schema: {
    facts: {
      vendorDomain: t.string(),
      hostingOrigin: t.string(),
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
      effectiveHostingOrigin: t.string(),
    },
  },

  init: (facts) => {
    facts.vendorDomain = "";
    facts.hostingOrigin = "";
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
    effectiveHostingOrigin: (facts) => {
      const explicit = facts.hostingOrigin.trim();
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
