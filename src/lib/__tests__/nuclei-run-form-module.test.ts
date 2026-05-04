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
  it("ALLOWED_LICENSES is non-empty + contains MIT", () => {
    expect(ALLOWED_LICENSES).toContain("MIT");
    expect(ALLOWED_LICENSES.length).toBeGreaterThan(5);
  });
});
