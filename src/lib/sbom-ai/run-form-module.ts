// ---------------------------------------------------------------------------
// sbomAiRunFormModule — Directive module for the SBOM-AI publish form
// ---------------------------------------------------------------------------
//
// Per the SBOM-AI landing's "three artifact kinds":
//   - probe-pack  — @sizls/pluck-bureau-core ProbePack body; packHash
//                    IS the artifact digest
//   - model-card  — Hugging Face / OpenAI ModelCard JSON, canonical-
//                    JSON-hashed
//   - mcp-server  — MCP server release tarball (sha256 of raw bytes,
//                    interoperable with `cosign sign-blob`)
//
// Studio's hosted publish: operator hands an artifact URL + kind +
// optional expected-sha256 (for cross-check). We fetch, hash, sign
// the in-toto attestation, dispatch to Rekor.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

export type ArtifactKind = "probe-pack" | "model-card" | "mcp-server";

export const ARTIFACT_KIND_LABELS: Readonly<
  Record<ArtifactKind, string>
> = Object.freeze({
  "probe-pack": "Probe-pack (DRAGNET / Bureau probe bundle)",
  "model-card": "Model card (Hugging Face / OpenAI ModelCard JSON)",
  "mcp-server": "MCP server (release tarball, sha256 of raw bytes)",
});

const SHA256_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidSha256(s: string): boolean {
  return SHA256_PATTERN.test(s);
}

export const sbomAiRunFormModule = createModule("sbom-ai-run-form", {
  schema: {
    facts: {
      artifactUrl: t.string(),
      artifactKind: t.string<ArtifactKind>(),
      expectedSha256: t.string(),
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
      hasExpectedHash: t.boolean(),
    },
  },

  init: (facts) => {
    facts.artifactUrl = "";
    facts.artifactKind = "probe-pack";
    facts.expectedSha256 = "";
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
      if (!facts.artifactUrl.trim()) {
        return false;
      }
      if (!facts.authorizationAcknowledged) {
        return false;
      }
      // Expected sha256 is optional — when supplied it must validate
      // before we let the operator submit.
      const expected = facts.expectedSha256.trim();
      if (expected.length > 0 && !SHA256_PATTERN.test(expected)) {
        return false;
      }
      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
    hasExpectedHash: (facts) => facts.expectedSha256.trim().length > 0,
  },
});
