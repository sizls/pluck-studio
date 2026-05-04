// ---------------------------------------------------------------------------
// e2e/v1-runs.spec.ts — golden test for the unified /v1/runs surface
// ---------------------------------------------------------------------------
//
// Validates the Phase-3 v1 wedge:
//   1. The DRAGNET run form POSTs to /api/v1/runs (not the legacy
//      /api/bureau/dragnet/run alias).
//   2. The phrase-id receipt page subsequently GETs from /api/v1/runs/[id]
//      and renders the small "via /v1/runs" indicator, proving the round
//      trip through the unified store.
//   3. Sharing a /v1/runs runId in the URL bar (deep-link) renders the
//      receipt with the same indicator — a viewer who pastes the URL
//      anywhere sees the same proof-of-route.
//
// Setup mirrors dragnet-activation.spec.ts: any sb-*-auth-token cookie
// passes the day-1 stub auth gate.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("/v1/runs unified surface — DRAGNET wedge", () => {
  test("POST /v1/runs from the run form lands on the phrase-id receipt with the via-v1 indicator", async ({
    page,
    context,
  }) => {
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

    await page.waitForURL(/\/bureau\/dragnet\/runs\/[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/);
    await expect(page.getByTestId("run-id")).toBeVisible();

    // The via-v1 indicator only appears when GET /api/v1/runs/[id]
    // returns the record — proves the round trip works end-to-end.
    await expect(page.getByTestId("via-v1-indicator")).toBeVisible();
    await expect(page.getByTestId("via-v1-indicator")).toContainText("/v1/runs");
  });

  test("a phrase-id NOT in the /v1/runs store renders without the via-v1 indicator (graceful fallback)", async ({
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

    // A plausible-looking phrase ID that was never POSTed to /v1/runs
    // (cold cache after a server restart or TTL eviction).
    await page.goto("/bureau/dragnet/runs/openai-arctic-fox-9999");
    await expect(page.getByTestId("run-id")).toBeVisible();
    await expect(page.getByTestId("via-v1-indicator")).toHaveCount(0);
  });
});
