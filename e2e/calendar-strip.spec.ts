// ---------------------------------------------------------------------------
// e2e — Cron calendar strip + /monitors aggregate timeline
// ---------------------------------------------------------------------------
//
// Verifies the v3-R2 game-changer #2: every NUCLEI receipt renders the
// next 7 fires of its `recommendedInterval`, and `/monitors` aggregates
// every published pack onto a single 24h timeline.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("NUCLEI calendar strip", () => {
  test("receipt renders the calendar strip with at least one pill (@daily stub)", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "sb-test-auth-token",
        value: "x",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    // Navigate to a stub receipt URL — the receipt page renders against
    // local Directive state with the publish-pending defaults
    // (recommendedInterval = "@daily").
    await page.goto("/bureau/nuclei/runs/alice-quiet-falcon-1234");
    const strip = page.getByTestId("calendar-strip");
    await expect(strip).toBeVisible();
    const pills = page.getByTestId("calendar-pill");
    expect(await pills.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe("/monitors aggregate timeline", () => {
  test("renders the 24h timeline with at least 5 pack rows", async ({
    page,
  }) => {
    await page.goto("/monitors");
    await expect(page.getByTestId("monitors-timeline")).toBeVisible();
    const rows = page.getByTestId("monitors-row");
    expect(await rows.count()).toBeGreaterThanOrEqual(5);
    // Preview banner explicitly names the phase-stub state.
    await expect(
      page.getByTestId("monitors-preview-banner"),
    ).toContainText("Preview");
  });

  test("/runs cross-links to /monitors", async ({ page }) => {
    await page.goto("/runs");
    await expect(page.getByTestId("monitors-cross-link")).toBeVisible();
    await page.getByTestId("monitors-cross-link").getByRole("link").click();
    await page.waitForURL(/\/monitors$/);
    await expect(page.getByTestId("monitors-timeline")).toBeVisible();
  });
});
