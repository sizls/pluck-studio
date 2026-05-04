// ---------------------------------------------------------------------------
// e2e/fingerprint-activation.spec.ts — golden test for program #3 (FINGERPRINT)
// ---------------------------------------------------------------------------
//
// Third program activated through the Studio activation pattern. With
// DRAGNET (probe-pack execution), OATH (verify static doc), and now
// FINGERPRINT (5-probe model-identity scan), the pattern is exercised
// against three genuinely different domain shapes — proves the v2
// generalization claim at N=3.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("FINGERPRINT activation flow", () => {
  test("unauthenticated user is shown a sign-in prompt, not a redirect", async ({
    page,
  }) => {
    await page.goto("/bureau/fingerprint/run");
    await expect(page.getByTestId("fingerprint-run-form")).toBeVisible();

    await page.getByTestId("vendor").fill("openai");
    await page.getByTestId("model").fill("gpt-4o");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("sign-in-prompt")).toBeVisible();
    await expect(page.getByTestId("vendor")).toHaveValue("openai");
  });

  test("authenticated user submits and lands on the phrase-id receipt page", async ({
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

    await page.goto("/bureau/fingerprint/run");
    await page.getByTestId("vendor").fill("openai");
    await page.getByTestId("model").fill("gpt-4o");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(
      /\/bureau\/fingerprint\/runs\/[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/,
    );
    await expect(page.getByTestId("run-id")).toBeVisible();
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("vendor-model")).toContainText(
      /Vendor.*model/i,
    );

    const runId = await page.getByTestId("run-id").innerText();
    expect(runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
  });

  test("submit blocked until vendor + model + auth-ack all present", async ({
    page,
  }) => {
    await page.goto("/bureau/fingerprint/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("vendor").fill("openai");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("model").fill("gpt-4o");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("client-side guard rejects vendor with dots", async ({
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

    await page.goto("/bureau/fingerprint/run");
    // Common mistake: pasting a domain instead of a vendor slug.
    await page.getByTestId("vendor").fill("openai.com");
    await page.getByTestId("model").fill("gpt-4o");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("run-error")).toContainText(/slug/i);
  });

  test("FINGERPRINT landing exposes the Run CTA", async ({ page }) => {
    await page.goto("/bureau/fingerprint");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/fingerprint\/run$/);
  });

  test("target-slug-preview updates live as user types", async ({ page }) => {
    await page.goto("/bureau/fingerprint/run");
    await expect(page.getByTestId("target-slug-preview")).toBeHidden();

    await page.getByTestId("vendor").fill("openai");
    await page.getByTestId("model").fill("gpt-4o");
    await expect(page.getByTestId("target-slug-preview")).toContainText(
      "openai/gpt-4o",
    );
  });
});
