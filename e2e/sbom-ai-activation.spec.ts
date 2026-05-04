import { expect, test } from "@playwright/test";

test.describe("SBOM-AI activation flow", () => {
  test("submit blocked until URL + ack present", async ({ page }) => {
    await page.goto("/bureau/sbom-ai/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("artifact-url").fill("https://example.com/pack.json");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user publishes and lands on kind-scoped phrase ID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/bureau/sbom-ai/run");
    await page.getByTestId("artifact-url").fill("https://example.com/pack.json");
    await page.getByTestId("kind-mcp-server").check();
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(/\/bureau\/sbom-ai\/runs\/[a-z]+-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
  });

  test("submit button stays disabled when expectedSha256 is malformed", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto("/bureau/sbom-ai/run");
    await page.getByTestId("artifact-url").fill("https://example.com/pack.json");
    await page.getByTestId("auth-ack").check();
    // With auth-ack + URL + no hash → enabled.
    await expect(page.getByTestId("run-submit")).toBeEnabled();
    // Add a malformed hash → form module's canSubmit derivation
    // flips false; button disables. Cleaner UX than letting the
    // user click and see a toast.
    await page.getByTestId("expected-sha256").fill("not-hex");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    // Clear the hash → re-enabled.
    await page.getByTestId("expected-sha256").fill("");
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("SBOM-AI landing exposes the Publish CTA", async ({ page }) => {
    await page.goto("/bureau/sbom-ai");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/sbom-ai\/run$/);
  });
});
