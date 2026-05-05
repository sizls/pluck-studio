// ---------------------------------------------------------------------------
// e2e/open-speed-dial.spec.ts — Phrase-ID Speed-Dial flow
// ---------------------------------------------------------------------------
//
// Locks the speed-dial behavior end-to-end:
//   1. /open → renders the explainer page with sample links
//   2. /open/<known-phrase> → final URL is the receipt page
//   3. /open/garbage → final URL is /search?q=garbage
//   4. /o/<known-phrase> → identical behavior to /open
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("/open — Phrase-ID Speed-Dial", () => {
  test("renders the explainer page when visited bare", async ({ page }) => {
    const res = await page.goto("/open");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("open-index")).toBeVisible();
    await expect(page.getByTestId("open-search-cross-link")).toBeVisible();
    await expect(page.getByTestId("open-sample-link").first()).toBeVisible();
  });

  test("clicking a sample link redirects to the receipt page", async ({
    page,
  }) => {
    await page.goto("/open");
    const sample = page.getByTestId("open-sample-link").first();
    const sampleHref = await sample.getAttribute("href");
    expect(sampleHref).toMatch(/\/open\/[a-z0-9-]+/);
    await sample.click();
    // After the redirect, the URL is /bureau/<program>/runs/<phrase>
    await page.waitForURL(/\/bureau\/[a-z-]+\/runs\//);
    expect(page.url()).toMatch(/\/bureau\/[a-z-]+\/runs\//);
  });

  test("redirects garbage input to /search?q=<input>", async ({ page }) => {
    await page.goto("/open/garbage");
    await page.waitForURL(/\/search\?q=garbage/);
    expect(page.url()).toContain("/search?q=garbage");
    await expect(page.getByTestId("search-page")).toBeVisible();
  });

  test("redirects an unknown but well-formed phrase to /search", async ({
    page,
  }) => {
    const phrase = "openai-bold-marlin-9999";
    await page.goto(`/open/${phrase}`);
    await page.waitForURL(/\/search\?q=/);
    expect(page.url()).toContain(`/search?q=${encodeURIComponent(phrase)}`);
  });

  test("/o/<phrase> short-form alias mirrors /open/<phrase>", async ({
    page,
  }) => {
    await page.goto("/o/garbage");
    await page.waitForURL(/\/search\?q=garbage/);
    expect(page.url()).toContain("/search?q=garbage");
  });
});
