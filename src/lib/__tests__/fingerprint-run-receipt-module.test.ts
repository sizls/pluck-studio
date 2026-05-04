import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CASSETTE_HASH_PREFIX,
  CLASSIFICATION_THRESHOLDS,
  FINGERPRINT_DELTA_PREDICATE_URI,
  FINGERPRINT_PREDICATE_URI,
  SPKI_FINGERPRINT_PATTERN,
  fingerprintRunReceiptModule,
  formatCassetteHash,
} from "../fingerprint/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: fingerprintRunReceiptModule });
  sys.start();
  return sys;
}

describe("fingerprintRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;

  function setup() {
    active = makeSystem();
    return active;
  }

  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with scan-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("scan pending");
    expect(sys.facts.classification).toBeNull();
    expect(sys.facts.driftScore).toBeNull();
    expect(sys.facts.probeSetVersion).toBeNull();
    expect(sys.facts.transport).toBeNull();
    expect(sys.facts.deltaUrl).toBeNull();
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.isAnchored).toBe(false);
    expect(sys.derive.isSwap).toBe(false);
    expect(sys.derive.hasDelta).toBe(false);
    // Null classification → gray (not amber, which would conflate with minor)
    expect(sys.derive.classificationColor).toBe("gray");
    expect(sys.derive.targetDossierUrl).toBeNull();
  });

  it("isPending covers all transient states", () => {
    const sys = setup();
    for (const s of [
      "scan pending",
      "calibrating",
      "scanning",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
    sys.facts.status = "anchored";
    expect(sys.derive.isPending).toBe(false);
  });

  it("isAnchored is true when status='anchored'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    expect(sys.derive.isAnchored).toBe(true);
  });

  it("isSwap matches classification='swap'", () => {
    const sys = setup();
    sys.facts.classification = "swap";
    expect(sys.derive.isSwap).toBe(true);
    expect(sys.derive.classificationColor).toBe("red");
  });

  it("hasDelta is true once priorFingerprintHash is set", () => {
    const sys = setup();
    expect(sys.derive.hasDelta).toBe(false);
    sys.facts.priorFingerprintHash = "abc";
    expect(sys.derive.hasDelta).toBe(true);
  });

  it("classificationColor mapping is canonical", () => {
    const sys = setup();
    sys.facts.classification = "stable";
    expect(sys.derive.classificationColor).toBe("green");

    sys.facts.classification = "minor";
    expect(sys.derive.classificationColor).toBe("amber");

    sys.facts.classification = "major";
    expect(sys.derive.classificationColor).toBe("red");

    sys.facts.classification = "swap";
    expect(sys.derive.classificationColor).toBe("red");
  });

  it("targetDossierUrl derives from vendor + model", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    sys.facts.model = "gpt-4o";
    expect(sys.derive.targetDossierUrl).toBe(
      "/bureau/fingerprint/openai/gpt-4o",
    );
  });

  it("targetDossierUrl is null when either field is missing", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    expect(sys.derive.targetDossierUrl).toBeNull();
  });

  it("FINGERPRINT_PREDICATE_URI is the canonical wire form", () => {
    expect(FINGERPRINT_PREDICATE_URI).toBe(
      "https://pluck.run/ModelFingerprint/v1",
    );
  });

  it("FINGERPRINT_DELTA_PREDICATE_URI is distinct from cassette URI", () => {
    expect(FINGERPRINT_DELTA_PREDICATE_URI).toBe(
      "https://pluck.run/FingerprintDelta/v1",
    );
    expect(FINGERPRINT_DELTA_PREDICATE_URI).not.toBe(FINGERPRINT_PREDICATE_URI);
  });

  it("SPKI_FINGERPRINT_PATTERN accepts 64-char hex", () => {
    expect(
      SPKI_FINGERPRINT_PATTERN.test("0123456789abcdef".repeat(4)),
    ).toBe(true);
    expect(SPKI_FINGERPRINT_PATTERN.test("abc")).toBe(false);
  });

  it("CLASSIFICATION_THRESHOLDS is frozen and complete", () => {
    expect(Object.isFrozen(CLASSIFICATION_THRESHOLDS)).toBe(true);
    for (const k of ["stable", "minor", "major", "swap"] as const) {
      expect(CLASSIFICATION_THRESHOLDS[k].length).toBeGreaterThan(0);
    }
  });
});

describe("formatCassetteHash", () => {
  it("prefixes a bare 64-hex SHA-256 with 'local:'", () => {
    const hash = "0123456789abcdef".repeat(4);
    expect(formatCassetteHash(hash)).toBe(`${CASSETTE_HASH_PREFIX}${hash}`);
  });

  it("lowercases hex during prefixing", () => {
    const hash = "ABCDEF".repeat(10) + "0123";
    expect(formatCassetteHash(hash)).toBe(
      `local:${hash.toLowerCase()}`,
    );
  });

  it("is idempotent on already-prefixed input", () => {
    const prefixed = "local:" + "0".repeat(64);
    expect(formatCassetteHash(prefixed)).toBe(prefixed);
  });

  it("returns input unchanged when malformed (non-64-hex)", () => {
    expect(formatCassetteHash("not-a-hash")).toBe("not-a-hash");
    expect(formatCassetteHash("")).toBe("");
  });
});
