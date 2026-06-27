// ---------------------------------------------------------------------------
// AlphaReceiptBanner — contract tests
// ---------------------------------------------------------------------------
//
// Rendered via `react-dom/server` to match the test posture of the
// sibling V1RunStatusBanner — the studio repo doesn't ship a DOM
// test environment, and the banner is pure presentation, so the
// static-markup path is sufficient.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AlphaReceiptBanner } from "../AlphaReceiptBanner.js";

describe("AlphaReceiptBanner", () => {
  it("renders with the alpha label + a stable test handle", () => {
    const html = renderToStaticMarkup(<AlphaReceiptBanner />);
    expect(html).toContain('data-testid="alpha-receipt-banner"');
    expect(html).toMatch(/alpha/i);
  });

  it("names Sigstore Rekor + DSSE so verifiers can map the claim", () => {
    const html = renderToStaticMarkup(<AlphaReceiptBanner />);
    expect(html).toContain("Sigstore Rekor");
    expect(html).toContain("DSSE");
  });

  it("is an a11y status region (announces to assistive tech)", () => {
    const html = renderToStaticMarkup(<AlphaReceiptBanner />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });
});
