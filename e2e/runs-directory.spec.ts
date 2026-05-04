// ---------------------------------------------------------------------------
// e2e/runs-directory.spec.ts — golden test for the /runs activations hub
// ---------------------------------------------------------------------------
//
// /runs is the cross-program directory: every Bureau program wired
// through the v2 activation pattern is listed with a CTA to the run
// route. Validates that the hub stays in sync with the program
// registry — broken Run-CTA = broken activation funnel.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const ACTIVE_SLUGS = [
  "dragnet",
  "oath",
  "fingerprint",
  "custody",
  "whistle",
  "bounty",
] as const;
const COMING_SOON_SLUGS = [
  "tripwire",
  "nuclei",
  "mole",
  "sbom-ai",
  "rotate",
] as const;

test.describe("/runs activations directory", () => {
  test("renders all four active program cards", async ({ page }) => {
    await page.goto("/runs");
    for (const slug of ACTIVE_SLUGS) {
      await expect(page.getByTestId(`program-${slug}`)).toBeVisible();
      await expect(page.getByTestId(`run-cta-${slug}`)).toBeVisible();
      await expect(page.getByTestId(`landing-cta-${slug}`)).toBeVisible();
    }
    await expect(page.getByTestId("active-count")).toContainText(/6 of 11/);
  });

  test("DRAGNET CTA navigates to the run route", async ({ page }) => {
    await page.goto("/runs");
    await page.getByTestId("run-cta-dragnet").click();
    await page.waitForURL(/\/bureau\/dragnet\/run$/);
  });

  test("OATH CTA navigates to the run route", async ({ page }) => {
    await page.goto("/runs");
    await page.getByTestId("run-cta-oath").click();
    await page.waitForURL(/\/bureau\/oath\/run$/);
  });

  test("FINGERPRINT CTA navigates to the run route", async ({ page }) => {
    await page.goto("/runs");
    await page.getByTestId("run-cta-fingerprint").click();
    await page.waitForURL(/\/bureau\/fingerprint\/run$/);
  });

  test("CUSTODY CTA navigates to the run route", async ({ page }) => {
    await page.goto("/runs");
    await page.getByTestId("run-cta-custody").click();
    await page.waitForURL(/\/bureau\/custody\/run$/);
  });

  test("WHISTLE CTA navigates to the run route", async ({ page }) => {
    await page.goto("/runs");
    await page.getByTestId("run-cta-whistle").click();
    await page.waitForURL(/\/bureau\/whistle\/run$/);
  });

  test("BOUNTY CTA navigates to the run route", async ({ page }) => {
    await page.goto("/runs");
    await page.getByTestId("run-cta-bounty").click();
    await page.waitForURL(/\/bureau\/bounty\/run$/);
  });

  test("coming-soon programs are listed with reasons", async ({ page }) => {
    await page.goto("/runs");
    for (const slug of COMING_SOON_SLUGS) {
      await expect(
        page.getByTestId(`coming-soon-${slug}`),
      ).toBeVisible();
    }
  });
});
