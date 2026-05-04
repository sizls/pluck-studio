import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  KEY_FREEZE_PREDICATE_URI,
  KEY_REVOCATION_PREDICATE_URI,
  RE_WITNESS_REPORT_PREDICATE_URI,
  rotateRunReceiptModule,
} from "../rotate/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: rotateRunReceiptModule });
  sys.start();
  return sys;
}

describe("rotateRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with rotation-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("rotation pending");
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.verdictColor).toBe("gray");
  });

  it("isRotated requires anchored + verdict='rotated'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "rotated";
    expect(sys.derive.isRotated).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("old-key-already-revoked is amber (idempotent)", () => {
    const sys = setup();
    sys.facts.verdict = "old-key-already-revoked";
    expect(sys.derive.verdictColor).toBe("amber");
  });

  it("verdictColor is red for hard failures", () => {
    const sys = setup();
    for (const v of [
      "old-key-not-found",
      "new-key-already-active",
      "signature-failed",
      "dispatch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("isPending covers revoking + re-witnessing + anchoring", () => {
    const sys = setup();
    for (const s of [
      "rotation pending",
      "revoking",
      "re-witnessing",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
  });

  it("predicate URIs are canonical wire forms", () => {
    expect(KEY_REVOCATION_PREDICATE_URI).toBe(
      "https://pluck.run/KeyRevocation/v1",
    );
    expect(RE_WITNESS_REPORT_PREDICATE_URI).toBe(
      "https://pluck.run/ReWitnessReport/v1",
    );
    expect(KEY_FREEZE_PREDICATE_URI).toBe("https://pluck.run/KeyFreeze/v1");
  });
});
