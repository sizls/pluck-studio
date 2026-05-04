import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  ROUTING_PARTNER_LABELS,
  whistleRunFormModule,
} from "../whistle/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: whistleRunFormModule });
  sys.start();
  return sys;
}

describe("whistleRunFormModule", () => {
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
    expect(sys.facts.bundleUrl).toBe("");
    expect(sys.facts.category).toBe("training-data");
    expect(sys.facts.routingPartner).toBe("propublica");
    expect(sys.facts.manualRedactPhrase).toBe("");
    expect(sys.facts.anonymityCaveatAcknowledged).toBe(false);
    expect(sys.facts.authorizationAcknowledged).toBe(false);
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit requires bundleUrl + BOTH ack checkboxes", () => {
    const sys = setup();
    sys.facts.bundleUrl = "https://example.com/tip.json";
    expect(sys.derive.canSubmit).toBe(false);

    sys.facts.anonymityCaveatAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);

    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks if either ack is false", () => {
    const sys = setup();
    sys.facts.bundleUrl = "https://example.com/tip.json";
    sys.facts.anonymityCaveatAcknowledged = true;
    sys.facts.authorizationAcknowledged = false;
    expect(sys.derive.canSubmit).toBe(false);

    sys.facts.anonymityCaveatAcknowledged = false;
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks empty bundleUrl", () => {
    const sys = setup();
    sys.facts.bundleUrl = "   ";
    sys.facts.anonymityCaveatAcknowledged = true;
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit flips false while submitting", () => {
    const sys = setup();
    sys.facts.bundleUrl = "https://example.com/tip.json";
    sys.facts.anonymityCaveatAcknowledged = true;
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
    sys.facts.submitStatus = "submitting";
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("category fact accepts all canonical values", () => {
    const sys = setup();
    for (const c of [
      "training-data",
      "policy-violation",
      "safety-incident",
    ] as const) {
      sys.facts.category = c;
      expect(sys.facts.category).toBe(c);
    }
  });

  it("routingPartner fact accepts all four partners", () => {
    const sys = setup();
    for (const p of [
      "propublica",
      "bellingcat",
      "404media",
      "eff-press",
    ] as const) {
      sys.facts.routingPartner = p;
      expect(sys.facts.routingPartner).toBe(p);
    }
  });

  it("manualRedactPhrase is optional (can stay empty)", () => {
    const sys = setup();
    sys.facts.bundleUrl = "https://example.com/tip.json";
    sys.facts.anonymityCaveatAcknowledged = true;
    sys.facts.authorizationAcknowledged = true;
    expect(sys.facts.manualRedactPhrase).toBe("");
    expect(sys.derive.canSubmit).toBe(true);
  });
});

describe("CATEGORY_LABELS / ROUTING_PARTNER_LABELS", () => {
  it("CATEGORY_LABELS covers all three canonical categories", () => {
    expect(Object.keys(CATEGORY_LABELS).length).toBe(3);
    for (const c of [
      "training-data",
      "policy-violation",
      "safety-incident",
    ] as const) {
      expect(CATEGORY_LABELS[c].length).toBeGreaterThan(0);
    }
  });

  it("ROUTING_PARTNER_LABELS covers all four partners", () => {
    expect(Object.keys(ROUTING_PARTNER_LABELS).length).toBe(4);
    expect(ROUTING_PARTNER_LABELS.propublica).toMatch(/ProPublica/);
    expect(ROUTING_PARTNER_LABELS["eff-press"]).toMatch(/EFF/);
  });
});
