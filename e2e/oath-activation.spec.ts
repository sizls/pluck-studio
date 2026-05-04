// ---------------------------------------------------------------------------
// e2e/oath-activation.spec.ts — golden test for the v2 OATH wedge
// ---------------------------------------------------------------------------
//
// OATH is the second program activated through the Studio activation
// pattern. This spec mirrors dragnet-activation.spec.ts: same five
// scenarios, OATH-specific selectors and expectations. Together they
// prove the v1 plan's "wire OATH same way to prove generalizability"
// promise — if the architectural shape works for two programs with
// genuinely different field sets, the remaining 9 alpha programs can
// follow the same pattern.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("OATH activation flow", () => {
  test("unauthenticated user is shown a sign-in prompt, not a redirect", async ({
    page,
  }) => {
    await page.goto("/bureau/oath/run");
    await expect(page.getByTestId("oath-run-form")).toBeVisible();

    await page.getByTestId("vendor-domain").fill("openai.com");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("sign-in-prompt")).toBeVisible();
    await expect(page.getByTestId("vendor-domain")).toHaveValue("openai.com");

    await page.getByRole("link", { name: "Sign in" }).click();
    await page.waitForURL(/\/sign-in/);
    await expect(page.getByTestId("signin-cli-instructions")).toBeVisible();
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

    await page.goto("/bureau/oath/run");
    await page.getByTestId("vendor-domain").fill("openai.com");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(/\/bureau\/oath\/runs\/[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-id")).toBeVisible();
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("vendor-domain")).toContainText("Vendor:");

    const runId = await page.getByTestId("run-id").innerText();
    expect(runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
  });

  test("submit blocked until vendorDomain + auth-ack are both present", async ({
    page,
  }) => {
    await page.goto("/bureau/oath/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("vendor-domain").fill("openai.com");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("client-side guard rejects malformed vendor domains", async ({
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

    await page.goto("/bureau/oath/run");
    // URL with scheme — looks like a vendor URL but isn't a hostname.
    await page.getByTestId("vendor-domain").fill("https://openai.com");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("run-error")).toContainText(
      /no scheme, no path/i,
    );
  });

  test("OATH landing exposes the Run CTA", async ({ page }) => {
    await page.goto("/bureau/oath");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/oath\/run$/);
  });
});
