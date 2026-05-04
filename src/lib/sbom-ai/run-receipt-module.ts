// ---------------------------------------------------------------------------
// sbomAiRunReceiptModule — Directive module for the SBOM-AI receipt
// ---------------------------------------------------------------------------
//
// Holds the live state of a single SBOM-AI publish. Per landing:
//   - probe-pack uses canonical-JSON-hash of ProbePack body
//   - model-card uses canonical-JSON-hash of ModelCard JSON
//   - mcp-server uses sha256 of raw tarball bytes (cosign sign-blob
//     interop)
//
// Verdicts:
//   - published       — fetched, hashed, attestation signed, Rekor
//                        anchor emitted
//   - hash-mismatch   — operator supplied expectedSha256 didn't match
//                        Studio's computed hash. Bundle is rejected.
//   - kind-mismatch   — bundle's parsed shape doesn't match declared
//                        artifactKind (e.g. probe-pack URL pointing
//                        at a tarball)
//   - bundle-malformed — JSON / schema invalid
//   - not-found       — HTTPS 404
//   - fetch-failed    — non-200, redirect, oversize, timeout, non-https
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "publish pending"
  | "fetching"
  | "hashing"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "published"
  | "hash-mismatch"
  | "kind-mismatch"
  | "bundle-malformed"
  | "not-found"
  | "fetch-failed";

export type ArtifactKind = "probe-pack" | "model-card" | "mcp-server";

/**
 * Per-artifact-kind predicate URIs. Each kind's attestation predicate
 * is distinct so consumers can `cosign verify --type ...` against the
 * exact wire format.
 */
export const PREDICATE_URI_BY_KIND: Readonly<
  Record<ArtifactKind, string>
> = Object.freeze({
  "probe-pack": "https://pluck.run/SbomAi/ProbePack/v1",
  "model-card": "https://pluck.run/SbomAi/ModelCard/v1",
  "mcp-server": "https://pluck.run/SbomAi/McpServer/v1",
});

export const CASSETTE_HASH_PREFIX = "local:";

export function formatCassetteHash(raw: string): string {
  if (raw.length === 0) {
    return raw;
  }
  if (raw.startsWith(CASSETTE_HASH_PREFIX)) {
    return raw;
  }
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return `${CASSETTE_HASH_PREFIX}${raw.toLowerCase()}`;
  }
  return raw;
}

export const sbomAiRunReceiptModule = createModule("sbom-ai-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      artifactUrl: t.string().nullable(),
      artifactKind: t.string<ArtifactKind>().nullable(),
      computedSha256: t.string().nullable(),
      expectedSha256: t.string().nullable(),
      signerFingerprint: t.string().nullable(),
      attestationUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
      publishedAt: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isPublished: t.boolean(),
      isFailure: t.boolean(),
      verdictColor: t.string<"gray" | "red" | "green">(),
      hashesMatch: t.boolean(),
      lookupUrl: t.string().nullable(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "publish pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.artifactUrl = null;
    facts.artifactKind = null;
    facts.computedSha256 = null;
    facts.expectedSha256 = null;
    facts.signerFingerprint = null;
    facts.attestationUrl = null;
    facts.rekorUuid = null;
    facts.publishedAt = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "publish pending" ||
      facts.status === "fetching" ||
      facts.status === "hashing" ||
      facts.status === "anchoring",
    isPublished: (facts) =>
      facts.status === "anchored" && facts.verdict === "published",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "published"),
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "gray";
      }
      if (facts.verdict === "published") {
        return "green";
      }
      // SBOM-AI is binary: artifact published or rejected. No amber —
      // a hash mismatch means the operator's claim doesn't match
      // ground truth, no resubmit-fixes-it loop.
      return "red";
    },
    hashesMatch: (facts) => {
      if (
        facts.expectedSha256 === null ||
        facts.computedSha256 === null
      ) {
        return false;
      }
      return (
        facts.expectedSha256.toLowerCase() ===
        facts.computedSha256.toLowerCase()
      );
    },
    lookupUrl: (facts) => {
      if (facts.computedSha256 === null) {
        return null;
      }
      // Per landing: studio.pluck.run/bureau/sbom-ai/<sha256>
      return `/bureau/sbom-ai/${facts.computedSha256.toLowerCase()}`;
    },
  },
});
