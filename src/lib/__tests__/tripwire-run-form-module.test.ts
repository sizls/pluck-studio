import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  POLICY_SOURCE_LABELS,
  isValidMachineId,
  tripwireRunFormModule,
} from "../tripwire/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: tripwireRunFormModule });
  sys.start();
  return sys;
}

describe("tripwireRunFormModule", () => {
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
    expect(sys.facts.policySource).toBe("default");
    expect(sys.facts.notarize).toBe(false);
    expect(sys.derive.canSubmit).toBe(false);
    expect(sys.derive.requiresPolicyUrl).toBe(false);
  });

  it("canSubmit requires machineId + ack with default policy", () => {
    const sys = setup();
    sys.facts.machineId = "alice-mbp";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit requires customPolicyUrl when policy is custom", () => {
    const sys = setup();
    sys.facts.machineId = "alice-mbp";
    sys.facts.policySource = "custom";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.customPolicyUrl = "https://example.com/policy.json";
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks http:// custom URL early (HTTPS-only)", () => {
    const sys = setup();
    sys.facts.machineId = "alice-mbp";
    sys.facts.policySource = "custom";
    sys.facts.customPolicyUrl = "http://example.com/policy.json";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks malformed machineId", () => {
    const sys = setup();
    sys.facts.machineId = "ALICE MBP"; // spaces + uppercase
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("requiresPolicyUrl tracks the radio choice", () => {
    const sys = setup();
    expect(sys.derive.requiresPolicyUrl).toBe(false);
    sys.facts.policySource = "custom";
    expect(sys.derive.requiresPolicyUrl).toBe(true);
  });

  it("notarize is independent toggle", () => {
    const sys = setup();
    sys.facts.machineId = "alice-mbp";
    sys.facts.notarize = true;
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });
});

describe("isValidMachineId", () => {
  it("accepts canonical machine slugs", () => {
    expect(isValidMachineId("alice-mbp")).toBe(true);
    expect(isValidMachineId("ci-runner-3")).toBe(true);
    expect(isValidMachineId("a")).toBe(true);
  });

  it("rejects spaces / uppercase / leading-trailing hyphen / oversized", () => {
    expect(isValidMachineId("Alice MBP")).toBe(false);
    expect(isValidMachineId("alice mbp")).toBe(false);
    expect(isValidMachineId("-alice")).toBe(false);
    expect(isValidMachineId("alice-")).toBe(false);
    expect(isValidMachineId("a".repeat(49))).toBe(false);
    expect(isValidMachineId("")).toBe(false);
  });
});

describe("POLICY_SOURCE_LABELS", () => {
  it("covers default + custom", () => {
    expect(POLICY_SOURCE_LABELS.default).toMatch(/Default allowlist/);
    expect(POLICY_SOURCE_LABELS.custom).toMatch(/HTTPS-only/);
  });
});
