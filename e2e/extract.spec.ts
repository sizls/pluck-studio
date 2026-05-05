// ---------------------------------------------------------------------------
// e2e/extract.spec.ts — paste-a-screenshot probe extractor flow
// ---------------------------------------------------------------------------
//
// v3-R1 Backlog #8 game-changer. The contract this suite locks:
//
//   1. /extract renders the dropzone, hint input, and the privacy +
//      stub-era callouts.
//   2. Uploading an image (file input — Playwright's most reliable
//      mechanism for getting a file into the page; clipboard image paste
//      is browser-implementation-specific) shows a preview + extract CTA.
//   3. Clicking "Extract assertions" surfaces ≥ 1 ExtractedAssertion row
//      and EVERY visible row carries the "(illustrative — verify before
//      probing)" suffix.
//   4. Clicking "Probe with DRAGNET" on a row navigates to the run form
//      with `?vendor=` and `?assertion=` pre-filled — and the prefill
//      banner is visible on the run form.
//   5. Defamation guard: extraction NEVER auto-submits; the run-submit
//      button stays its normal disabled-until-auth-ack state after
//      pre-fill.
//
// 1×1 PNG is enough — the stub doesn't actually inspect the image bytes
// (real LLM swap is a future commit).
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

test.describe("Screenshot probe extractor", () => {
  test("renders the dropzone + privacy + stub-era callouts", async ({
    page,
  }) => {
    await page.goto("/extract");
    await expect(page.getByTestId("extract-page")).toBeVisible();
    await expect(page.getByTestId("extract-dropzone")).toBeVisible();
    await expect(page.getByTestId("extract-privacy-callout")).toContainText(
      /stays in your browser/i,
    );
    await expect(page.getByTestId("extract-stub-callout")).toContainText(
      /Stub-era/i,
    );
  });

  test("upload → extract → results → probe-with-dragnet round-trip", async ({
    page,
  }) => {
    await page.goto("/extract");

    // Type in the vendor hint so the stub returns OpenAI-themed claims.
    await page.getByTestId("extract-hint").fill("openai");

    // Upload a 1x1 PNG via the hidden file input. Playwright handles the
    // file-chooser input directly; clipboard image paste is too
    // browser-specific to lean on.
    await page.getByTestId("extract-file-input").setInputFiles({
      name: "claim.png",
      mimeType: "image/png",
      buffer: Buffer.from(TINY_PNG_BASE64, "base64"),
    });

    await expect(page.getByTestId("extract-preview")).toBeVisible();
    await expect(page.getByTestId("extract-cta")).toBeEnabled();

    await page.getByTestId("extract-cta").click();

    // ≥ 1 result row visible.
    const rows = page.getByTestId("extracted-assertion");
    await expect(rows.first()).toBeVisible();
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(3);
    expect(count).toBeLessThanOrEqual(5);

    // Defamation guard: every visible claim row carries the illustrative
    // suffix. If this assertion ever flips, somebody removed the safety
    // net — the suite must fail loudly.
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i)).toContainText(
        /\(illustrative — verify before probing\)/,
      );
    }

    // Click the first "Probe with DRAGNET" CTA. We expect to land on the
    // run form with both query params populated.
    await page.getByTestId("probe-with-dragnet-cta").first().click();
    await page.waitForURL(/\/bureau\/dragnet\/run\?.*vendor=.*assertion=/);
    await expect(page.getByTestId("dragnet-prefill-banner")).toBeVisible();
    await expect(page.getByTestId("dragnet-prefill-assertion")).toBeVisible();

    // Defamation guard #2: the form did NOT auto-submit. The submit
    // button is gated on auth-ack; we never checked it, so it stays
    // disabled. (Even if pre-fill is lossy and the URL is missing, this
    // invariant must hold — the user has to consent, every time.)
    await expect(page.getByTestId("run-submit")).toBeDisabled();
  });

  test("non-image file shows an error", async ({ page }) => {
    await page.goto("/extract");
    await page.getByTestId("extract-file-input").setInputFiles({
      name: "claim.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image", "utf-8"),
    });
    await expect(page.getByTestId("extract-error")).toContainText(/image/i);
  });

  test("/runs cross-link surfaces the extractor", async ({ page }) => {
    await page.goto("/runs");
    await expect(page.getByTestId("extract-cross-link")).toContainText(
      /screenshot/i,
    );
    // The cross-link goes to /extract.
    await page.getByTestId("extract-cross-link").getByRole("link").click();
    await page.waitForURL(/\/extract$/);
    await expect(page.getByTestId("extract-page")).toBeVisible();
  });
});
