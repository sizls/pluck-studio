// ---------------------------------------------------------------------------
// e2e/vendor-feed.spec.ts — golden test for the per-vendor Atom feed
// ---------------------------------------------------------------------------
//
// Locks the Subscription Feed contract end-to-end:
//   1. /vendor/openai/feed.xml → 200 with application/atom+xml
//   2. Body parses + carries `<feed>` root + at least one `<entry>`
//   3. Unknown slug → 404 (matches vendor-page allowlist gate)
//   4. From /vendor/openai, the feed link is visible + href ends `/feed.xml`
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("/vendor/[slug]/feed.xml — Subscription Feed", () => {
  test("openai feed returns 200 with atom+xml content-type", async ({
    request,
  }) => {
    const res = await request.get("/vendor/openai/feed.xml");
    expect(res.status()).toBe(200);

    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toMatch(/^application\/atom\+xml/);

    const body = await res.text();
    expect(body).toMatch(/^<\?xml /);
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(body).toContain("</feed>");
    expect(body).toContain("<entry>");
  });

  test("unknown slug returns 404", async ({ request }) => {
    const res = await request.get("/vendor/not-a-real-vendor/feed.xml");
    expect(res.status()).toBe(404);
  });

  test("vendor page exposes a feed link with the expected href", async ({
    page,
  }) => {
    await page.goto("/vendor/openai");
    const link = page.getByTestId("vendor-feed-link");
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toBe("/vendor/openai/feed.xml");
  });

  test("anthropic feed also returns valid atom", async ({ request }) => {
    const res = await request.get("/vendor/anthropic/feed.xml");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<feed");
    expect(body).toContain("Anthropic");
    expect(body).toMatch(/<entry>[\s\S]*<\/entry>/);
  });
});
