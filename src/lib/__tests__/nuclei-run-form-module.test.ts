import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  ALLOWED_LICENSES,
  isAllowedLicense,
  isValidAuthor,
  isValidPackName,
  isValidRekorUuid,
  nucleiRunFormModule,
  parseVendorScope,
  validateCron,
} from "../nuclei/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: nucleiRunFormModule });
  sys.start();
  return sys;
}

describe("nucleiRunFormModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with sensible defaults", () => {
    const sys = setup();
    expect(sys.facts.license).toBe("MIT");
    expect(sys.facts.recommendedInterval).toBe("0 */4 * * *");
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit requires every field including SBOM cross-ref", () => {
    const sys = setup();
    sys.facts.author = "alice";
    sys.facts.packName = "canon-honesty@0.1";
    sys.facts.sbomRekorUuid = "a".repeat(64);
    sys.facts.vendorScope = "openai/gpt-4o";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks malformed sbomRekorUuid (TOFU enforcement)", () => {
    const sys = setup();
    sys.facts.author = "alice";
    sys.facts.packName = "canon-honesty@0.1";
    sys.facts.sbomRekorUuid = "not-hex";
    sys.facts.vendorScope = "openai/gpt-4o";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks malformed vendor scope", () => {
    const sys = setup();
    sys.facts.author = "alice";
    sys.facts.packName = "canon-honesty@0.1";
    sys.facts.sbomRekorUuid = "a".repeat(64);
    sys.facts.vendorScope = "not-a-pair";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks non-allowed license", () => {
    const sys = setup();
    sys.facts.author = "alice";
    sys.facts.packName = "canon-honesty@0.1";
    sys.facts.sbomRekorUuid = "a".repeat(64);
    sys.facts.vendorScope = "openai/gpt-4o";
    sys.facts.license = "WTFPL";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("vendorScopeCount derivation tracks comma-split parsing", () => {
    const sys = setup();
    sys.facts.vendorScope = "openai/gpt-4o,anthropic/claude-3-5-sonnet";
    expect(sys.derive.vendorScopeCount).toBe(2);
    expect(sys.derive.vendorScopeIsValid).toBe(true);
  });

  it("vendorScopeIsValid flips false on any invalid pair", () => {
    const sys = setup();
    sys.facts.vendorScope = "openai/gpt-4o,not-a-pair";
    expect(sys.derive.vendorScopeIsValid).toBe(false);
  });
});

describe("isValidAuthor / isValidPackName / isValidRekorUuid", () => {
  it("accepts canonical author slugs", () => {
    expect(isValidAuthor("alice")).toBe(true);
    expect(isValidAuthor("openai-eng")).toBe(true);
  });
  it("rejects oversized authors", () => {
    expect(isValidAuthor("a".repeat(33))).toBe(false);
  });
  it("requires versioned pack name", () => {
    expect(isValidPackName("canon-honesty@0.1")).toBe(true);
    expect(isValidPackName("canon-honesty")).toBe(false); // missing @<version>
  });
  it("rejects garbage rekor UUID", () => {
    expect(isValidRekorUuid("not-hex")).toBe(false);
    expect(isValidRekorUuid("a".repeat(63))).toBe(false);
    expect(isValidRekorUuid("a".repeat(64))).toBe(true);
  });
});

describe("parseVendorScope", () => {
  it("splits + lowercases + validates each pair", () => {
    const r = parseVendorScope("OpenAI/GPT-4o, anthropic/claude-3-5-sonnet");
    expect(r.pairs).toEqual([
      "openai/gpt-4o",
      "anthropic/claude-3-5-sonnet",
    ]);
    expect(r.invalid).toEqual([]);
  });
  it("collects invalids", () => {
    const r = parseVendorScope("openai/gpt-4o,foo");
    expect(r.pairs).toEqual(["openai/gpt-4o"]);
    expect(r.invalid).toEqual(["foo"]);
  });
  it("ignores empty entries", () => {
    expect(parseVendorScope(",,openai/gpt-4o,").pairs).toEqual([
      "openai/gpt-4o",
    ]);
  });
});

describe("isAllowedLicense / ALLOWED_LICENSES", () => {
  it("includes the OSI-favourite shortlist", () => {
    expect(isAllowedLicense("MIT")).toBe(true);
    expect(isAllowedLicense("Apache-2.0")).toBe(true);
    expect(isAllowedLicense("CC0-1.0")).toBe(true);
  });
  it("rejects unmaintained / quirky licenses", () => {
    expect(isAllowedLicense("WTFPL")).toBe(false);
    expect(isAllowedLicense("UNLICENSED")).toBe(false);
  });
  it("rejects CC-BY-4.0 (content license, not a software license)", () => {
    // FSF + OSI both flag CC-BY-* for software bodies as inappropriate.
    // Only CC0-1.0 (public-domain dedication) belongs in a software
    // allowlist, and only for sample-data packs.
    expect(isAllowedLicense("CC-BY-4.0")).toBe(false);
    expect(ALLOWED_LICENSES).not.toContain("CC-BY-4.0");
  });
  it("ALLOWED_LICENSES is non-empty + contains MIT", () => {
    expect(ALLOWED_LICENSES).toContain("MIT");
    expect(ALLOWED_LICENSES.length).toBeGreaterThan(5);
  });
});

describe("validateCron — 5-field cron grammar", () => {
  it("accepts simple ('0 */4 * * *')", () => {
    expect(validateCron("0 */4 * * *")).toBe(true);
  });
  it("accepts ranges ('0-30 * * * 1-5')", () => {
    expect(validateCron("0-30 * * * 1-5")).toBe(true);
  });
  it("accepts step on star ('*/15 * * * *')", () => {
    expect(validateCron("*/15 * * * *")).toBe(true);
  });
  it("accepts comma-list ('0,15,30,45 * * * *')", () => {
    expect(validateCron("0,15,30,45 * * * *")).toBe(true);
  });
  it("accepts step on range ('0-30/5 * * * *')", () => {
    expect(validateCron("0-30/5 * * * *")).toBe(true);
  });
  it("accepts day-of-week 7 (Sunday alias) ('0 0 * * 7')", () => {
    expect(validateCron("0 0 * * 7")).toBe(true);
  });
  it("rejects garbage ('not cron')", () => {
    expect(validateCron("not cron")).toBe(false);
  });
  it("rejects 6 fields (no seconds field)", () => {
    expect(validateCron("0 0 0 * * *")).toBe(false);
  });
  it("rejects 4 fields", () => {
    expect(validateCron("0 0 * *")).toBe(false);
  });
  it("rejects out-of-range hour ('0 25 * * *')", () => {
    expect(validateCron("0 25 * * *")).toBe(false);
  });
  it("rejects out-of-range minute ('60 * * * *')", () => {
    expect(validateCron("60 * * * *")).toBe(false);
  });
  it("rejects day-of-month 0 (must be 1-31)", () => {
    expect(validateCron("0 0 0 * *")).toBe(false);
  });
  it("rejects month 0 / month 13", () => {
    expect(validateCron("0 0 1 0 *")).toBe(false);
    expect(validateCron("0 0 1 13 *")).toBe(false);
  });
  it("rejects day-of-week 8", () => {
    expect(validateCron("0 0 * * 8")).toBe(false);
  });
  it("rejects trailing whitespace ('0 */4 * * * ')", () => {
    expect(validateCron("0 */4 * * * ")).toBe(false);
  });
  it("rejects leading whitespace (' 0 */4 * * *')", () => {
    expect(validateCron(" 0 */4 * * *")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(validateCron("")).toBe(false);
  });
  it("rejects empty atoms in list (',,')", () => {
    expect(validateCron("0,,30 * * * *")).toBe(false);
  });
  it("rejects step zero ('*/0 * * * *')", () => {
    expect(validateCron("*/0 * * * *")).toBe(false);
  });
  it("rejects malformed range ('30-0 * * * *')", () => {
    expect(validateCron("30-0 * * * *")).toBe(false);
  });
});

describe("recommendedIntervalIsValid + canSubmit (cron integration)", () => {
  it("canSubmit blocks malformed recommendedInterval", () => {
    const sys = createSystem({ module: nucleiRunFormModule });
    sys.start();
    try {
      sys.facts.author = "alice";
      sys.facts.packName = "canon-honesty@0.1";
      sys.facts.sbomRekorUuid = "a".repeat(64);
      sys.facts.vendorScope = "openai/gpt-4o";
      sys.facts.recommendedInterval = "not cron";
      sys.facts.authorizationAcknowledged = true;
      expect(sys.derive.recommendedIntervalIsValid).toBe(false);
      expect(sys.derive.canSubmit).toBe(false);
    } finally {
      sys.destroy();
    }
  });
  it("canSubmit allows valid recommendedInterval", () => {
    const sys = createSystem({ module: nucleiRunFormModule });
    sys.start();
    try {
      sys.facts.author = "alice";
      sys.facts.packName = "canon-honesty@0.1";
      sys.facts.sbomRekorUuid = "a".repeat(64);
      sys.facts.vendorScope = "openai/gpt-4o";
      sys.facts.recommendedInterval = "*/15 * * * *";
      sys.facts.authorizationAcknowledged = true;
      expect(sys.derive.recommendedIntervalIsValid).toBe(true);
      expect(sys.derive.canSubmit).toBe(true);
    } finally {
      sys.destroy();
    }
  });
});
