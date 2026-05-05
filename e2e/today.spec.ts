// ---------------------------------------------------------------------------
// e2e/today.spec.ts — golden test for the /today daily roll-up
// ---------------------------------------------------------------------------
//
// Locks the daily honesty card contract end-to-end:
//   1. /today → 200 with all 11 program tiles rendered + OG preview
//   2. /today/opengraph-image → 200 with content-type image/png
//   3. The OG card watermark is enforced via the route shape (not text
//      probe — ImageResponse renders a binary; the watermark is locked
//      by inspecting the route source in the unit layer).
//   4. /runs cross-links into /today.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const ACTIVE_SLUGS = [
  "dragnet",
  "oath",
  "fingerprint",
  "custody",
  "whistle",
  "bounty",
  "sbom-ai",
  "rotate",
  "tripwire",
  "nuclei",
  "mole",
] as const;

test.describe("/today — daily honesty roll-up", () => {
  test("renders all 11 program tiles plus OG preview + share link", async ({
    page,
  }) => {
    const res = await page.goto("/today");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("today-page")).toBeVisible();
    await expect(page.getByTestId("today-preview-banner")).toBeVisible();
    await expect(page.getByTestId("today-date")).toBeVisible();

    for (const slug of ACTIVE_SLUGS) {
      await expect(page.getByTestId(`today-program-tile-${slug}`)).toBeVisible();
      await expect(page.getByTestId(`today-program-total-${slug}`)).toBeVisible();
    }

    const og = page.getByTestId("today-og-preview");
    await expect(og).toBeVisible();
    const src = await og.getAttribute("src");
    expect(src).toMatch(/^\/today\/opengraph-image/);

    await expect(page.getByTestId("today-share-link")).toBeVisible();
  });

  test("OG image route returns image/png", async ({ request }) => {
    const res = await request.get("/today/opengraph-image");
    expect(res.status()).toBe(200);
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toMatch(/^image\/png/);
    const buf = await res.body();
    // PNG magic bytes — 89 50 4E 47 0D 0A 1A 0A
    expect(buf.length).toBeGreaterThan(8);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  test("/runs cross-links into /today", async ({ page }) => {
    await page.goto("/runs");
    const link = page.getByTestId("today-cross-link");
    await expect(link).toBeVisible();
    await expect(link).toContainText("/today");
  });
});
