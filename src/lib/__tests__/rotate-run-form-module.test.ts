import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  REASON_LABELS,
  isValidSpkiFingerprint,
  rotateRunFormModule,
} from "../rotate/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: rotateRunFormModule });
  sys.start();
  return sys;
}

describe("rotateRunFormModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with sensible defaults", () => {
    const sys = setup();
    expect(sys.facts.reason).toBe("compromised");
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit requires both fingerprints + ack", () => {
    const sys = setup();
    sys.facts.oldKeyFingerprint = "a".repeat(64);
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.newKeyFingerprint = "b".repeat(64);
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit rejects malformed fingerprints", () => {
    const sys = setup();
    sys.facts.oldKeyFingerprint = "not-hex";
    sys.facts.newKeyFingerprint = "b".repeat(64);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit rejects same old and new fingerprints (rotation no-op)", () => {
    const sys = setup();
    sys.facts.oldKeyFingerprint = "a".repeat(64);
    sys.facts.newKeyFingerprint = "a".repeat(64);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("keysAreDifferent flips false on equal SPKI", () => {
    const sys = setup();
    sys.facts.oldKeyFingerprint = "a".repeat(64);
    sys.facts.newKeyFingerprint = "a".repeat(64);
    expect(sys.derive.keysAreDifferent).toBe(false);
  });

  it("reason fact accepts canonical values", () => {
    const sys = setup();
    for (const r of ["compromised", "routine", "lost"] as const) {
      sys.facts.reason = r;
      expect(sys.facts.reason).toBe(r);
    }
  });
});

describe("isValidSpkiFingerprint", () => {
  it("accepts 64 hex chars", () => {
    expect(isValidSpkiFingerprint("a".repeat(64))).toBe(true);
    expect(isValidSpkiFingerprint("ABCDEF".repeat(10) + "0123")).toBe(true);
  });
  it("rejects non-hex", () => {
    expect(isValidSpkiFingerprint("a".repeat(63))).toBe(false);
    expect(isValidSpkiFingerprint("not-hex")).toBe(false);
  });
});

describe("REASON_LABELS", () => {
  it("covers compromised + routine + lost", () => {
    expect(Object.keys(REASON_LABELS).length).toBe(3);
    expect(REASON_LABELS.compromised).toMatch(/Compromised/);
  });
});
