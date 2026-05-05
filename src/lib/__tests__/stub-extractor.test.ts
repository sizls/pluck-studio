// ---------------------------------------------------------------------------
// stub-extractor — unit tests
// ---------------------------------------------------------------------------
//
// Locks the contract on the v3-R1 Backlog #8 hand-curated extractor:
//   1. Returns 3-5 claims per call.
//   2. Vendor hint maps to vendor-themed claims (openai → openai, etc.).
//   3. Every claim ends with the "(illustrative — verify before probing)"
//      suffix — load-bearing for the defamation guard.
//   4. Mixed confidence levels surface across the result set.
//   5. Non-data-URL inputs throw before doing any work (cheap hardening).
//
// The illustrative-suffix invariant is the most important assertion in
// this file — if it ever drifts, the page can show a vendor claim that
// reads as a verified fact. This must remain green forever.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  extractAssertionsStub,
  ILLUSTRATIVE_SUFFIX,
} from "../extract/stub-extractor";

const FAKE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

describe("extractAssertionsStub", () => {
  it("returns 3-5 claims for the OpenAI hint", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "openai");
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("returns 3-5 claims for the Anthropic hint", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "anthropic");
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("returns 3-5 claims for the Google hint", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "gemini");
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("returns 3-5 claims with no hint (generic fallback)", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("OpenAI hint maps to OpenAI-themed claims", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "openai");
    for (const a of result) {
      expect(a.vendor).toBe("openai");
    }
  });

  it("Anthropic hint maps to Anthropic-themed claims", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "anthropic");
    for (const a of result) {
      expect(a.vendor).toBe("anthropic");
    }
  });

  it("Google/Gemini hint maps to google-themed claims", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "google");
    for (const a of result) {
      expect(a.vendor).toBe("google");
    }
  });

  it("partial / case-insensitive hints still match (OpenAI)", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "OpenAI.com");
    for (const a of result) {
      expect(a.vendor).toBe("openai");
    }
  });

  it("unrecognized hint falls through to the generic set", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "ToTallyMadeUp");
    expect(result.length).toBeGreaterThanOrEqual(3);
    for (const a of result) {
      expect(a.vendor).toBe("unknown");
    }
  });

  it("EVERY claim ends with the illustrative suffix (defamation guard)", async () => {
    const hints = [undefined, "openai", "anthropic", "gemini", "asdfqwerty"];
    for (const h of hints) {
      const result = await extractAssertionsStub(FAKE_DATA_URL, h);
      for (const a of result) {
        expect(a.claim.endsWith(ILLUSTRATIVE_SUFFIX)).toBe(true);
      }
    }
  });

  it("the illustrative suffix is exactly the documented string", () => {
    // Lock the suffix copy itself — anyone editing it should know they're
    // touching the defamation-guard surface and will need to revisit the
    // page tests + e2e.
    expect(ILLUSTRATIVE_SUFFIX).toBe("(illustrative — verify before probing)");
  });

  it("at least one claim per vendor sample mixes confidence levels", async () => {
    const hints = ["openai", "anthropic", "gemini", "asdfqwerty"];
    for (const h of hints) {
      const result = await extractAssertionsStub(FAKE_DATA_URL, h);
      const seen = new Set(result.map((a) => a.confidence));
      expect(seen.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("rejects non-data-URL inputs", async () => {
    await expect(
      extractAssertionsStub("https://example.com/foo.png"),
    ).rejects.toThrow(/data: URL/);
    await expect(extractAssertionsStub("")).rejects.toThrow(/data: URL/);
  });

  it("populates testableForm + rationale on every claim", async () => {
    const result = await extractAssertionsStub(FAKE_DATA_URL, "openai");
    for (const a of result) {
      expect(a.testableForm.length).toBeGreaterThan(10);
      expect(a.rationale.length).toBeGreaterThan(10);
    }
  });
});
