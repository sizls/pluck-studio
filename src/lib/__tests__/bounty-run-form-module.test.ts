import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  TARGET_LABELS,
  bountyRunFormModule,
  isValidProgramSlug,
  isValidRekorUuid,
} from "../bounty/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: bountyRunFormModule });
  sys.start();
  return sys;
}

describe("bountyRunFormModule", () => {
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
    expect(sys.facts.target).toBe("hackerone");
    expect(sys.facts.sourceRekorUuid).toBe("");
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit requires source uuid + program + vendor + model + ack", () => {
    const sys = setup();
    sys.facts.sourceRekorUuid = "a".repeat(64);
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.program = "openai";
    sys.facts.vendor = "openai";
    sys.facts.model = "gpt-4o";
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks while submitting", () => {
    const sys = setup();
    sys.facts.sourceRekorUuid = "a".repeat(64);
    sys.facts.program = "openai";
    sys.facts.vendor = "openai";
    sys.facts.model = "gpt-4o";
    sys.facts.authorizationAcknowledged = true;
    sys.facts.submitStatus = "submitting";
    expect(sys.derive.canSubmit).toBe(false);
  });
});

describe("isValidRekorUuid", () => {
  it("accepts 64+ hex chars", () => {
    expect(isValidRekorUuid("a".repeat(64))).toBe(true);
    expect(isValidRekorUuid("0".repeat(80))).toBe(true);
  });
  it("rejects short / non-hex", () => {
    expect(isValidRekorUuid("a".repeat(63))).toBe(false);
    expect(isValidRekorUuid("not-hex")).toBe(false);
  });
});

describe("isValidProgramSlug", () => {
  it("accepts canonical slugs", () => {
    expect(isValidProgramSlug("openai")).toBe(true);
    expect(isValidProgramSlug("anthropic")).toBe(true);
  });
  it("rejects shapes that aren't slugs", () => {
    expect(isValidProgramSlug("Open AI")).toBe(false);
    expect(isValidProgramSlug("a".repeat(65))).toBe(false);
  });
});

describe("TARGET_LABELS", () => {
  it("covers HackerOne + Bugcrowd", () => {
    expect(TARGET_LABELS.hackerone).toMatch(/HackerOne/);
    expect(TARGET_LABELS.bugcrowd).toMatch(/Bugcrowd/);
  });
});
