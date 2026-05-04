import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  BOUNTY_SUBMISSION_PREDICATE_URI,
  EVIDENCE_PACKET_PREDICATE_URI,
  bountyRunReceiptModule,
} from "../bounty/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: bountyRunReceiptModule });
  sys.start();
  return sys;
}

describe("bountyRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with filing-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("filing pending");
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.verdictColor).toBe("gray");
  });

  it("isFiled requires anchored + verdict='filed'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "filed";
    expect(sys.derive.isFiled).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("rate-limited maps to amber (transient)", () => {
    const sys = setup();
    sys.facts.verdict = "rate-limited";
    expect(sys.derive.verdictColor).toBe("amber");
    expect(sys.derive.isFailure).toBe(true);
  });

  it("verdictColor is red for terminal failures", () => {
    const sys = setup();
    for (const v of [
      "platform-rejected",
      "source-not-found",
      "source-malformed",
      "dispatch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("isPending covers assembling + dispatching + anchoring", () => {
    const sys = setup();
    for (const s of [
      "filing pending",
      "assembling-packet",
      "dispatching",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
  });

  it("programDossierUrl derives from vendor + model", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    sys.facts.model = "gpt-4o";
    expect(sys.derive.programDossierUrl).toBe(
      "/bureau/fingerprint/openai/gpt-4o",
    );
  });

  it("predicate URIs are canonical wire forms", () => {
    expect(EVIDENCE_PACKET_PREDICATE_URI).toBe(
      "https://pluck.run/EvidencePacket/v1",
    );
    expect(BOUNTY_SUBMISSION_PREDICATE_URI).toBe(
      "https://pluck.run/BountySubmission/v1",
    );
  });
});
