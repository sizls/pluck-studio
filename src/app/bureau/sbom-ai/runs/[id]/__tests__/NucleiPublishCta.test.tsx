// ---------------------------------------------------------------------------
// NucleiPublishCta — unit tests
// ---------------------------------------------------------------------------
//
// Pins the visibility matrix for the SBOM-AI → NUCLEI auto-link CTA:
//
//   1. artifactKind === "probe-pack" + anchored → live link CTA renders
//      with sbomRekorUuid pre-filled in the href.
//   2. artifactKind === "probe-pack" + pending → CTA renders greyed-out
//      with the "complete the SBOM-AI publish first" hint.
//   3. artifactKind === "model-card" → CTA does NOT render. NUCLEI
//      registry only accepts probe-pack artifacts.
//   4. artifactKind === "mcp-server" → CTA does NOT render.
//   5. artifactKind === null → CTA does NOT render.
//
// Pure presentational, so we render via `react-dom/server` (matching
// the V1RunStatusBanner / ExtractTool test pattern) rather than
// pulling in @testing-library/react + happy-dom.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NucleiPublishCta } from "../NucleiPublishCta";

const REKOR_UUID =
  "deadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00d";

describe("NucleiPublishCta — visibility matrix", () => {
  it("renders live CTA when probe-pack + anchored + rekor UUID present", () => {
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind="probe-pack"
        isPending={false}
        rekorUuid={REKOR_UUID}
      />,
    );
    expect(html).toContain('data-testid="nuclei-publish-cta"');
    expect(html).toContain('data-testid="nuclei-publish-cta-link"');
    expect(html).not.toContain('data-testid="nuclei-publish-cta-disabled"');
    expect(html).toContain(`sbomRekorUuid=${REKOR_UUID}`);
    expect(html).toContain("Publish to NUCLEI registry");
  });

  it("renders greyed-out disabled CTA when probe-pack but still pending", () => {
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind="probe-pack"
        isPending={true}
        rekorUuid={null}
      />,
    );
    expect(html).toContain('data-testid="nuclei-publish-cta"');
    expect(html).toContain('data-testid="nuclei-publish-cta-disabled"');
    expect(html).toContain('data-testid="nuclei-publish-cta-pending-hint"');
    expect(html).not.toContain('data-testid="nuclei-publish-cta-link"');
    expect(html).toContain("Complete the SBOM-AI publish first");
  });

  it("renders disabled even when probe-pack + anchored but rekor UUID missing", () => {
    // Defensive: if a future code path ever lands at the receipt without
    // a rekor UUID we don't want to emit a broken empty-param link.
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind="probe-pack"
        isPending={false}
        rekorUuid={null}
      />,
    );
    expect(html).toContain('data-testid="nuclei-publish-cta-disabled"');
    expect(html).not.toContain('data-testid="nuclei-publish-cta-link"');
  });

  it("does NOT render when artifactKind === 'model-card'", () => {
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind="model-card"
        isPending={false}
        rekorUuid={REKOR_UUID}
      />,
    );
    expect(html).toBe("");
  });

  it("does NOT render when artifactKind === 'mcp-server'", () => {
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind="mcp-server"
        isPending={false}
        rekorUuid={REKOR_UUID}
      />,
    );
    expect(html).toBe("");
  });

  it("does NOT render when artifactKind === null (initial state)", () => {
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind={null}
        isPending={true}
        rekorUuid={null}
      />,
    );
    expect(html).toBe("");
  });

  it("includes the explainer copy locking in the rekor UUID as TOFU cross-reference", () => {
    const html = renderToStaticMarkup(
      <NucleiPublishCta
        artifactKind="probe-pack"
        isPending={false}
        rekorUuid={REKOR_UUID}
      />,
    );
    expect(html).toContain("Cross-publish to the NUCLEI registry");
    expect(html).toContain("rekor UUID is already locked");
    expect(html).toContain("TOFU cross-reference");
  });
});
