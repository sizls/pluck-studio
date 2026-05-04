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
      // Product / model families (case-insensitive)
      /\bGPT-?\d/i,
      /\bClaude\b/i,
      /\bGemini\b/i,
      /\bLlama\b/i,
      /\bMixtral\b/i,
      /\bSonar\b/i,
      /\bGrok\b/i,
      /\bCopilot\b/i,
      // OpenAI reasoning models
      /\bo1\b/i,
      /\bo3\b/i,
      // OpenAI image / audio / video gen
      /\bDALL-E\b/i,
      /\bDALL\.E\b/i,
      /\bWhisper\b/i,
      /\bSora\b/i,
      // Hosting surfaces — banning these protects us when the underlying
      // model name (Claude/Llama/Mistral) might otherwise sneak in via a
      // "hosted on …" phrasing.
      /\bBedrock\b/i,
      /\bAzure\s+OpenAI\b/i,
      // Consumer products distinct from API-tier names
      /\bChatGPT\b/i,
      /\bAnthropic\s+API\b/i,
      // Vendor URLs / well-known endpoints
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

  it("no receipt summary names a vendor company directly", () => {
    // Vendor company names should never appear in the summary itself —
    // vendor identity is encoded in the phrase-ID prefix and the page
    // header. A summary that names the vendor undermines the symmetric
    // "every vendor renders identically" guarantee. Case-sensitive so
    // mid-word matches (e.g. "metadata" containing "meta") don't false-
    // positive — the risk is a copywriter typing the brand, not a
    // lowercase noun collision.
    const bannedCompanies: ReadonlyArray<RegExp> = [
      /\bOpenAI\b/,
      /\bAnthropic\b/,
      /\bGoogle\b/,
      /\bMeta\b/,
      /\bMistral\b/,
      /\bCohere\b/,
      /\bPerplexity\b/,
      /\bDeepSeek\b/,
      /\bxAI\b/,
      /\bMicrosoft\b/,
    ];
    for (const slug of listVendorSlugs()) {
      const preview = getVendorPreview(slug);
      const p = preview as NonNullable<typeof preview>;
      for (const program of p.programs) {
        for (const r of program.receipts) {
          for (const re of bannedCompanies) {
            expect(
              re.test(r.summary),
              `${slug}/${r.phraseId} summary names a vendor company ${re}: "${r.summary}"`,
            ).toBe(false);
          }
        }
      }
    }
  });
});
