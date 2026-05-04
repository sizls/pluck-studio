import { expect, test } from "@playwright/test";

test.describe("NUCLEI publish flow", () => {
  test("submit blocked until every required field is valid", async ({ page }) => {
    await page.goto("/bureau/nuclei/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("author").fill("alice");
    await page.getByTestId("pack-name").fill("canon-honesty@0.1");
    await page.getByTestId("sbom-rekor-uuid").fill("a".repeat(64));
    await page.getByTestId("vendor-scope").fill("openai/gpt-4o");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user publishes and lands on author-scoped phrase ID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/bureau/nuclei/run");
    await page.getByTestId("author").fill("alice");
    await page.getByTestId("pack-name").fill("canon-honesty@0.1");
    await page.getByTestId("sbom-rekor-uuid").fill("a".repeat(64));
    await page.getByTestId("vendor-scope").fill("openai/gpt-4o,anthropic/claude-3-5-sonnet");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(/\/bureau\/nuclei\/runs\/alice-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("predicate-uri")).toContainText("NucleiPackEntry/v1");
  });

  test("vendor scope count + invalid display update live", async ({ page }) => {
    await page.goto("/bureau/nuclei/run");
    await page.getByTestId("vendor-scope").fill("openai/gpt-4o,anthropic/claude-3-5-sonnet");
    await expect(page.getByTestId("vendor-scope-count")).toContainText("2 pairs");
    await page.getByTestId("vendor-scope").fill("openai/gpt-4o,foo");
    await expect(page.getByTestId("vendor-scope-invalid")).toBeVisible();
  });

  test("NUCLEI landing exposes the Publish CTA", async ({ page }) => {
    await page.goto("/bureau/nuclei");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/nuclei\/run$/);
  });
});
