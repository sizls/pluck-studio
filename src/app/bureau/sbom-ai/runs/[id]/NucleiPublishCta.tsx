// ---------------------------------------------------------------------------
// NucleiPublishCta — supply-chain auto-link CTA on the SBOM-AI receipt
// ---------------------------------------------------------------------------
//
// Closes the SBOM-AI → NUCLEI cross-publish loop. When an operator publishes
// a probe-pack via SBOM-AI, the receipt surfaces a "Publish to NUCLEI
// registry →" CTA with the Rekor UUID + pack name pre-filled in the NUCLEI
// form via query params (?sbomRekorUuid=&packName=).
//
// Renders ONLY when:
//   1. artifactKind === "probe-pack" — the NUCLEI registry only accepts
//      probe-pack artifacts. model-card and mcp-server are out of scope.
//   2. The receipt has a meaningful state. While pending we render the CTA
//      greyed out with a "complete the SBOM-AI publish first" hint so the
//      operator sees the next step early but can't accidentally publish
//      with a placeholder UUID. Once anchored, the CTA becomes a live link
//      and the rekor UUID is locked.
//
// Pure presentational — `renderToStaticMarkup`-friendly so the unit tests
// can pin the visibility matrix without a DOM harness.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import type { ArtifactKind } from "../../../../../lib/sbom-ai/run-receipt-module";

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
};

const ExplainerStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  marginTop: 8,
  lineHeight: 1.6,
};

const CtaButtonStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 12,
  padding: "8px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  background: "var(--bureau-fg)",
  color: "var(--bureau-bg)",
  textDecoration: "none",
  borderRadius: 4,
};

const DisabledCtaStyle: CSSProperties = {
  ...CtaButtonStyle,
  background: "var(--bureau-fg-dim)",
  opacity: 0.5,
  cursor: "not-allowed",
};

interface NucleiPublishCtaProps {
  artifactKind: ArtifactKind | null;
  isPending: boolean;
  rekorUuid: string | null;
}

/**
 * Pack name is not a fact on the SBOM-AI receipt module — operators
 * don't supply one upstream. We pass through whatever the NUCLEI form
 * default is by leaving it empty; the operator fills it on the
 * NUCLEI side. The CTA still pre-fills sbomRekorUuid which is the
 * load-bearing cross-reference.
 */
export function NucleiPublishCta({
  artifactKind,
  isPending,
  rekorUuid,
}: NucleiPublishCtaProps): ReactNode {
  // Hard gate — NUCLEI registry only accepts probe-pack artifacts.
  if (artifactKind !== "probe-pack") {
    return null;
  }

  const canPublish = !isPending && rekorUuid !== null && rekorUuid !== "";
  const params = new URLSearchParams();
  if (rekorUuid) {
    params.set("sbomRekorUuid", rekorUuid);
  }
  const href = `/bureau/nuclei/run${params.toString() ? `?${params.toString()}` : ""}`;

  return (
    <section data-testid="nuclei-publish-cta">
      <h2 style={SectionHeadingStyle}>Publish to NUCLEI</h2>
      <p style={ExplainerStyle}>
        Cross-publish to the NUCLEI registry. Your SBOM-AI rekor UUID
        is already locked — NUCLEI uses it as the TOFU cross-reference.
      </p>
      {canPublish ? (
        <a
          href={href}
          style={CtaButtonStyle}
          data-testid="nuclei-publish-cta-link"
        >
          Publish to NUCLEI registry →
        </a>
      ) : (
        <>
          <span
            aria-disabled="true"
            style={DisabledCtaStyle}
            data-testid="nuclei-publish-cta-disabled"
          >
            Publish to NUCLEI registry →
          </span>
          <p
            style={{ ...ExplainerStyle, fontStyle: "italic", marginTop: 8 }}
            data-testid="nuclei-publish-cta-pending-hint"
          >
            Complete the SBOM-AI publish first — the rekor UUID is the
            cross-reference NUCLEI requires.
          </p>
        </>
      )}
    </section>
  );
}
