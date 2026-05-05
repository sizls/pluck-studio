// ---------------------------------------------------------------------------
// phrase-stitch.test — auto-stitch search aggregator unit tests
// ---------------------------------------------------------------------------
//
// Locks the contract: same query in → same result out, deterministic
// across renders. Tests run against vendor-preview stub data — when
// pluck-api lands, these tests rebind to live data.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  sampleSearchablePhraseIds,
  searchPhraseId,
} from "../phrase-stitch.js";

describe("searchPhraseId — invalid input", () => {
  it("returns an invalid envelope for empty query", () => {
    const result = searchPhraseId("");
    expect(result.parsed.valid).toBe(false);
    expect(result.directMatch).toBeNull();
    expect(result.relatedByScope).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("returns an invalid envelope for malformed phrase ID", () => {
    const result = searchPhraseId("not-a-phrase-id");
    expect(result.parsed.valid).toBe(false);
    expect(result.totalCount).toBe(0);
    expect(result.parsed.error).not.toBeNull();
  });

  it("flags bare phrase IDs as invalid (search needs the scoped form)", () => {
    const result = searchPhraseId("bold-marlin-1188");
    expect(result.parsed.valid).toBe(false);
    expect(result.totalCount).toBe(0);
  });
});

describe("searchPhraseId — known stub-era phrase ID", () => {
  // Pulled from vendor-preview's first openai entry
  const KNOWN = "openai-bold-marlin-1188";

  it("returns a directMatch for a known phrase ID", () => {
    const result = searchPhraseId(KNOWN);
    expect(result.parsed.valid).toBe(true);
    expect(result.parsed.scope).toBe("openai");
    expect(result.directMatch).not.toBeNull();
    expect(result.directMatch?.phraseId).toBe(KNOWN);
    expect(result.directMatch?.programSlug).toBe("dragnet");
  });

  it("returns related-by-scope receipts across multiple programs", () => {
    const result = searchPhraseId(KNOWN);
    const programSlugs = new Set(
      result.relatedByScope.map((r) => r.programSlug),
    );
    // openai vendor receipts span exactly 6 vendor-bearing programs.
    // Locking the EXACT set so a future contributor accidentally
    // narrowing vendor-preview to fewer programs trips this test.
    expect(programSlugs).toEqual(
      new Set(["custody", "dragnet", "fingerprint", "mole", "nuclei", "oath"]),
    );
    // Every related receipt MUST share the openai scope
    for (const r of result.relatedByScope) {
      expect(r.phraseId.startsWith("openai-")).toBe(true);
    }
  });

  it("does NOT include the directMatch in relatedByScope (deduped)", () => {
    const result = searchPhraseId(KNOWN);
    expect(result.directMatch).not.toBeNull();
    expect(
      result.relatedByScope.find((r) => r.phraseId === KNOWN),
    ).toBeUndefined();
  });

  it("totalCount = directMatch + relatedByScope.length", () => {
    const result = searchPhraseId(KNOWN);
    const expected =
      (result.directMatch ? 1 : 0) + result.relatedByScope.length;
    expect(result.totalCount).toBe(expected);
  });

  it("relatedByScope is sorted newest-first", () => {
    const result = searchPhraseId(KNOWN);

    for (let i = 1; i < result.relatedByScope.length; i++) {
      const prev = result.relatedByScope[i - 1]!.capturedAt.getTime();
      const cur = result.relatedByScope[i]!.capturedAt.getTime();
      expect(prev).toBeGreaterThanOrEqual(cur);
    }
  });

  it("each related result carries a receipt URL like /bureau/<slug>/runs/<phraseId>", () => {
    const result = searchPhraseId(KNOWN);
    for (const r of [
      ...(result.directMatch ? [result.directMatch] : []),
      ...result.relatedByScope,
    ]) {
      expect(r.receiptUrl).toMatch(
        new RegExp(`^/bureau/${r.programSlug}/runs/`),
      );
    }
  });

  it("is deterministic — same input → same output across calls", () => {
    const a = searchPhraseId(KNOWN);
    const b = searchPhraseId(KNOWN);
    expect(a.totalCount).toBe(b.totalCount);
    expect(a.relatedByScope.length).toBe(b.relatedByScope.length);
    expect(a.directMatch?.phraseId).toBe(b.directMatch?.phraseId);
  });

  it("normalizes input case + whitespace before searching", () => {
    const a = searchPhraseId(KNOWN);
    const b = searchPhraseId(`  ${KNOWN.toUpperCase()}  `);
    expect(b.parsed.valid).toBe(true);
    expect(b.directMatch?.phraseId).toBe(a.directMatch?.phraseId);
  });
});

describe("searchPhraseId — scope mismatch / unknown scope", () => {
  it("returns no results for a scope outside the preview vendor list", () => {
    // "hackerone" is the bounty-platform scope — valid format, not yet
    // covered by vendor-preview.
    const result = searchPhraseId("hackerone-quiet-otter-2210");
    expect(result.parsed.valid).toBe(true);
    expect(result.parsed.scope).toBe("hackerone");
    expect(result.directMatch).toBeNull();
    expect(result.relatedByScope).toEqual([]);
    expect(result.totalCount).toBe(0);
  });

  it("returns no directMatch when the phraseId doesn't exist but scope is known", () => {
    // openai is a known vendor scope, but this serial is fabricated
    const result = searchPhraseId("openai-zzzzz-zzzzz-9999");
    expect(result.parsed.valid).toBe(true);
    expect(result.directMatch).toBeNull();
    // related receipts (the real openai receipts) still surface
    expect(result.relatedByScope.length).toBeGreaterThan(0);
  });

  it("scope filter rejects cross-vendor leaks even if data drifts", () => {
    const result = searchPhraseId("openai-bold-marlin-1188");
    for (const r of result.relatedByScope) {
      expect(r.phraseId.split("-")[0]).toBe("openai");
    }
  });
});

describe("sampleSearchablePhraseIds", () => {
  it("returns at least one searchable sample", () => {
    const samples = sampleSearchablePhraseIds();
    expect(samples.length).toBeGreaterThan(0);
  });

  it("every sample round-trips through searchPhraseId with a directMatch", () => {
    const samples = sampleSearchablePhraseIds();
    for (const sample of samples) {
      const result = searchPhraseId(sample);
      expect(result.parsed.valid, sample).toBe(true);
      expect(result.directMatch, sample).not.toBeNull();
      expect(result.directMatch?.phraseId, sample).toBe(sample);
    }
  });

  it("samples are unique", () => {
    const samples = sampleSearchablePhraseIds();
    expect(new Set(samples).size).toBe(samples.length);
  });
});
