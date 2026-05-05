// ---------------------------------------------------------------------------
// /today page — server-render unit test
// ---------------------------------------------------------------------------
//
// Locks the page render contract without spinning up Playwright:
//   - All 11 programs rendered with a tile testid
//   - Preview banner present
//   - OG image preview img tag points at /today/opengraph-image
//   - Share link present
//
// Pure server-rendering via `react-dom/server` — no DOM, no async
// network, no TestRenderer dependency. Mirrors the
// V1RunStatusBanner.test.tsx pattern.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import TodayPage from "../page.js";
import { ACTIVE_PROGRAMS } from "../../../lib/programs/registry.js";

describe("/today page — server render", () => {
  it("renders all 11 program tiles with the expected testids", () => {
    const html = renderToStaticMarkup(<TodayPage />);
    expect(html).toContain('data-testid="today-page"');
    expect(html).toContain('data-testid="today-preview-banner"');
    expect(html).toContain('data-testid="today-date"');
    for (const program of ACTIVE_PROGRAMS) {
      expect(html, program.slug).toContain(
        `data-testid="today-program-tile-${program.slug}"`,
      );
      expect(html, `${program.slug}-total`).toContain(
        `data-testid="today-program-total-${program.slug}"`,
      );
      expect(html, `${program.slug}-name`).toContain(program.name);
    }
  });

  it("renders the inline OG preview pointing at /today/opengraph-image", () => {
    const html = renderToStaticMarkup(<TodayPage />);
    expect(html).toContain('data-testid="today-og-preview"');
    expect(html).toMatch(/src="\/today\/opengraph-image[^"]*"/);
  });

  it("renders the share link as a copy-to-clipboard button (not a misleading anchor)", () => {
    const html = renderToStaticMarkup(<TodayPage />);
    expect(html).toContain('data-testid="today-share-link"');
    // The element MUST be a button — the previous <a href="/today"> shape
    // was misleading: the label said "Copy share URL" but clicking just
    // navigated. The CopyShareLink client component now does an actual
    // navigator.clipboard.writeText() on click.
    expect(html).toMatch(/<button[^>]*data-testid="today-share-link"/);
    expect(html).toContain('data-copy-state="idle"');
    expect(html).toContain("Copy share URL");
    // The old misleading affordance should be gone.
    expect(html).not.toMatch(/<a[^>]+data-testid="today-share-link"/);
  });

  it("renders the page header with UTC date", () => {
    const html = renderToStaticMarkup(<TodayPage />);
    expect(html).toContain("Today on Pluck");
    expect(html).toMatch(/UTC date: \d{4}-\d{2}-\d{2}/);
  });
});
