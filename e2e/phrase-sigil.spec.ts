// ---------------------------------------------------------------------------
// e2e/phrase-sigil.spec.ts — Phrase Crest end-to-end coverage
// ---------------------------------------------------------------------------
//
// The sigil is rendered in three live surfaces:
//   1. /search?q=<known-phrase> → each result tile carries one
//   2. /vendor/<slug>           → each receipt row carries one
//   3. Receipt page (DRAGNET)   → header carries a 96px sigil
//
// All three are server-rendered, so the visible-DOM check is enough —
// no client hydration timing concerns.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const KNOWN_QUERY = "openai-bold-marlin-1188";

test.describe("Phrase Crest sigil", () => {
  test("/search results render a sigil per tile", async ({ page }) => {
    const res = await page.goto(
      `/search?q=${encodeURIComponent(KNOWN_QUERY)}`,
    );
    expect(res?.status()).toBe(200);
    const sigils = page.getByTestId("phrase-sigil");
    await expect(sigils.first()).toBeVisible();
    expect(await sigils.count()).toBeGreaterThanOrEqual(1);
  });

  test("/vendor/openai renders a sigil for each receipt row", async ({
    page,
  }) => {
    const res = await page.goto("/vendor/openai");
    expect(res?.status()).toBe(200);
    const sigils = page.getByTestId("phrase-sigil");
    await expect(sigils.first()).toBeVisible();
    expect(await sigils.count()).toBeGreaterThanOrEqual(2);
  });

  test("DRAGNET receipt page renders a 96px sigil in the header", async ({
    page,
  }) => {
    await page.goto(`/bureau/dragnet/runs/${KNOWN_QUERY}`);
    const sigil = page.getByTestId("phrase-sigil").first();
    await expect(sigil).toBeVisible();
    // The sigil ships data-phrase-id matching the route param.
    await expect(sigil).toHaveAttribute("data-phrase-id", KNOWN_QUERY);
    // The 96px receipt-page size renders an SVG with width="96".
    const svg = sigil.locator("svg");
    await expect(svg).toHaveAttribute("width", "96");
  });
});
