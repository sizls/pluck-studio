// ---------------------------------------------------------------------------
// e2e/receipt-diff.spec.ts — Receipt Diff cycle
// ---------------------------------------------------------------------------
//
// Locks the diff experience end-to-end:
//   1. /diff (no since)              → instructions page
//   2. /diff/<base>?since=<target>   → diff card with two receipts
//   3. /diff/<base>?since=<diff-vendor> → different-vendors state
//   4. DRAGNET receipt CTA           → lands on /diff/<phrase>
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const OPENAI_BASE = "openai-bold-marlin-1188";
const OPENAI_TARGET = "openai-quiet-otter-2210";
const ANTHROPIC_TARGET = "anthropic-bold-marlin-1188";

test.describe("/diff — Receipt Diff", () => {
  test("renders the instructions page when ?since= is missing", async ({
    page,
  }) => {
    const res = await page.goto(`/diff/${OPENAI_BASE}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("diff-page")).toBeVisible();
    await expect(page.getByTestId("diff-instructions")).toBeVisible();
    await expect(page.getByTestId("diff-sample-link").first()).toBeVisible();
  });

  test("renders the diff card for a known same-vendor pair", async ({
    page,
  }) => {
    const res = await page.goto(
      `/diff/${OPENAI_BASE}?since=${OPENAI_TARGET}`,
    );
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("diff-ok-state")).toBeVisible();
    await expect(page.getByTestId("diff-base-receipt")).toBeVisible();
    await expect(page.getByTestId("diff-target-receipt")).toBeVisible();
    // Verdict flipped between the two openai DRAGNET slots
    // (green → amber per vendor-preview).
    await expect(page.getByTestId("diff-verdict-changed")).toBeVisible();
    await expect(page.getByTestId("diff-time-delta")).toBeVisible();
  });

  test("renders the different-vendors state for a cross-vendor pair", async ({
    page,
  }) => {
    const res = await page.goto(
      `/diff/${OPENAI_BASE}?since=${ANTHROPIC_TARGET}`,
    );
    expect(res?.status()).toBe(200);
    await expect(
      page.getByTestId("diff-different-vendors-state"),
    ).toBeVisible();
    // Both receipts STILL render for context — the diff is rejected
    // but the operator sees what they tried to compare.
    await expect(page.getByTestId("diff-base-receipt")).toBeVisible();
    await expect(page.getByTestId("diff-target-receipt")).toBeVisible();
  });

  test("renders an invalid-phrase error for garbage input", async ({
    page,
  }) => {
    const res = await page.goto(`/diff/garbage?since=${OPENAI_TARGET}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("diff-invalid-state")).toBeVisible();
    await expect(page.getByTestId("diff-invalid-error")).toBeVisible();
  });

  test("DRAGNET receipt 'Compare with another cycle' CTA → /diff/<phrase>", async ({
    page,
  }) => {
    // Go to a DRAGNET receipt page; the ReceiptView client component
    // renders the CTA as <a href="/diff/<id>">. Clicking it lands on
    // the diff instructions page (no ?since=).
    const res = await page.goto(`/bureau/dragnet/runs/${OPENAI_BASE}`);
    expect(res?.status()).toBe(200);
    const cta = page.getByTestId("next-compare");
    await expect(cta).toBeVisible();
    await Promise.all([
      page.waitForURL((url) => url.pathname === `/diff/${OPENAI_BASE}`),
      cta.click(),
    ]);
    await expect(page.getByTestId("diff-instructions")).toBeVisible();
  });

  test("/diff index page renders + links to the same-vendor sample", async ({
    page,
  }) => {
    const res = await page.goto("/diff");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("diff-index")).toBeVisible();
    await expect(page.getByTestId("diff-index-sample-link")).toBeVisible();
  });
});
