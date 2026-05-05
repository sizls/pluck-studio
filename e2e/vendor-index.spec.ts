// ---------------------------------------------------------------------------
// e2e/vendor-index.spec.ts — golden test for /vendor + /vendor/[slug]
// ---------------------------------------------------------------------------
//
// The Vendor Honesty Index is the keystone game-changer: a permanent
// URL per vendor that aggregates every Bureau receipt naming that
// vendor. This suite locks the contract:
//
//   1. /vendor renders the curated allowlist (≥ 5 cards)
//   2. /vendor/openai renders the profile header + ≥ 4 program sections
//   3. Unknown slug → 404
//   4. Preview banner is present on both surfaces
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("/vendor — Vendor Honesty Index", () => {
  test("index renders at least 5 vendor cards", async ({ page }) => {
    await page.goto("/vendor");
    const grid = page.getByTestId("vendor-index-grid");
    await expect(grid).toBeVisible();
    const cards = page.locator('[data-testid^="vendor-card-"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(5);
  });

  test("index surfaces the preview banner", async ({ page }) => {
    await page.goto("/vendor");
    await expect(page.getByTestId("vendor-preview-banner").first()).toBeVisible();
  });

  test("clicking the OpenAI card lands on its profile", async ({ page }) => {
    await page.goto("/vendor");
    await page.getByTestId("vendor-card-openai").click();
    await page.waitForURL(/\/vendor\/openai$/);
    const header = page.getByTestId("vendor-profile-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("OpenAI");
  });

  test("OpenAI profile renders ≥ 4 program sections", async ({ page }) => {
    await page.goto("/vendor/openai");
    const sections = page.getByTestId("vendor-profile-program-section");
    await expect(sections.first()).toBeVisible();
    expect(await sections.count()).toBeGreaterThanOrEqual(4);

    // The four core vendor-bearing programs MUST be present for OpenAI.
    for (const program of ["dragnet", "oath", "fingerprint", "nuclei"]) {
      await expect(
        page.locator(`[data-testid="vendor-profile-program-section"][data-program="${program}"]`),
      ).toBeVisible();
    }
  });

  test("profile shows the preview banner + subscribe link", async ({ page }) => {
    await page.goto("/vendor/openai");
    await expect(page.getByTestId("vendor-preview-banner").first()).toBeVisible();
    await expect(page.getByTestId("vendor-feed-link")).toBeVisible();
  });

  test("unknown vendor slug returns 404", async ({ page }) => {
    const response = await page.goto("/vendor/unknown-vendor-slug");
    expect(response).not.toBeNull();
    expect(response?.status()).toBe(404);
  });

  test("anthropic profile also renders with display name", async ({ page }) => {
    await page.goto("/vendor/anthropic");
    const header = page.getByTestId("vendor-profile-header");
    await expect(header).toBeVisible();
    await expect(header).toContainText("Anthropic");
  });

  test("/runs cross-links to the vendor index", async ({ page }) => {
    await page.goto("/runs");
    const link = page.getByTestId("vendor-index-cross-link");
    await expect(link).toBeVisible();
    await expect(link).toContainText("/vendor");
  });
});
