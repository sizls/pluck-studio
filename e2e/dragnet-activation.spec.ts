// ---------------------------------------------------------------------------
// e2e/dragnet-activation.spec.ts — golden test for the v1 activation flow
// ---------------------------------------------------------------------------
//
// Per the plan's testing strategy: this is one of the 5 golden E2E tests
// that block release if broken. It validates the central v1 hypothesis:
//
//   "Can a logged-in user click Run on a Bureau program and get a
//    receipt URL back?"
//
// Setup: requires Playwright (`@playwright/test`) and a running dev server
// on http://localhost:3030. CI wiring lands in a follow-on commit:
//   - pnpm add -D @playwright/test
//   - pnpm exec playwright install chromium
//   - script: "test:e2e": "playwright test"
//   - .github/workflows/ci.yml step: pnpm test:e2e
//
// Until then, this spec is the contract — anyone editing the activation
// flow keeps it green by reading + updating it alongside their changes.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("DRAGNET activation flow", () => {
  test("unauthenticated user is shown a sign-in prompt, not a redirect", async ({
    page,
  }) => {
    await page.goto("/bureau/dragnet/run");
    await expect(page.getByTestId("dragnet-run-form")).toBeVisible();

    await page
      .getByTestId("target-url")
      .fill("https://api.openai.com/v1/chat/completions");
    await page.getByTestId("probe-pack-id").fill("canon-honesty");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    // 401 path surfaces the sign-in prompt inline; the user keeps their
    // form input, no redirect-eat.
    await expect(page.getByTestId("sign-in-prompt")).toBeVisible();
    await expect(page.getByTestId("target-url")).toHaveValue(
      "https://api.openai.com/v1/chat/completions",
    );

    // The sign-in link goes to a page that exists.
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.waitForURL(/\/sign-in/);
    await expect(page.getByTestId("signin-cli-instructions")).toBeVisible();
  });

  test("authenticated user submits and lands on the phrase-id receipt page", async ({
    page,
    context,
  }) => {
    // Day-1 stub: any sb-*-auth-token cookie passes the auth gate.
    // Real Supabase verification lands with pluck-api /v1/runs.
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

    await page.goto("/bureau/dragnet/run");
    await page
      .getByTestId("target-url")
      .fill("https://api.openai.com/v1/chat/completions");
    await page.getByTestId("probe-pack-id").fill("canon-honesty");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    // Redirected to /bureau/dragnet/runs/{phrase-id}.
    await page.waitForURL(/\/bureau\/dragnet\/runs\/[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-id")).toBeVisible();
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("probe-count")).toContainText("Probes run:");

    const runId = await page.getByTestId("run-id").innerText();
    expect(runId).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });

  test("submit blocked until target + probe-pack + auth-ack are all present", async ({
    page,
  }) => {
    await page.goto("/bureau/dragnet/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page
      .getByTestId("target-url")
      .fill("https://api.openai.com/v1/chat/completions");
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("client-side guard blocks localhost target", async ({
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

    await page.goto("/bureau/dragnet/run");
    await page.getByTestId("target-url").fill("http://localhost:8080/");
    await page.getByTestId("probe-pack-id").fill("canon-honesty");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await expect(page.getByTestId("run-error")).toContainText(/localhost/i);
  });

  test("DRAGNET landing exposes the Run CTA", async ({ page }) => {
    await page.goto("/bureau/dragnet");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/dragnet\/run$/);
  });
});
