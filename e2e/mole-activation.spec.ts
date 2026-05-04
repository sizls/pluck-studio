import { expect, test } from "@playwright/test";

test.describe("MOLE seal flow", () => {
  test("submit blocked until every required field present", async ({ page }) => {
    await page.goto("/bureau/mole/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("canary-id").fill("nyt-2024-01-15");
    await page.getByTestId("canary-url").fill("https://example.com/canary.txt");
    await page
      .getByTestId("fingerprint-phrases")
      .fill("first unique-enough fingerprint phrase, second unique-enough phrase");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user seals + lands on canary-id-scoped phrase ID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/bureau/mole/run");
    await page.getByTestId("canary-id").fill("nyt-2024-01-15");
    await page.getByTestId("canary-url").fill("https://example.com/canary.txt");
    await page
      .getByTestId("fingerprint-phrases")
      .fill("first unique-enough fingerprint phrase, second unique-enough phrase");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(/\/bureau\/mole\/runs\/nyt20240115-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("canary-predicate")).toContainText(
      "CanaryDocument/v1",
    );
  });

  test("fingerprint count + invalid update live", async ({ page }) => {
    await page.goto("/bureau/mole/run");
    await page
      .getByTestId("fingerprint-phrases")
      .fill("first unique-enough fingerprint, second unique-enough phrase");
    await expect(page.getByTestId("fingerprint-count")).toContainText("2 phrases");
    await page.getByTestId("fingerprint-phrases").fill("short");
    await expect(page.getByTestId("fingerprint-invalid")).toBeVisible();
  });

  test("MOLE landing exposes the Seal CTA", async ({ page }) => {
    await page.goto("/bureau/mole");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/mole\/run$/);
  });
});
