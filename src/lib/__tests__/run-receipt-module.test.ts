// ---------------------------------------------------------------------------
// dragnetRunReceiptModule — unit tests
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  Classifications,
  dotColorFromClassifications,
  dragnetRunReceiptModule,
} from "../dragnet/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: dragnetRunReceiptModule });
  sys.start();
  return sys;
}

describe("dragnetRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;

  function setup() {
    active = makeSystem();
    return active;
  }

  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with stub-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("cycle pending");
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.isAnchored).toBe(false);
    expect(sys.derive.hasClassifications).toBe(false);
    expect(sys.derive.totalClassified).toBe(0);
  });

  it("isAnchored is true once status is anchored", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    expect(sys.derive.isAnchored).toBe(true);
    expect(sys.derive.isPending).toBe(false);
  });

  it("isPending covers transient states", () => {
    const sys = setup();
    for (const s of ["cycle pending", "dispatched", "probing", "anchoring", "running"] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
  });

  it("totalClassified sums all four buckets", () => {
    const sys = setup();
    sys.facts.classifications = {
      contradict: 2,
      mirror: 0,
      shadow: 1,
      snare: 5,
    };
    expect(sys.derive.totalClassified).toBe(8);
    expect(sys.derive.hasClassifications).toBe(true);
  });
});

describe("dotColorFromClassifications", () => {
  it("returns red on any contradict or mirror", () => {
    expect(
      dotColorFromClassifications({
        contradict: 1,
        mirror: 0,
        shadow: 0,
        snare: 0,
      }),
    ).toBe("red");
    expect(
      dotColorFromClassifications({
        contradict: 0,
        mirror: 1,
        shadow: 0,
        snare: 0,
      }),
    ).toBe("red");
  });

  it("returns amber when only shadow is present", () => {
    expect(
      dotColorFromClassifications({
        contradict: 0,
        mirror: 0,
        shadow: 3,
        snare: 1,
      }),
    ).toBe("amber");
  });

  it("returns green on snares-only or empty", () => {
    expect(
      dotColorFromClassifications({
        contradict: 0,
        mirror: 0,
        shadow: 0,
        snare: 5,
      }),
    ).toBe("green");
    const empty: Classifications = {
      contradict: 0,
      mirror: 0,
      shadow: 0,
      snare: 0,
    };
    expect(dotColorFromClassifications(empty)).toBe("green");
  });
});
