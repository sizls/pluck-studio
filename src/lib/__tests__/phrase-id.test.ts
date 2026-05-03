import { describe, expect, it } from "vitest";

import {
  generatePhraseId,
  generateScopedPhraseId,
  isPhraseId,
  isUuid,
  phraseFromBytes,
  PHRASE_ID_VOCAB_SIZE,
  vendorFromPhrase,
  vendorSlugFromUrl,
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

describe("vendorSlugFromUrl", () => {
  it("returns the registered domain label for common vendor URLs", () => {
    expect(vendorSlugFromUrl("https://api.openai.com/v1/chat")).toBe("openai");
    expect(vendorSlugFromUrl("https://api.anthropic.com/v1/messages")).toBe(
      "anthropic",
    );
    // `generativelanguage` is the first label and isn't an infra prefix
    // (it's the product surface). Truncated to 16 chars per the slug cap.
    expect(vendorSlugFromUrl("https://generativelanguage.googleapis.com")).toBe(
      "generativelangua",
    );
  });

  it("strips infra subdomain prefixes (www, api, app, console, etc.)", () => {
    expect(vendorSlugFromUrl("https://www.openai.com")).toBe("openai");
    expect(vendorSlugFromUrl("https://app.linear.app")).toBe("linear");
    expect(vendorSlugFromUrl("https://console.anthropic.com")).toBe(
      "anthropic",
    );
    expect(vendorSlugFromUrl("https://chat.openai.com/")).toBe("openai");
    expect(vendorSlugFromUrl("https://platform.openai.com/playground")).toBe(
      "openai",
    );
  });

  it("returns 'unknown' for IP addresses, garbage, or empty input", () => {
    expect(vendorSlugFromUrl("http://10.0.0.1")).toBe("unknown");
    expect(vendorSlugFromUrl("https://127.0.0.1:8080")).toBe("unknown");
    expect(vendorSlugFromUrl("not-a-url")).toBe("unknown");
    expect(vendorSlugFromUrl("")).toBe("unknown");
  });

  it("handles hyphen-bearing labels by stripping non-[a-z0-9]", () => {
    expect(vendorSlugFromUrl("https://my-vendor.com")).toBe("myvendor");
    expect(vendorSlugFromUrl("https://x_y_z.example.com")).toBe("xyz");
  });

  it("truncates long labels at 16 chars", () => {
    expect(
      vendorSlugFromUrl(
        "https://supercalifragilisticexpialidocious.example.com",
      ),
    ).toHaveLength(16);
  });

  it("lowercases", () => {
    expect(vendorSlugFromUrl("https://API.OPENAI.com")).toBe("openai");
  });
});

describe("isUuid", () => {
  it("accepts canonical RFC 4122 UUIDs", () => {
    expect(isUuid("0c2d8a4e-3f4a-4cf8-9c9c-c8b1c4f0c2d8")).toBe(true);
    expect(isUuid("00000000-0000-0000-0000-000000000000")).toBe(true);
  });

  it("rejects phrase IDs and other shapes", () => {
    expect(isUuid("swift-falcon-3742")).toBe(false);
    expect(isUuid("openai-swift-falcon-3742")).toBe(false);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("")).toBe(false);
  });
});

describe("vendorFromPhrase", () => {
  it("extracts the vendor slug from scoped phrase IDs", () => {
    expect(vendorFromPhrase("openai-swift-falcon-3742")).toBe("openai");
    expect(vendorFromPhrase("anthropic-amber-otter-1234")).toBe("anthropic");
  });

  it("returns null for bare phrase IDs (R1 format)", () => {
    expect(vendorFromPhrase("swift-falcon-3742")).toBeNull();
  });

  it("returns null for UUIDs", () => {
    expect(vendorFromPhrase("0c2d8a4e-3f4a-4cf8-9c9c-c8b1c4f0c2d8")).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(vendorFromPhrase("")).toBeNull();
    expect(vendorFromPhrase("not-a-phrase")).toBeNull();
    expect(vendorFromPhrase("openai-swift-falcon-37")).toBeNull();
  });
});

describe("generateScopedPhraseId", () => {
  it("prefixes with the vendor slug from the target URL", () => {
    const id = generateScopedPhraseId("https://api.openai.com/v1/chat");
    expect(id).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
  });

  it("falls back to 'unknown' prefix for unparseable targets", () => {
    const id = generateScopedPhraseId("not-a-url");
    expect(id).toMatch(/^unknown-[a-z]+-[a-z]+-\d{4}$/);
  });

  it("isPhraseId accepts both bare and scoped forms", () => {
    expect(isPhraseId("swift-falcon-3742")).toBe(true);
    expect(isPhraseId("openai-swift-falcon-3742")).toBe(true);
  });
});
