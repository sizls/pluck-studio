import { expect, test } from "@playwright/test";

test.describe("BOUNTY activation flow", () => {
  test("submit blocked until all required fields + ack are present", async ({ page }) => {
    await page.goto("/bureau/bounty/run");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("source-rekor-uuid").fill("a".repeat(64));
    await page.getByTestId("program").fill("openai");
    await page.getByTestId("vendor").fill("openai");
    await page.getByTestId("model").fill("gpt-4o");
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user files and lands on platform-scoped phrase ID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/bureau/bounty/run");
    await page.getByTestId("source-rekor-uuid").fill("a".repeat(64));
    await page.getByTestId("target-bugcrowd").check();
    await page.getByTestId("program").fill("openai");
    await page.getByTestId("vendor").fill("openai");
    await page.getByTestId("model").fill("gpt-4o");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(/\/bureau\/bounty\/runs\/bugcrowd-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("evidence-predicate")).toContainText("EvidencePacket/v1");
  });

  test("client-side guard rejects malformed Rekor UUID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto("/bureau/bounty/run");
    await page.getByTestId("source-rekor-uuid").fill("not-hex");
    await page.getByTestId("program").fill("openai");
    await page.getByTestId("vendor").fill("openai");
    await page.getByTestId("model").fill("gpt-4o");
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();
    await expect(page.getByTestId("run-error")).toContainText(/64.{1,5}80 hex/i);
  });

  test("BOUNTY landing exposes the File CTA", async ({ page }) => {
    await page.goto("/bureau/bounty");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/bounty\/run$/);
  });
});
