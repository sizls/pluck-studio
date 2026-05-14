// ---------------------------------------------------------------------------
// e2e/watch-creation.spec.ts — golden test for the Watch surface
// ---------------------------------------------------------------------------
//
// Validates the Week-1 hypothesis: "Can an authenticated user create a
// watch, see it in the list, open its detail page, manually trigger it,
// see a mock observation, and pause/resume it — entirely via the UI?"
//
// Covers landing → form → REST create → list → detail → trigger →
// observation render → pause → resume. The Week-2 worker swap doesn't
// touch this spec (the public surface is identical post-swap).
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

// example.com is a stable, fast, IANA-reserved test target — keeps the
// Week-1 stub's one-shot fetch deterministic so the mock observation
// always lands within Playwright's default 30s timeout. Replace with
// fixture pages once the worker + Playwright fetcher ship in Week-2.
const VALID_URL = "https://example.com/";
const VALID_INTENT =
  "Alert when the GPT-4 input token price drops below its current value, especially when a 'Sale' or 'Discount' label appears near the pricing table.";

async function authenticate(context: import("@playwright/test").BrowserContext) {
  await context.addCookies([
    {
      name: "sb-test-auth-token",
      value: "test-jwt",
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test.describe("Watch — create + list + trigger", () => {
  test("landing page surfaces the create CTA", async ({ page }) => {
    await page.goto("/watch");
    await expect(page.getByTestId("watch-create-cta")).toBeVisible();
  });

  test("submit blocked until name + url + intent + cron + a channel are present", async ({
    page,
    context,
  }) => {
    await authenticate(context);
    await page.goto("/watch/new");

    await expect(page.getByTestId("watch-submit")).toBeDisabled();
    await page.getByTestId("watch-name").fill("OpenAI pricing");
    await expect(page.getByTestId("watch-submit")).toBeDisabled();
    await page.getByTestId("watch-url").fill(VALID_URL);
    await expect(page.getByTestId("watch-submit")).toBeDisabled();
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    // Cron pre-fills to @daily, channels default to dashboard+phraseId.
    await expect(page.getByTestId("watch-submit")).toBeEnabled();
  });

  test("authenticated user creates a watch and lands on the receipt page", async ({
    page,
    context,
  }) => {
    await authenticate(context);
    await page.goto("/watch/new");

    await page.getByTestId("watch-name").fill("OpenAI pricing");
    await page.getByTestId("watch-url").fill(VALID_URL);
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    await page.getByTestId("watch-submit").click();

    // Redirected to /watch/<watchId>.
    await page.waitForURL(/\/watch\/[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("watch-detail-name")).toContainText(
      "OpenAI pricing",
    );
    await expect(page.getByTestId("watch-detail-status")).toContainText(
      /active/,
    );
    await expect(page.getByTestId("watch-detail-url")).toContainText(VALID_URL);
  });

  test("manual trigger writes a mock observation and renders it inline", async ({
    page,
    context,
  }) => {
    await authenticate(context);

    await page.goto("/watch/new");
    await page.getByTestId("watch-name").fill("Trigger test");
    await page.getByTestId("watch-url").fill(VALID_URL);
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    await page.getByTestId("watch-submit").click();
    await page.waitForURL(/\/watch\/[^/]+$/);

    // Before trigger — observations list is empty.
    await expect(page.getByTestId("watch-observations-empty")).toBeVisible();

    await page.getByTestId("watch-trigger").click();

    // After trigger — at least one observation card renders.
    await expect(
      page.locator('[data-testid^="observation-"]').first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test("pause toggles status and the button label flips to Resume", async ({
    page,
    context,
  }) => {
    await authenticate(context);

    await page.goto("/watch/new");
    await page.getByTestId("watch-name").fill("Pause test");
    await page.getByTestId("watch-url").fill(VALID_URL);
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    await page.getByTestId("watch-submit").click();
    await page.waitForURL(/\/watch\/[^/]+$/);

    await expect(page.getByTestId("watch-pause-resume")).toContainText("Pause");
    await page.getByTestId("watch-pause-resume").click();
    await expect(page.getByTestId("watch-detail-status")).toContainText(
      /paused/,
    );
    await expect(page.getByTestId("watch-pause-resume")).toContainText(
      "Resume",
    );

    await page.getByTestId("watch-pause-resume").click();
    await expect(page.getByTestId("watch-detail-status")).toContainText(
      /active/,
    );
  });

  test("new watch appears in the landing list", async ({ page, context }) => {
    await authenticate(context);

    await page.goto("/watch/new");
    const uniqueName = `Visible-in-list ${Date.now()}`;
    await page.getByTestId("watch-name").fill(uniqueName);
    await page.getByTestId("watch-url").fill(VALID_URL);
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    await page.getByTestId("watch-submit").click();
    await page.waitForURL(/\/watch\/[^/]+$/);

    await page.goto("/watch");
    await expect(page.getByTestId("watch-list")).toContainText(uniqueName);
  });

  test("trigger result renders with a STUB ribbon (Week-1 mock disclosure)", async ({
    page,
    context,
  }) => {
    await authenticate(context);

    await page.goto("/watch/new");
    await page.getByTestId("watch-name").fill("STUB ribbon check");
    await page.getByTestId("watch-url").fill(VALID_URL);
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    await page.getByTestId("watch-submit").click();
    await page.waitForURL(/\/watch\/[^/]+$/);

    await page.getByTestId("watch-trigger").click();

    // The first observation card carries the STUB chip (modelUsed === null
    // && kind !== "error"), telling the operator this is the Week-1 mock.
    const stub = page.locator('[data-testid^="observation-stub-"]').first();
    await expect(stub).toBeVisible({ timeout: 30_000 });
    await expect(stub).toContainText(/STUB/);
  });

  test("unauthenticated submit surfaces the sign-in prompt", async ({
    page,
  }) => {
    await page.goto("/watch/new");
    await page.getByTestId("watch-name").fill("Unauth attempt");
    await page.getByTestId("watch-url").fill(VALID_URL);
    await page.getByTestId("watch-intent").fill(VALID_INTENT);
    await page.getByTestId("watch-submit").click();

    await expect(page.getByTestId("sign-in-prompt")).toBeVisible();
  });
});
