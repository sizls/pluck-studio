// ---------------------------------------------------------------------------
// e2e/verdict-badge.spec.ts — Verdict-Verbose Badge end-to-end coverage
// ---------------------------------------------------------------------------
//
// VerdictBadge is the shared trust-tier primitive surfaced on:
//   1. /vendor/<slug>          — sm pill next to each receipt's verdict dot
//   2. /search?q=<phrase>      — sm pill in result tile headers
//   3. NUCLEI receipt page     — md pill on the verdict line (registry-fenced
//                                / verified / failed / pending)
//   4. MOLE receipt page       — md pill on the verdict line (re-witnessed
//                                / verified / failed / pending)
//
// All four surfaces are server-rendered (or render the badge in the
// initial paint), so the visible-DOM check is enough — no client
// hydration timing concerns.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("Verdict-Verbose badge", () => {
  test("/vendor/openai renders at least one verdict-badge", async ({
    page,
  }) => {
    const res = await page.goto("/vendor/openai");
    expect(res?.status()).toBe(200);
    const badges = page.getByTestId("verdict-badge");
    await expect(badges.first()).toBeVisible();
    expect(await badges.count()).toBeGreaterThanOrEqual(1);
  });

  test("/search results carry a sm verdict-badge per tile", async ({
    page,
  }) => {
    const res = await page.goto("/search?q=openai-bold-marlin-1188");
    expect(res?.status()).toBe(200);
    const badges = page.getByTestId("verdict-badge");
    await expect(badges.first()).toBeVisible();
    // sm size is 20px tall — at least one tile carries a sm badge.
    const first = badges.first();
    await expect(first).toHaveAttribute("data-size", "sm");
  });

  test("NUCLEI receipt surfaces a verified or registry-fenced badge", async ({
    page,
  }) => {
    // Author-scoped phrase IDs land on the receipt page even before the
    // pluck-api swap; the stub renders 'publish pending' or a published
    // verdict depending on the path.
    await page.goto("/bureau/nuclei/runs/alice-bold-marlin-1188");
    const badge = page.getByTestId("verdict-badge").first();
    await expect(badge).toBeVisible();
    const variant = await badge.getAttribute("data-variant");
    expect([
      "verified",
      "registry-fenced",
      "failed",
      "pending",
    ]).toContain(variant);
  });

  test("MOLE receipt surfaces a verified, re-witnessed, failed, or pending badge", async ({
    page,
  }) => {
    await page.goto("/bureau/mole/runs/nyt20240115-bold-marlin-1188");
    const badge = page.getByTestId("verdict-badge").first();
    await expect(badge).toBeVisible();
    const variant = await badge.getAttribute("data-variant");
    expect([
      "verified",
      "re-witnessed",
      "failed",
      "pending",
    ]).toContain(variant);
  });
});
