// ---------------------------------------------------------------------------
// oathRunReceiptModule — Directive module unit tests
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  OATH_PREDICATE_URI,
  SPKI_FINGERPRINT_PATTERN,
  oathRunReceiptModule,
  type OathClaim,
} from "../oath/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: oathRunReceiptModule });
  sys.start();
  return sys;
}

describe("oathRunReceiptModule", () => {
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
    expect(sys.derive.isVerified).toBe(false);
    expect(sys.derive.isFailure).toBe(false);
    expect(sys.derive.isOathExpired).toBe(false);
    expect(sys.derive.hasStaleClaim).toBe(false);
    expect(sys.derive.verdictColor).toBe("amber");
  });

  it("isPending covers fetching + verifying transient states", () => {
    const sys = setup();
    for (const s of [
      "verification pending",
      "fetching",
      "verifying",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
    sys.facts.status = "anchored";
    expect(sys.derive.isPending).toBe(false);
  });

  it("isVerified requires anchored + verdict=verified", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "verified";
    expect(sys.derive.isVerified).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("isVerified is false when anchored but verdict is not verified", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "signature-failed";
    expect(sys.derive.isVerified).toBe(false);
    expect(sys.derive.isFailure).toBe(true);
    expect(sys.derive.verdictColor).toBe("red");
  });

  it("isOathExpired matches verdict=oath-expired and renders amber", () => {
    const sys = setup();
    sys.facts.verdict = "oath-expired";
    expect(sys.derive.isOathExpired).toBe(true);
    expect(sys.derive.verdictColor).toBe("amber");
  });

  it("did-not-commit renders amber (social-pressure, not failure)", () => {
    const sys = setup();
    sys.facts.verdict = "did-not-commit";
    expect(sys.derive.verdictColor).toBe("amber");
    // Distinct from a verified pass.
    expect(sys.derive.isVerified).toBe(false);
  });

  it("verdictColor is red for hard failures", () => {
    const sys = setup();
    for (const v of [
      "signature-failed",
      "origin-mismatch",
      "not-found",
      "fetch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("isFailure trips when status is failed regardless of verdict", () => {
    const sys = setup();
    sys.facts.status = "failed";
    expect(sys.derive.isFailure).toBe(true);
  });

  it("hasStaleClaim is true when any claim has verdict='oath-expired'", () => {
    const sys = setup();
    sys.facts.claims = [
      {
        id: "data-retention",
        text: "User chats deleted after 30 days unless flagged.",
        expiresAt: "2027-01-01T00:00:00Z",
        verdict: "active",
      },
      {
        id: "model-card",
        text: "Model card updated within 7 days of release.",
        expiresAt: "2024-12-31T00:00:00Z",
        verdict: "oath-expired",
      },
    ] satisfies OathClaim[];
    sys.facts.claimsCount = 2;
    expect(sys.derive.hasStaleClaim).toBe(true);
  });

  it("hasStaleClaim is false when all claims are active", () => {
    const sys = setup();
    sys.facts.claims = [
      {
        id: "data-retention",
        text: "User chats deleted after 30 days unless flagged.",
        expiresAt: "2027-01-01T00:00:00Z",
        verdict: "active",
      },
    ];
    expect(sys.derive.hasStaleClaim).toBe(false);
  });

  it("OATH_PREDICATE_URI is the canonical wire form", () => {
    expect(OATH_PREDICATE_URI).toBe("https://pluck.run/PluckOath/v1");
  });

  it("SPKI_FINGERPRINT_PATTERN accepts 64-char hex strings", () => {
    expect(
      SPKI_FINGERPRINT_PATTERN.test(
        "0123456789abcdef".repeat(4),
      ),
    ).toBe(true);
    expect(SPKI_FINGERPRINT_PATTERN.test("abc")).toBe(false);
    expect(SPKI_FINGERPRINT_PATTERN.test("ABC".repeat(22))).toBe(false);
  });
});
