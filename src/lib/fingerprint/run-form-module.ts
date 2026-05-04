// ---------------------------------------------------------------------------
// fingerprintRunFormModule — Directive module for the FINGERPRINT scan form
// ---------------------------------------------------------------------------
//
// Third program activated through the Studio activation pattern. Same
// shape as DRAGNET (probe-pack execution) and OATH (verify-static-doc),
// different domain: FINGERPRINT runs a fixed 5-probe calibration set
// against a model API to produce a signed `ModelFingerprint/v1`
// cassette. Comparing two scans surfaces drift as classification
// (stable / minor / major / swap).
//
// Form shape:
//   - vendor: slug ("openai", "anthropic", "google", ...)
//   - model: slug ("gpt-4o", "claude-3-5-sonnet", ...)
//   - authorizationAcknowledged: required (same legal posture)
//
// We deliberately don't take a full URL here — FINGERPRINT targets a
// vendor's *model* by slug and Studio's hosted-mode runner wires the
// transport (OpenAI / Anthropic / etc) per the responder shape from
// the `pluck bureau fingerprint scan` CLI. The vendor+model pair is
// the canonical key used by /bureau/fingerprint/[vendor]/[model] for
// the timeline view of historical scans.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MODEL_SLUG_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

/**
 * Vendors whose model APIs the hosted-mode runner actually wires
 * a transport for. Form rejects unsupported slugs early so the
 * operator doesn't land on a receipt that can never resolve.
 *
 * NB: this is a *hosted-mode* allowlist. The OSS pluck CLI accepts
 * arbitrary `--vendor` slugs because it lets the operator supply a
 * `--responder` module — we don't have that affordance here.
 */
export const SUPPORTED_VENDORS: ReadonlyArray<string> = [
  "openai",
  "anthropic",
  "google",
  "meta",
  "mistral",
  "cohere",
  "openrouter",
  "groq",
  "ai21",
  "deepseek",
];

export function isSupportedVendor(slug: string): boolean {
  return SUPPORTED_VENDORS.includes(slug);
}

/**
 * True for `openai`, `anthropic`, `meta`, `google` etc. Intentionally
 * narrower than `MODEL_SLUG_PATTERN` — vendor names are short
 * lowercase identifiers; allowing dots/underscores would conflate
 * with model slug shapes.
 */
export function isValidVendorSlug(s: string): boolean {
  return SLUG_PATTERN.test(s) && s.length <= 32;
}

/**
 * True for `gpt-4o`, `claude-3-5-sonnet`, `llama-3.1-70b`, etc. Model
 * slugs commonly include dots, hyphens, and (rarely) underscores; we
 * allow the union and cap at 64 chars. Slashes / spaces / scheme are
 * rejected.
 */
export function isValidModelSlug(s: string): boolean {
  return MODEL_SLUG_PATTERN.test(s) && s.length <= 64;
}

export const fingerprintRunFormModule = createModule(
  "fingerprint-run-form",
  {
    schema: {
      facts: {
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
        targetSlug: t.string(),
      },
    },

    init: (facts) => {
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
        if (!facts.vendor.trim() || !facts.model.trim()) {
          return false;
        }
        if (!facts.authorizationAcknowledged) {
          return false;
        }
        return true;
      },
      hasError: (facts) => facts.errorMessage !== null,
      needsSignIn: (facts) => facts.signInUrl !== null,
      targetSlug: (facts) => {
        const v = facts.vendor.trim().toLowerCase();
        const m = facts.model.trim().toLowerCase();
        if (v.length === 0 || m.length === 0) {
          return "";
        }
        return `${v}/${m}`;
      },
    },
  },
);
