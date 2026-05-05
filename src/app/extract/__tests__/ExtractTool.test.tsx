// ---------------------------------------------------------------------------
// ExtractTool — unit tests
// ---------------------------------------------------------------------------
//
// Mirrors the V1RunStatusBanner pattern: render via `react-dom/server` to
// avoid pulling in @testing-library/react + happy-dom. Two slices:
//
//   1. SSR-shape lock: the dropzone, hint input, and helper copy render
//      on the server (all the static structure).
//   2. Stub contract: the helpers that the client UI consumes (probeHref
//      shape, illustrative-suffix invariant) are exercised here so the
//      defamation-guard never silently regresses.
//
// E2E coverage in `e2e/extract.spec.ts` exercises the full paste + extract
// + click-CTA flow under Playwright; this file pins the static surface.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  extractAssertionsStub,
  ILLUSTRATIVE_SUFFIX,
} from "../../../lib/extract/stub-extractor";
import { ExtractTool } from "../ExtractTool";

const FAKE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

describe("ExtractTool — SSR shell", () => {
  it("renders the dropzone with the expected copy + testid", () => {
    const html = renderToStaticMarkup(<ExtractTool />);
    expect(html).toContain('data-testid="extract-dropzone"');
    expect(html).toContain("Drop a screenshot");
    expect(html).toContain("paste from clipboard");
    expect(html).toContain("stays in your browser");
  });

  it("renders the hint input + extract-tool root testid", () => {
    const html = renderToStaticMarkup(<ExtractTool />);
    expect(html).toContain('data-testid="extract-tool"');
    expect(html).toContain('data-testid="extract-hint"');
  });

  it("does NOT render the preview / extract CTA before an image is set", () => {
    // Pre-image SSR: no preview block, no extract CTA, no results list.
    // This is the "open the page, see only the dropzone" lock.
    const html = renderToStaticMarkup(<ExtractTool />);
    expect(html).not.toContain('data-testid="extract-preview"');
    expect(html).not.toContain('data-testid="extract-cta"');
    expect(html).not.toContain('data-testid="extract-results"');
  });
});

describe("ExtractTool — stub contract surface", () => {
  // The client UI relies on the stub-extractor for the assertion list.
  // These tests pin the cross-component invariants: every assertion the
  // tool would render carries the illustrative suffix, and the
  // `Probe with DRAGNET` URL the tool will build pre-fills both the
  // vendor and the assertion query params.

  it("every stub assertion ends with the illustrative suffix", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "openai");
    for (const a of result) {
      expect(a.claim.endsWith(ILLUSTRATIVE_SUFFIX)).toBe(true);
    }
  });

  it("a probe-href would carry both ?vendor= and ?assertion=", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "openai");
    const first = result[0];
    expect(first).toBeDefined();
    if (!first) {
      return;
    }
    const params = new URLSearchParams();
    params.set("vendor", first.vendor);
    params.set("assertion", first.testableForm);
    const url = `/bureau/dragnet/run?${params.toString()}`;
    expect(url).toContain("vendor=openai");
    expect(url).toContain("assertion=");
    // The assertion query param is non-empty.
    const decoded = new URL(url, "http://localhost").searchParams.get(
      "assertion",
    );
    expect(decoded).not.toBeNull();
    expect(decoded?.length ?? 0).toBeGreaterThan(10);
  });
});
