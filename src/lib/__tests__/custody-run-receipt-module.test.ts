import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CASSETTE_HASH_PREFIX,
  CUSTODY_PREDICATE_URI,
  SPKI_FINGERPRINT_PATTERN,
  custodyRunReceiptModule,
  formatCassetteHash,
  type ComplianceCheck,
} from "../custody/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: custodyRunReceiptModule });
  sys.start();
  return sys;
}

describe("custodyRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;

  function setup() {
    active = makeSystem();
    return active;
  }

  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with verification-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("verification pending");
    expect(sys.facts.verdict).toBeNull();
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.isCompliant).toBe(false);
    expect(sys.derive.isFailure).toBe(false);
    // Null verdict → gray (not green/red — distinguishes "no scan yet")
    expect(sys.derive.verdictColor).toBe("gray");
    expect(sys.derive.passedCheckCount).toBe(0);
    expect(sys.derive.failedCheckCount).toBe(0);
    expect(sys.derive.hasFailingCheck).toBe(false);
  });

  it("isPending covers fetching + verifying + anchoring", () => {
    const sys = setup();
    for (const s of [
      "verification pending",
      "fetching",
      "verifying",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
    sys.facts.status = "anchored";
    expect(sys.derive.isPending).toBe(false);
  });

  it("isCompliant requires anchored + verdict='compliant'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "compliant";
    expect(sys.derive.isCompliant).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("isCompliant is false when anchored but verdict is not compliant", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "webauthn-missing";
    expect(sys.derive.isCompliant).toBe(false);
    expect(sys.derive.isFailure).toBe(true);
    expect(sys.derive.verdictColor).toBe("red");
  });

  it("verdictColor is binary green/red (no amber)", () => {
    const sys = setup();
    for (const v of [
      "webauthn-missing",
      "signature-invalid",
      "dom-hash-mismatch",
      "cassette-mismatch",
      "bundle-malformed",
      "not-found",
      "fetch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("passedCheckCount + failedCheckCount track the checks list", () => {
    const sys = setup();
    sys.facts.checks = [
      { id: "signature-valid", label: "Signature valid", passed: true },
      { id: "dom-hash-valid", label: "DOM hash valid", passed: true },
      { id: "webauthn-valid", label: "WebAuthn-bound", passed: false },
    ] satisfies ComplianceCheck[];
    expect(sys.derive.passedCheckCount).toBe(2);
    expect(sys.derive.failedCheckCount).toBe(1);
    expect(sys.derive.hasFailingCheck).toBe(true);
  });

  it("CUSTODY_PREDICATE_URI is canonical wire form", () => {
    expect(CUSTODY_PREDICATE_URI).toBe(
      "https://pluck.run/CustodyBundle/v1",
    );
  });

  it("SPKI_FINGERPRINT_PATTERN accepts 64-char hex", () => {
    expect(
      SPKI_FINGERPRINT_PATTERN.test("0123456789abcdef".repeat(4)),
    ).toBe(true);
    expect(SPKI_FINGERPRINT_PATTERN.test("abc")).toBe(false);
  });
});

describe("formatCassetteHash (custody)", () => {
  it("prefixes a 64-hex hash with 'local:'", () => {
    const h = "0123456789abcdef".repeat(4);
    expect(formatCassetteHash(h)).toBe(`${CASSETTE_HASH_PREFIX}${h}`);
  });

  it("is idempotent on already-prefixed input", () => {
    const prefixed = "local:" + "0".repeat(64);
    expect(formatCassetteHash(prefixed)).toBe(prefixed);
  });

  it("returns malformed input unchanged", () => {
    expect(formatCassetteHash("not-a-hash")).toBe("not-a-hash");
    expect(formatCassetteHash("")).toBe("");
  });
});
