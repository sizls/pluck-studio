// ---------------------------------------------------------------------------
// e2e/custody-activation.spec.ts — golden test for program #4 (CUSTODY)
// ---------------------------------------------------------------------------
//
// Fourth program through the Studio activation pattern. With DRAGNET
// (probe-pack execution) + OATH (verify static doc) + FINGERPRINT
// (5-probe scan) + CUSTODY (verify CustodyBundle URL), the pattern
// holds across four genuinely different domain shapes — verify-static,
// verify-by-spec, scan-and-classify, verify-and-court-admit.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("CUSTODY activation flow", () => {
  test("unauthenticated user is shown a sign-in prompt", async ({ page }) => {
    await page.goto("/bureau/custody/run");
    await expect(page.getByTestId("custody-run-form")).toBeVisible();

    await page
      .getByTestId("bundle-url")
      .fill("https://example.com/bundle.json");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("sign-in-prompt")).toBeVisible();
    await expect(page.getByTestId("bundle-url")).toHaveValue(
      "https://example.com/bundle.json",
    );
  });

  test("authenticated user submits and lands on phrase-id receipt", async ({
    page,
    context,
  }) => {
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

    await page.goto("/bureau/custody/run");
    await page
      .getByTestId("bundle-url")
      .fill("https://chat.openai.com/bundle.intoto.jsonl");
    await page.getByTestId("expected-vendor").fill("openai.com");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    // Phrase ID prefix uses the expectedVendor slug.
    await page.waitForURL(
      /\/bureau\/custody\/runs\/openai-[a-z]+-[a-z]+-\d{4}$/,
    );
    await expect(page.getByTestId("run-id")).toBeVisible();
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("predicate-uri")).toContainText(
      "CustodyBundle/v1",
    );

    const runId = await page.getByTestId("run-id").innerText();
    expect(runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
  });

  test("submit blocked until bundleUrl + auth-ack are both present", async ({
    page,
  }) => {
    await page.goto("/bureau/custody/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page
      .getByTestId("bundle-url")
      .fill("https://example.com/bundle.json");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("client-side guard rejects http:// bundle URL", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "sb-test-auth-token",
        value: "test-jwt",
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);

    await page.goto("/bureau/custody/run");
    await page
      .getByTestId("bundle-url")
      .fill("http://example.com/bundle.json");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("run-error")).toContainText(/https:\/\//i);
  });

  test("CUSTODY landing exposes both Run + Verify-offline CTAs", async ({
    page,
  }) => {
    await page.goto("/bureau/custody");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await expect(page.getByTestId("verify-offline-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/custody\/run$/);
  });
});
