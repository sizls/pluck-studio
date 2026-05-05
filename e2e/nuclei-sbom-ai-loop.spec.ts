// ---------------------------------------------------------------------------
// SBOM-AI ↔ NUCLEI auto-link CTA — supply-chain loop E2E
// ---------------------------------------------------------------------------
//
// Closes the v3-R1 Backlog #3 game-changer. Three slices:
//
//   1. NUCLEI form prefill via ?sbomRekorUuid=&packName= — operator
//      lands on /bureau/nuclei/run with the cross-reference fields
//      already filled and the prefill banner rendered.
//   2. NUCLEI form prefill validates — submit-enabled gate respects
//      the seeded values (no manual re-typing required).
//   3. SBOM-AI receipt CTA gating — non-probe-pack receipts must NOT
//      surface the CTA (the `data-testid="nuclei-publish-cta"`
//      element is absent). The visibility matrix is unit-tested in
//      NucleiPublishCta.test.tsx; the E2E pins the live render path
//      to catch any regression in the receipt wiring.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const REKOR_UUID =
  "deadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00ddeadbeefcafef00d";
const PACK = "canon-honesty@0.1";

test.describe("SBOM-AI → NUCLEI auto-link CTA", () => {
  test("NUCLEI form pre-fills sbomRekorUuid + packName from query params", async ({
    page,
  }) => {
    await page.goto(
      `/bureau/nuclei/run?sbomRekorUuid=${REKOR_UUID}&packName=${encodeURIComponent(PACK)}`,
    );

    // Banner renders only when at least one prefill param is present.
    await expect(page.getByTestId("nuclei-prefill-banner")).toBeVisible();
    await expect(page.getByTestId("nuclei-prefill-banner")).toContainText(
      "Pre-filled from",
    );

    // Both fields seeded.
    await expect(page.getByTestId("sbom-rekor-uuid")).toHaveValue(REKOR_UUID);
    await expect(page.getByTestId("pack-name")).toHaveValue(PACK);
  });

  test("prefilled NUCLEI form is one-author + one-ack away from submit-enabled", async ({
    page,
  }) => {
    await page.goto(
      `/bureau/nuclei/run?sbomRekorUuid=${REKOR_UUID}&packName=${encodeURIComponent(PACK)}`,
    );

    // Submit still disabled — author + vendor scope + auth-ack are
    // operator-supplied. Pre-filling only carries the cross-reference.
    await expect(page.getByTestId("run-submit")).toBeDisabled();

    await page.getByTestId("author").fill("alice");
    await page.getByTestId("vendor-scope").fill("openai/gpt-4o");
    await page.getByTestId("auth-ack").check();

    await expect(page.getByTestId("run-submit")).toBeEnabled();
  });

  test("NUCLEI form does NOT show the prefill banner without query params", async ({
    page,
  }) => {
    await page.goto("/bureau/nuclei/run");
    await expect(page.getByTestId("nuclei-prefill-banner")).toHaveCount(0);
  });

  test("SBOM-AI stub receipt does NOT surface the CTA when artifactKind is unknown", async ({
    page,
  }) => {
    // Stub-rendered receipt for an arbitrary (non-existent) phrase ID:
    // the receipt module init leaves `artifactKind = null` and the
    // CTA gate hides itself. This pins the safety property — random
    // run IDs never spuriously surface the cross-publish CTA.
    await page.goto("/bureau/sbom-ai/runs/probepack-swift-falcon-3742");
    await expect(page.getByTestId("nuclei-publish-cta")).toHaveCount(0);
  });

  test("NUCLEI stub receipt does NOT surface the back-link without an SBOM-AI rekor UUID", async ({
    page,
  }) => {
    // Mirrors the CTA-gate pin: stub NUCLEI receipts for arbitrary
    // phrase IDs init `sbomRekorUuid = null`, so the back-link must
    // hide rather than render an empty code block.
    await page.goto("/bureau/nuclei/runs/alice-swift-falcon-3742");
    await expect(page.getByTestId("sbom-ai-source-artifact")).toHaveCount(0);
  });

  test("/runs page surfaces the supply-chain loop callout", async ({
    page,
  }) => {
    await page.goto("/runs");
    await expect(
      page.getByTestId("sbom-ai-nuclei-loop-cross-link"),
    ).toBeVisible();
    await expect(
      page.getByTestId("sbom-ai-nuclei-loop-cross-link"),
    ).toContainText("Publish to NUCLEI registry");
  });
});
