import { expect, test } from "@playwright/test";

test.describe("ROTATE activation flow", () => {
  test("submit blocked when keys are equal (no-op rotation)", async ({ page }) => {
    await page.goto("/bureau/rotate/run");
    await page.getByTestId("old-key-fingerprint").fill("a".repeat(64));
    await page.getByTestId("new-key-fingerprint").fill("a".repeat(64));
    await page.getByTestId("auth-ack").check();
    await expect(page.getByTestId("run-submit")).toBeDisabled();
    await expect(page.getByTestId("same-keys-warning")).toBeVisible();
    // Differing keys re-enables
    await page.getByTestId("new-key-fingerprint").fill("b".repeat(64));
    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("authenticated user rotates and lands on reason-scoped phrase ID", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/bureau/rotate/run");
    await page.getByTestId("old-key-fingerprint").fill("a".repeat(64));
    await page.getByTestId("new-key-fingerprint").fill("b".repeat(64));
    await page.getByTestId("reason-routine").check();
    await page.getByTestId("auth-ack").check();
    await page.getByTestId("run-submit").click();

    await page.waitForURL(/\/bureau\/rotate\/runs\/routine-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-status")).toContainText(/pending/);
    await expect(page.getByTestId("revocation-predicate")).toContainText(
      "KeyRevocation/v1",
    );
    await expect(page.getByTestId("rewitness-predicate")).toContainText(
      "ReWitnessReport/v1",
    );
  });

  test("client-side guard rejects malformed fingerprint", async ({ page, context }) => {
    await context.addCookies([
      { name: "sb-test-auth-token", value: "x", domain: "localhost", path: "/", sameSite: "Lax" },
    ]);
    await page.goto("/bureau/rotate/run");
    await page.getByTestId("old-key-fingerprint").fill("not-hex");
    await page.getByTestId("new-key-fingerprint").fill("b".repeat(64));
    await page.getByTestId("auth-ack").check();
    // canSubmit-derivation gates on isValidSpkiFingerprint, so the
    // button stays disabled — same posture as SBOM-AI's malformed
    // hash test.
    await expect(page.getByTestId("run-submit")).toBeDisabled();
  });

  test("ROTATE landing exposes the Rotate CTA", async ({ page }) => {
    await page.goto("/bureau/rotate");
    await expect(page.getByTestId("run-cta")).toBeVisible();
    await page.getByTestId("run-cta").click();
    await page.waitForURL(/\/bureau\/rotate\/run$/);
  });
});
