// ---------------------------------------------------------------------------
// Vendor Honesty Index — runtime invariants
// ---------------------------------------------------------------------------
//
// Locks the load-bearing legal/UX invariants on the vendor-preview data:
//   1. Every vendor has IDENTICAL verdict distribution (5/2/0/1 for
//      green/amber/red/gray). No vendor is painted worse than another.
//   2. Every summary ends with "(illustrative)" — defangs the defamation
//      surface.
//   3. No summary mentions a real product, model family, or vendor URL.
//   4. VENDOR_BEARING_PROGRAMS in the registry exposes exactly the 6
//      vendor-surfacing programs.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { VENDOR_BEARING_PROGRAMS } from "../registry.js";
import { getVendorPreview } from "../vendor-preview.js";
import { listVendorSlugs } from "../vendor-registry.js";

describe("VHI verdict distribution", () => {
  it("every vendor has identical verdict distribution and 8 receipts", () => {
    for (const slug of listVendorSlugs()) {
      const preview = getVendorPreview(slug);
      expect(preview, `preview for ${slug}`).not.toBeNull();
      const p = preview as NonNullable<typeof preview>;
      expect(p.totalReceipts, `total for ${slug}`).toBe(8);
      expect(p.verdictBreakdown).toEqual({
        green: 5,
        amber: 2,
        red: 0,
        gray: 1,
      });
    }
  });

  it("every receipt summary ends with (illustrative)", () => {
    for (const slug of listVendorSlugs()) {
      const preview = getVendorPreview(slug);
      const p = preview as NonNullable<typeof preview>;
      for (const program of p.programs) {
        for (const r of program.receipts) {
          expect(
            r.summary.endsWith("(illustrative)"),
            `${slug}/${r.phraseId}: ${r.summary}`,
          ).toBe(true);
        }
      }
    }
  });

  it("VENDOR_BEARING_PROGRAMS lists exactly the 6 vendor-bearing programs", () => {
    expect(VENDOR_BEARING_PROGRAMS.length).toBe(6);
    const slugs = VENDOR_BEARING_PROGRAMS.map((p) => p.slug).sort();
    expect(slugs).toEqual([
      "custody",
      "dragnet",
      "fingerprint",
      "mole",
      "nuclei",
      "oath",
    ]);
  });

  it("every receipt summary is short (cap at 20 words)", () => {
    for (const slug of listVendorSlugs()) {
      const preview = getVendorPreview(slug);
      const p = preview as NonNullable<typeof preview>;
      for (const program of p.programs) {
        for (const r of program.receipts) {
          const wordCount = r.summary.split(/\s+/).length;
          expect(
            wordCount,
            `summary too long: "${r.summary}" (${wordCount} words)`,
          ).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("no receipt summary names a real product, model family, or vendor URL", () => {
    const banned: ReadonlyArray<RegExp> = [
      /\bGPT-?\d/i,
      /\bClaude\b/i,
      /\bGemini\b/i,
      /\bLlama\b/i,
      /\bMixtral\b/i,
      /\bSonar\b/i,
      /\bGrok\b/i,
      /\bCopilot\b/i,
      /api\.[a-z]+\.(com|ai|dev)/i,
      /\.well-known\/pluck-oath\.json/i,
    ];
    for (const slug of listVendorSlugs()) {
      const preview = getVendorPreview(slug);
      const p = preview as NonNullable<typeof preview>;
      for (const program of p.programs) {
        for (const r of program.receipts) {
          for (const re of banned) {
            expect(
              re.test(r.summary),
              `${slug}/${r.phraseId} summary trips banned pattern ${re}: "${r.summary}"`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
