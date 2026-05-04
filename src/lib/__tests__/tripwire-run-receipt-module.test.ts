import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  TRIPWIRE_PREDICATE_URI,
  tripwireRunReceiptModule,
} from "../tripwire/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: tripwireRunReceiptModule });
  sys.start();
  return sys;
}

describe("tripwireRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with configuration-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("configuration pending");
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.verdictColor).toBe("gray");
    expect(sys.derive.timelineUrl).toBeNull();
  });

  it("isConfigured requires anchored + verdict='configured'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "configured";
    expect(sys.derive.isConfigured).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("machine-already-active is amber (not isFailure)", () => {
    const sys = setup();
    sys.facts.verdict = "machine-already-active";
    expect(sys.derive.verdictColor).toBe("amber");
    expect(sys.derive.isFailure).toBe(false);
  });

  it("verdictColor is red for hard failures", () => {
    const sys = setup();
    for (const v of [
      "policy-malformed",
      "policy-fetch-failed",
      "not-found",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
      expect(sys.derive.isFailure).toBe(true);
    }
  });

  it("isPending covers fetching-policy + signing + anchoring", () => {
    const sys = setup();
    for (const s of [
      "configuration pending",
      "fetching-policy",
      "signing",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
  });

  it("timelineUrl populated once machineId is set", () => {
    const sys = setup();
    sys.facts.machineId = "alice-mbp";
    expect(sys.derive.timelineUrl).toBe("/bureau/tripwire/me");
  });

  it("predicate URI is canonical wire form", () => {
    expect(TRIPWIRE_PREDICATE_URI).toBe(
      "https://pluck.run/TripwirePolicy/v1",
    );
  });
});
