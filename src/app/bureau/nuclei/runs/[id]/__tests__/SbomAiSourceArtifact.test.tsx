// ---------------------------------------------------------------------------
// SbomAiSourceArtifact — unit tests
// ---------------------------------------------------------------------------
//
// Pins the SBOM-AI back-link section on the NUCLEI receipt:
//
//   1. With a rekor UUID → section renders with the rekor UUID code
//      block and the cosign verify-blob command.
//   2. Without a rekor UUID → section renders nothing. NUCLEI receipts
//      created before SBOM-AI cross-reference was required must not
//      surface a broken back-link.
//
// `react-dom/server` for the same reason as NucleiPublishCta.test.tsx.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SbomAiSourceArtifact } from "../SbomAiSourceArtifact";

const REKOR_UUID =
  "feedfacecafef00ddeadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00d";

describe("SbomAiSourceArtifact", () => {
  it("renders the section with rekor UUID code block when sbomRekorUuid is present", () => {
    const html = renderToStaticMarkup(
      <SbomAiSourceArtifact sbomRekorUuid={REKOR_UUID} />,
    );
    expect(html).toContain('data-testid="sbom-ai-source-artifact"');
    expect(html).toContain('data-testid="sbom-ai-source-rekor-uuid"');
    expect(html).toContain(REKOR_UUID);
  });

  it("includes the cosign verify-blob command demonstrating the trust chain", () => {
    const html = renderToStaticMarkup(
      <SbomAiSourceArtifact sbomRekorUuid={REKOR_UUID} />,
    );
    expect(html).toContain("cosign verify-blob");
    expect(html).toContain("rekor.sigstore.dev");
    expect(html).toContain(REKOR_UUID);
  });

  it("includes a Browse SBOM-AI link", () => {
    const html = renderToStaticMarkup(
      <SbomAiSourceArtifact sbomRekorUuid={REKOR_UUID} />,
    );
    expect(html).toContain('data-testid="sbom-ai-source-link"');
    expect(html).toContain("/bureau/sbom-ai");
  });

  it("renders nothing when sbomRekorUuid is null", () => {
    const html = renderToStaticMarkup(
      <SbomAiSourceArtifact sbomRekorUuid={null} />,
    );
    expect(html).toBe("");
  });

  it("renders nothing when sbomRekorUuid is empty string", () => {
    const html = renderToStaticMarkup(
      <SbomAiSourceArtifact sbomRekorUuid="" />,
    );
    expect(html).toBe("");
  });
});
