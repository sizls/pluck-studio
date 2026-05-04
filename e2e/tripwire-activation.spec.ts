import { expect, test } from "@playwright/test";

test.describe("TRIPWIRE configuration flow", () => {
  test("submit blocked until machineId + ack present", async ({ page }) => {
    await page.goto("/bureau/tripwire/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("machine-id").fill("alice-mbp");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user configures and lands on machine-scoped phrase ID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/bureau/tripwire/run");
    await page.getByTestId("machine-id").fill("alice-mbp");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    // Phrase prefix is the machine ID, hyphens stripped (slug normalization).
    await page.waitForURL(/\/bureau\/tripwire\/runs\/alicembp-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("predicate-uri")).toContainText("TripwirePolicy/v1");
  });

  test("custom policy reveals URL field", async ({ page }) => {
    await page.goto("/bureau/tripwire/run");
    await expect(page.getByTestId("custom-policy-url")).toHaveCount(0);
    await page.getByTestId("policy-custom").check();
    await expect(page.getByTestId("custom-policy-url")).toBeVisible();
  });

  test("TRIPWIRE landing exposes the Configure CTA", async ({ page }) => {
    await page.goto("/bureau/tripwire");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/tripwire\/run$/);
  });
});
