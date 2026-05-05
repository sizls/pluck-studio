// ---------------------------------------------------------------------------
// e2e/search.spec.ts — phrase-ID auto-stitch search flow
// ---------------------------------------------------------------------------
//
// Locks the search experience end-to-end:
//   1. /search → form + empty state + sample links
//   2. /search?q=<known> → decomposition + direct match + related grid
//   3. /search?q=<invalid> → error message + empty state recovery
//   4. Click a sample-phrase link → results render
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const KNOWN_QUERY = "openai-bold-marlin-1188";

test.describe("/search — phrase-ID auto-stitch", () => {
  test("renders the form + empty state + samples when no query", async ({
    page,
  }) => {
    const res = await page.goto("/search");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("search-page")).toBeVisible();
    await expect(page.getByTestId("search-form")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeVisible();
    await expect(page.getByTestId("search-empty-state")).toBeVisible();
    await expect(
      page.getByTestId("search-sample-link").first(),
    ).toBeVisible();
  });

  test("renders decomposition + at least 1 related result for a known phrase", async ({
    page,
  }) => {
    const res = await page.goto(
      `/search?q=${encodeURIComponent(KNOWN_QUERY)}`,
    );
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("search-results")).toBeVisible();
    await expect(page.getByTestId("search-decomposition")).toBeVisible();
    await expect(page.getByTestId("search-direct-match")).toBeVisible();
    const related = page.getByTestId("search-related-result");
    await expect(related.first()).toBeVisible();
    expect(await related.count()).toBeGreaterThanOrEqual(1);
  });

  test("renders a graceful error for an invalid phrase ID", async ({
    page,
  }) => {
    const res = await page.goto("/search?q=garbage");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("search-error")).toBeVisible();
    // Empty state still rendered so user can recover via samples
    await expect(page.getByTestId("search-empty-state")).toBeVisible();
  });

  test("clicking a sample-phrase link loads results", async ({ page }) => {
    await page.goto("/search");
    const sample = page.getByTestId("search-sample-link").first();
    const sampleHref = await sample.getAttribute("href");
    expect(sampleHref).toMatch(/\/search\?q=/);
    await sample.click();
    await expect(page.getByTestId("search-decomposition")).toBeVisible();
    await expect(page.getByTestId("search-direct-match")).toBeVisible();
  });

  test("/runs cross-links into /search", async ({ page }) => {
    const res = await page.goto("/runs");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("search-cross-link")).toBeVisible();
    await page.getByTestId("search-cross-link").getByRole("link").click();
    await expect(page.getByTestId("search-page")).toBeVisible();
  });

  test("emits a robots noindex meta tag (search must not be indexed)", async ({
    page,
  }) => {
    // /search?q=<anything> echoes user input; a search engine indexing
    // arbitrary queries would create a permanent searchable record of
    // those queries. Lock the noindex contract here so a future change
    // to metadata.robots can't silently regress.
    const res = await page.goto(
      `/search?q=${encodeURIComponent(KNOWN_QUERY)}`,
    );
    expect(res?.status()).toBe(200);
    const robotsContent = await page
      .locator('meta[name="robots"]')
      .first()
      .getAttribute("content");
    expect(robotsContent).toBeTruthy();
    expect(robotsContent?.toLowerCase()).toContain("noindex");
    expect(robotsContent?.toLowerCase()).toContain("nofollow");
  });
});
