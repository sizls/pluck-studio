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

import { ACTIVE_PROGRAMS } from "../src/lib/programs/registry.js";

// Derived from the registry — single source of truth. If ACTIVE_PROGRAMS
// is reordered or extended, this list follows automatically. No drift.
const ACTIVE_SLUGS = ACTIVE_PROGRAMS.map((p) => p.slug);

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

  test("share link copies the page URL to the clipboard", async ({
    page,
    context,
  }) => {
    // Grant clipboard permissions for chromium. Other browsers ignore.
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/today");
    const button = page.getByTestId("today-share-link");
    await expect(button).toBeVisible();
    // Initial state is idle — label should read "Copy share URL".
    await expect(button).toContainText(/Copy share URL/i);
    await expect(button).toHaveAttribute("data-copy-state", "idle");

    // Stub clipboard.writeText so we can assert it was called even on
    // browsers (webkit/firefox) that don't honor grantPermissions.
    await page.evaluate(() => {
      (
        window as unknown as { __copied?: string[] }
      ).__copied = [];
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: (text: string) => {
            (window as unknown as { __copied: string[] }).__copied.push(text);

            return Promise.resolve();
          },
        },
      });
    });

    await button.click();

    // After click the button should briefly enter the "copied" state.
    await expect(button).toHaveAttribute("data-copy-state", "copied");
    await expect(button).toContainText(/Copied/i);

    const copied = await page.evaluate(
      () => (window as unknown as { __copied: string[] }).__copied,
    );
    expect(copied.length).toBe(1);
    expect(copied[0]).toMatch(/\/today$/);
  });
});
