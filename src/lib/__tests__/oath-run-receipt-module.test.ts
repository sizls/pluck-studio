// ---------------------------------------------------------------------------
// oathRunReceiptModule — Directive module unit tests
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import { oathRunReceiptModule } from "../oath/run-receipt-module.js";

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
    expect(sys.derive.isExpired).toBe(false);
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

  it("isExpired matches verdict=expired and renders amber", () => {
    const sys = setup();
    sys.facts.verdict = "expired";
    expect(sys.derive.isExpired).toBe(true);
    expect(sys.derive.verdictColor).toBe("amber");
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

  it("claims fact carries the structured oath body", () => {
    const sys = setup();
    sys.facts.claims = [
      {
        id: "data-retention",
        text: "User chats deleted after 30 days unless flagged.",
        expiresAt: "2027-01-01T00:00:00Z",
      },
    ];
    sys.facts.claimsCount = 1;
    expect(sys.facts.claimsCount).toBe(1);
    expect(sys.facts.claims).toHaveLength(1);
  });
});
