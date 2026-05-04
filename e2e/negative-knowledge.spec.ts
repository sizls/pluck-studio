// ---------------------------------------------------------------------------
// e2e/negative-knowledge.spec.ts — golden test for /what-we-dont-know
// ---------------------------------------------------------------------------
//
// The negative-knowledge page lists, per program, what Studio refuses
// to know about an operator's operation. The cards are driven from
// PROGRAM_PRIVACY_POSTURE in lib/programs/registry.ts; this spec locks
// the load-bearing claims so a future PR can't silently drop the
// disclosure that makes the page meaningful.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const ALL_PROGRAMS = [
  "DRAGNET",
  "OATH",
  "FINGERPRINT",
  "CUSTODY",
  "WHISTLE",
  "BOUNTY",
  "SBOM-AI",
  "ROTATE",
  "TRIPWIRE",
  "NUCLEI",
  "MOLE",
] as const;

test.describe("/what-we-dont-know negative-knowledge page", () => {
  test("renders all 11 program posture cards", async ({ page }) => {
    await page.goto("/what-we-dont-know");
    for (const name of ALL_PROGRAMS) {
      await expect(
        page.getByRole("heading", { name, level: 3 }),
      ).toBeVisible();
    }
  });

  test("MOLE card surfaces the canary-body claim", async ({ page }) => {
    await page.goto("/what-we-dont-know");
    const moleCard = page.getByTestId("posture-mole");
    await expect(moleCard).toBeVisible();
    await expect(moleCard).toContainText(/canary body/i);
  });

  test("WHISTLE card surfaces the source-identity claim", async ({ page }) => {
    await page.goto("/what-we-dont-know");
    const whistleCard = page.getByTestId("posture-whistle");
    await expect(whistleCard).toBeVisible();
    await expect(whistleCard).toContainText(/source identity/i);
  });

  test("BOUNTY card surfaces the auth-token claim", async ({ page }) => {
    await page.goto("/what-we-dont-know");
    const bountyCard = page.getByTestId("posture-bounty");
    await expect(bountyCard).toBeVisible();
    await expect(bountyCard).toContainText(/auth token/i);
  });

  test("footer surfaces the phrase-ID claim", async ({ page }) => {
    await page.goto("/what-we-dont-know");
    const footer = page.getByTestId("negative-knowledge-footer");
    await expect(footer).toBeVisible();
    await expect(footer).toContainText(/phrase-ID/i);
  });
});
