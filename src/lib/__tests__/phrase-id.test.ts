import { describe, expect, it } from "vitest";

import {
  generatePhraseId,
  isPhraseId,
  phraseFromBytes,
  PHRASE_ID_VOCAB_SIZE,
} from "../phrase-id.js";

describe("phraseFromBytes", () => {
  it("produces an adjective-animal-NNNN shape", () => {
    const phrase = phraseFromBytes(0, 0, 0);
    expect(phrase).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });

  it("zero-pads the number to 4 digits", () => {
    expect(phraseFromBytes(0, 0, 7)).toMatch(/-0007$/);
    expect(phraseFromBytes(0, 0, 9999)).toMatch(/-9999$/);
  });

  it("clamps the number into 0000-9999", () => {
    expect(phraseFromBytes(0, 0, 10_000)).toMatch(/-0000$/);
    expect(phraseFromBytes(0, 0, 65_535)).toMatch(/-\d{4}$/);
  });

  it("is stable for identical input bytes", () => {
    expect(phraseFromBytes(42, 17, 1234)).toBe(phraseFromBytes(42, 17, 1234));
  });

  it("byte indices wrap modulo wordlist length", () => {
    // ADJECTIVES.length and ANIMALS.length are both 80; 160 % 80 == 0
    expect(phraseFromBytes(0, 0, 0)).toBe(phraseFromBytes(160, 160, 0));
  });

  it("contains no whitespace and only [a-z0-9-]", () => {
    for (let i = 0; i < 50; i++) {
      const p = phraseFromBytes(i * 3, i * 5, i * 7);
      expect(p).toMatch(/^[a-z0-9-]+$/);
      expect(p).not.toMatch(/\s/);
    }
  });
});

describe("generatePhraseId", () => {
  it("returns a valid phrase shape", () => {
    expect(isPhraseId(generatePhraseId())).toBe(true);
  });

  it("produces different phrases over many invocations (entropy sanity)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      seen.add(generatePhraseId());
    }
    // 200 draws from 64M-element space — near-certain to be unique.
    expect(seen.size).toBeGreaterThan(190);
  });
});

describe("isPhraseId", () => {
  it("accepts the canonical shape", () => {
    expect(isPhraseId("swift-falcon-3742")).toBe(true);
    expect(isPhraseId("amber-otter-0000")).toBe(true);
  });

  it("rejects UUIDs", () => {
    expect(isPhraseId("0c2d8a4e-3f4a-4cf8-9c9c-c8b1c4f0c2d8")).toBe(false);
  });

  it("rejects malformed shapes", () => {
    expect(isPhraseId("falcon-3742")).toBe(false);
    expect(isPhraseId("swift-falcon-37")).toBe(false);
    expect(isPhraseId("Swift-falcon-3742")).toBe(false);
    expect(isPhraseId("swift_falcon_3742")).toBe(false);
    expect(isPhraseId("")).toBe(false);
  });
});

describe("PHRASE_ID_VOCAB_SIZE", () => {
  it("is 80 × 80 × 10_000 = 64_000_000 (the docs promise)", () => {
    expect(PHRASE_ID_VOCAB_SIZE).toBe(64_000_000);
  });
});
