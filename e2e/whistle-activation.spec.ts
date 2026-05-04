// ---------------------------------------------------------------------------
// e2e/whistle-activation.spec.ts — golden test for program #5 (WHISTLE)
// ---------------------------------------------------------------------------
//
// First *capture* program through the activation pattern. Different
// shape from the four verify programs — operator submits the source
// data, redaction layers run server-side, partner-routed.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("WHISTLE activation flow", () => {
  test("unauthenticated user is shown a sign-in prompt", async ({ page }) => {
    await page.goto("/bureau/whistle/run");
    await expect(page.getByTestId("whistle-run-form")).toBeVisible();

    await page
      .getByTestId("bundle-url")
      .fill("https://anonymous-host.example/tip.json");
    await page.getByTestId("anonymity-ack").check();
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("sign-in-prompt")).toBeVisible();
  });

  test("submit blocked until URL + BOTH acks present", async ({ page }) => {
    await page.goto("/bureau/whistle/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page
      .getByTestId("bundle-url")
      .fill("https://anonymous-host.example/tip.json");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("anonymity-ack").check();
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user submits and lands on partner-scoped phrase ID", async ({
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

    await page.goto("/bureau/whistle/run");
    await page
      .getByTestId("bundle-url")
      .fill("https://anonymous-host.example/tip.json");
    await page.getByTestId("category-policy-violation").check();
    await page.getByTestId("routing-bellingcat").check();
    await page.getByTestId("anonymity-ack").check();
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    // Phrase prefix is the routing-partner slug, NOT the bundle source.
    await page.waitForURL(
      /\/bureau\/whistle\/runs\/bellingcat-[a-z]+-[a-z]+-\d{4}$/,
    );
    await expect(page.getByTestId("run-id")).toBeVisible();
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("predicate-uri")).toContainText(
      "WhistleSubmission/v1",
    );

    const runId = await page.getByTestId("run-id").innerText();
    expect(runId).toMatch(/^bellingcat-/);
  });

  test("client-side guard rejects http:// URL", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "sb-test-auth-token",
        value: "test-jwt",
        domain: "localhost",
        path: "/",
        sameSite: "Lax",
      },
    ]);

    await page.goto("/bureau/whistle/run");
    await page
      .getByTestId("bundle-url")
      .fill("http://anonymous-host.example/tip.json");
    await page.getByTestId("anonymity-ack").check();
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("run-error")).toContainText(/https:\/\//i);
  });

  test("WHISTLE landing exposes the Submit CTA", async ({ page }) => {
    await page.goto("/bureau/whistle");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/whistle\/run$/);
  });
});
