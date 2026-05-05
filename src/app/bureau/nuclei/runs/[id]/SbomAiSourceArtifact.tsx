// ---------------------------------------------------------------------------
// SbomAiSourceArtifact — back-link section on the NUCLEI receipt
// ---------------------------------------------------------------------------
//
// Surfaces the SBOM-AI rekor UUID that this NUCLEI registry entry
// cross-references. Per the auto-link CTA spec, we DON'T resolve the
// sbomRekorUuid to a phraseId (would require a new resolver route);
// instead we render the rekor UUID as a code block plus the cosign
// command to verify the trust chain. That demonstrates the
// SBOM-AI → NUCLEI provenance loop without over-engineering routing.
//
// Pure presentational — `renderToStaticMarkup`-friendly.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
};

const StatLineStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  marginTop: 4,
};

interface SbomAiSourceArtifactProps {
  sbomRekorUuid: string | null;
}

export function SbomAiSourceArtifact({
  sbomRekorUuid,
}: SbomAiSourceArtifactProps): ReactNode {
  if (!sbomRekorUuid || sbomRekorUuid.length === 0) {
    return null;
  }

  return (
    <section data-testid="sbom-ai-source-artifact">
      <h2 style={SectionHeadingStyle}>Source artifact</h2>
      <p style={StatLineStyle}>
        This registry entry pins to a probe-pack published via SBOM-AI.
        The rekor UUID below is the cross-reference subscribers verify
        before honoring this pack.
      </p>
      <p style={StatLineStyle} data-testid="sbom-ai-source-rekor-uuid">
        SBOM-AI rekor UUID: <code>{sbomRekorUuid}</code>
      </p>
      <p style={StatLineStyle}>
        Verify the trust chain offline:{" "}
        <code>cosign verify-blob --rekor-url=https://rekor.sigstore.dev {sbomRekorUuid}</code>
      </p>
      <p style={StatLineStyle}>
        Browse SBOM-AI:{" "}
        <a href="/bureau/sbom-ai" data-testid="sbom-ai-source-link">
          /bureau/sbom-ai
        </a>
      </p>
    </section>
  );
}
