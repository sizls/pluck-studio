import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  FINGERPRINT_BOUNDS,
  isValidCanaryId,
  moleRunFormModule,
  parseFingerprintPhrases,
} from "../mole/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: moleRunFormModule });
  sys.start();
  return sys;
}

describe("moleRunFormModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with empty defaults", () => {
    const sys = setup();
    expect(sys.derive.canSubmit).toBe(false);
    expect(sys.derive.fingerprintCount).toBe(0);
  });

  it("canSubmit requires every field including https URL + valid fingerprints + ack", () => {
    const sys = setup();
    sys.facts.canaryId = "nyt-2024-01-15";
    sys.facts.canaryUrl = "https://example.com/canary.txt";
    sys.facts.fingerprintPhrases = "this is a unique-enough fingerprint phrase";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks http:// URL early", () => {
    const sys = setup();
    sys.facts.canaryId = "nyt-2024-01-15";
    sys.facts.canaryUrl = "http://example.com/canary.txt";
    sys.facts.fingerprintPhrases = "this is a unique-enough fingerprint phrase";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks more than max fingerprints", () => {
    const sys = setup();
    sys.facts.canaryId = "nyt-2024-01-15";
    sys.facts.canaryUrl = "https://example.com/canary.txt";
    // 8 phrases (max is 7)
    sys.facts.fingerprintPhrases = Array(8)
      .fill("a unique-enough phrase for fingerprint")
      .join(",");
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks too-short fingerprints", () => {
    const sys = setup();
    sys.facts.canaryId = "nyt-2024-01-15";
    sys.facts.canaryUrl = "https://example.com/canary.txt";
    sys.facts.fingerprintPhrases = "hi, ok";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("fingerprintCount + fingerprintsValid update live", () => {
    const sys = setup();
    sys.facts.fingerprintPhrases =
      "first unique-enough phrase, second unique-enough phrase";
    expect(sys.derive.fingerprintCount).toBe(2);
    expect(sys.derive.fingerprintsValid).toBe(true);

    sys.facts.fingerprintPhrases = "first unique-enough phrase, short";
    expect(sys.derive.fingerprintsValid).toBe(false);
  });
});

describe("isValidCanaryId", () => {
  it("accepts canonical canary slugs", () => {
    expect(isValidCanaryId("nyt-2024-01-15")).toBe(true);
    expect(isValidCanaryId("pii-leak-test-1")).toBe(true);
    expect(isValidCanaryId("a")).toBe(true);
  });
  it("rejects spaces / leading-trailing hyphen / oversized", () => {
    expect(isValidCanaryId("nyt 2024")).toBe(false);
    expect(isValidCanaryId("-nyt")).toBe(false);
    expect(isValidCanaryId("nyt-")).toBe(false);
    expect(isValidCanaryId("a".repeat(49))).toBe(false);
  });
});

describe("parseFingerprintPhrases", () => {
  it("splits + bounds-checks each phrase", () => {
    const r = parseFingerprintPhrases(
      "a unique-enough fingerprint, another unique-enough fingerprint",
    );
    expect(r.phrases).toHaveLength(2);
    expect(r.outOfBounds).toEqual([]);
  });
  it("flags too-short phrases (< MIN_LENGTH=10 chars)", () => {
    const r = parseFingerprintPhrases("hi, ok");
    expect(r.phrases).toHaveLength(0);
    expect(r.outOfBounds).toEqual(["hi", "ok"]);
  });
  it("flags too-long phrases (> 80 chars)", () => {
    const r = parseFingerprintPhrases("x".repeat(81));
    expect(r.outOfBounds).toHaveLength(1);
  });
  it("ignores empty entries", () => {
    expect(
      parseFingerprintPhrases(",,fingerprint phrase one,").phrases,
    ).toEqual(["fingerprint phrase one"]);
  });
});

describe("FINGERPRINT_BOUNDS", () => {
  it("documents the canonical bounds", () => {
    expect(FINGERPRINT_BOUNDS.MIN_LENGTH).toBe(10);
    expect(FINGERPRINT_BOUNDS.MAX_LENGTH).toBe(80);
    expect(FINGERPRINT_BOUNDS.MAX_COUNT).toBe(7);
  });
});
