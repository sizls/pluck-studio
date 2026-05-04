// ---------------------------------------------------------------------------
// custodyRunFormModule — Directive module for the CUSTODY verify-bundle form
// ---------------------------------------------------------------------------
//
// Fourth program through the Studio activation pattern. CUSTODY's
// existing `/bureau/custody/verify` is a journalist drag-and-drop
// tool — runs the verifier client-side, no signed receipt produced.
// This `/run` flow is the operator complement: paste a CustodyBundle
// URL, Studio fetches + verifies server-side, produces a signed
// Rekor-anchored FRE902-compliance verdict receipt.
//
// Form shape:
//   - bundleUrl: HTTPS URL of the CustodyBundle JSON (cap 256 KiB,
//     10s timeout, no redirects per CUSTODY spec)
//   - expectedVendor: optional override; defaults to the vendor field
//     in the bundle body. Used to assert "this bundle should be from
//     <vendor>" so a swapped bundle is caught.
//   - authorizationAcknowledged: required.
//
// CUSTODY's wire spec is anchored on FRE 902(13) admissibility:
// WebAuthn-bound operator identity is the keystone. Disk-only Ed25519
// keys fail Daubert; the verifier flags any bundle without WebAuthn
// binding as `fre902Compliant: false` with a structured reason list.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

/**
 * Bundle URLs must be HTTPS-only, public, and not point at private/
 * loopback hosts. The full DNS-resolution-time filter is C2's job
 * (lands with the real runner); this is the cosmetic + same-origin
 * guard that catches typos client+server-side.
 */
export function normalizeBundleUrl(raw: string): string {
  return raw.trim();
}

export const custodyRunFormModule = createModule("custody-run-form", {
  schema: {
    facts: {
      bundleUrl: t.string(),
      expectedVendor: t.string(),
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
    facts.expectedVendor = "";
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
      if (!facts.bundleUrl.trim()) {
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
