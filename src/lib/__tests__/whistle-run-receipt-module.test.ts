import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CASSETTE_HASH_PREFIX,
  WHISTLE_PREDICATE_URI,
  formatCassetteHash,
  whistleRunReceiptModule,
  type RedactionLayer,
  type RoutingDelivery,
} from "../whistle/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: whistleRunReceiptModule });
  sys.start();
  return sys;
}

describe("whistleRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;

  function setup() {
    active = makeSystem();
    return active;
  }

  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with submission-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("submission pending");
    expect(sys.facts.verdict).toBeNull();
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.isAccepted).toBe(false);
    expect(sys.derive.isFailure).toBe(false);
    expect(sys.derive.verdictColor).toBe("gray");
    expect(sys.derive.redactionTriggered).toBe(false);
    expect(sys.derive.anyDelivered).toBe(false);
  });

  it("isPending covers redacting + routing + anchoring", () => {
    const sys = setup();
    for (const s of [
      "submission pending",
      "redacting",
      "routing",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
    sys.facts.status = "anchored";
    expect(sys.derive.isPending).toBe(false);
  });

  it("isAccepted requires anchored + verdict='accepted'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "accepted";
    expect(sys.derive.isAccepted).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("isHeld + amber color when verdict='held-redaction' (fixable)", () => {
    const sys = setup();
    sys.facts.verdict = "held-redaction";
    expect(sys.derive.isHeld).toBe(true);
    expect(sys.derive.isFailure).toBe(false);
    expect(sys.derive.verdictColor).toBe("amber");
  });

  it("verdictColor is red for terminal failures", () => {
    const sys = setup();
    for (const v of [
      "routing-failed",
      "bundle-malformed",
      "not-found",
      "fetch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
      expect(sys.derive.isFailure).toBe(true);
    }
  });

  it("isFailure trips when status='failed' regardless of verdict", () => {
    const sys = setup();
    sys.facts.status = "failed";
    expect(sys.derive.isFailure).toBe(true);
  });

  it("redactionTriggered is true when any layer fails", () => {
    const sys = setup();
    sys.facts.redactionLayers = [
      { layer: "secret-scrub", passed: true, signals: [] },
      {
        layer: "k-anonymity-floor",
        passed: false,
        signals: ["unique-phrase-detected"],
      },
      { layer: "stylometric-refusal", passed: true, signals: [] },
    ] satisfies RedactionLayer[];
    expect(sys.derive.redactionTriggered).toBe(true);
  });

  it("redactionTriggered is false when all layers pass", () => {
    const sys = setup();
    sys.facts.redactionLayers = [
      { layer: "secret-scrub", passed: true, signals: [] },
      { layer: "k-anonymity-floor", passed: true, signals: [] },
      { layer: "stylometric-refusal", passed: true, signals: [] },
    ];
    expect(sys.derive.redactionTriggered).toBe(false);
  });

  it("anyDelivered is true when at least one routing delivered", () => {
    const sys = setup();
    sys.facts.routingDeliveries = [
      {
        partner: "propublica",
        status: "delivered",
        partnerAck: "PP-2026-001",
      },
      { partner: "bellingcat", status: "pending" },
    ] satisfies RoutingDelivery[];
    expect(sys.derive.anyDelivered).toBe(true);
  });

  it("anyDelivered is false when only pending/refused", () => {
    const sys = setup();
    sys.facts.routingDeliveries = [
      {
        partner: "propublica",
        status: "refused",
        refusalReason: "out of scope",
      },
      { partner: "bellingcat", status: "pending" },
    ];
    expect(sys.derive.anyDelivered).toBe(false);
  });

  it("WHISTLE_PREDICATE_URI is canonical wire form", () => {
    expect(WHISTLE_PREDICATE_URI).toBe(
      "https://pluck.run/WhistleSubmission/v1",
    );
  });
});

describe("formatCassetteHash (whistle)", () => {
  it("prefixes a 64-hex hash", () => {
    const h = "0123456789abcdef".repeat(4);
    expect(formatCassetteHash(h)).toBe(`${CASSETTE_HASH_PREFIX}${h}`);
  });

  it("is idempotent on prefixed input", () => {
    const prefixed = "local:" + "0".repeat(64);
    expect(formatCassetteHash(prefixed)).toBe(prefixed);
  });

  it("returns malformed input unchanged", () => {
    expect(formatCassetteHash("garbage")).toBe("garbage");
  });
});
