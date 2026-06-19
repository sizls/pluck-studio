// ---------------------------------------------------------------------------
// VerdictBadge — unit tests
// ---------------------------------------------------------------------------
//
// Server-component, rendered via react-dom/server (no JSDOM). Asserts:
//   - each of the 6 variants renders the correct label + data-variant
//   - sm vs md sizes produce different heights
//   - the data-testid hook is present so spec lookup works
//   - title override flows through to title + aria-label
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  VerdictBadge,
  verdictBadgeLabel,
  type VerdictBadgeVariant,
} from "../VerdictBadge.js";

const VARIANTS: ReadonlyArray<{
  variant: VerdictBadgeVariant;
  label: string;
}> = [
  { variant: "verified", label: "Verified" },
  { variant: "registry-fenced", label: "Registry-fenced" },
  { variant: "re-witnessed", label: "Re-witnessed" },
  { variant: "expired", label: "Expired" },
  { variant: "failed", label: "Failed" },
  { variant: "pending", label: "Pending" },
];

describe("<VerdictBadge>", () => {
  it("renders the data-testid hook on every variant", () => {
    for (const { variant } of VARIANTS) {
      const html = renderToStaticMarkup(<VerdictBadge variant={variant} />);
      expect(html).toContain('data-testid="verdict-badge"');
      expect(html).toContain(`data-variant="${variant}"`);
    }
  });

  it("renders each variant with the expected label", () => {
    for (const { variant, label } of VARIANTS) {
      const html = renderToStaticMarkup(<VerdictBadge variant={variant} />);
      expect(html).toContain(label);
      expect(verdictBadgeLabel(variant)).toBe(label);
    }
  });

  it("renders distinct foreground colors per variant family", () => {
    const verifiedHtml = renderToStaticMarkup(
      <VerdictBadge variant="verified" />,
    );
    const fencedHtml = renderToStaticMarkup(
      <VerdictBadge variant="registry-fenced" />,
    );
    const failedHtml = renderToStaticMarkup(
      <VerdictBadge variant="failed" />,
    );

    // Hue 140 = green (verified, re-witnessed); 40 = amber; 0 = red.
    expect(verifiedHtml).toContain("hsl(140");
    expect(fencedHtml).toContain("hsl(40");
    expect(failedHtml).toContain("hsl(0");
  });

  it("size 'sm' renders a smaller height than 'md' (default)", () => {
    const sm = renderToStaticMarkup(
      <VerdictBadge variant="verified" size="sm" />,
    );
    const md = renderToStaticMarkup(
      <VerdictBadge variant="verified" size="md" />,
    );
    expect(sm).toContain("height:20px");
    expect(md).toContain("height:28px");
    expect(sm).toContain('data-size="sm"');
    expect(md).toContain('data-size="md"');
  });

  it("defaults to size 'md' when no size prop is supplied", () => {
    const html = renderToStaticMarkup(<VerdictBadge variant="verified" />);
    expect(html).toContain('data-size="md"');
  });

  it("renders unicode glyph (no emoji) before the label", () => {
    const verified = renderToStaticMarkup(
      <VerdictBadge variant="verified" />,
    );
    const reWitnessed = renderToStaticMarkup(
      <VerdictBadge variant="re-witnessed" />,
    );
    expect(verified).toContain("✓");
    expect(reWitnessed).toContain("↻");
  });

  it("uses title override for both title attribute and aria-label", () => {
    const html = renderToStaticMarkup(
      <VerdictBadge variant="registry-fenced" title="Custom hint" />,
    );
    expect(html).toContain('title="Custom hint"');
    expect(html).toContain('aria-label="Custom hint"');
  });

  it("falls back to the variant label for title + aria-label by default", () => {
    const html = renderToStaticMarkup(
      <VerdictBadge variant="registry-fenced" />,
    );
    expect(html).toContain('title="Registry-fenced"');
    expect(html).toContain('aria-label="Registry-fenced"');
  });
});
