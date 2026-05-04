// ---------------------------------------------------------------------------
// oathRunFormModule — Directive module unit tests
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import { oathRunFormModule } from "../oath/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: oathRunFormModule });
  sys.start();
  return sys;
}

describe("oathRunFormModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;

  function setup() {
    active = makeSystem();
    return active;
  }

  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with empty defaults", () => {
    const sys = setup();
    expect(sys.facts.vendorDomain).toBe("");
    expect(sys.facts.expectedOrigin).toBe("");
    expect(sys.facts.authorizationAcknowledged).toBe(false);
    expect(sys.facts.submitStatus).toBe("idle");
    expect(sys.facts.errorMessage).toBeNull();
    expect(sys.facts.signInUrl).toBeNull();
    expect(sys.facts.lastResult).toBeNull();
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit requires vendorDomain + auth ack", () => {
    const sys = setup();
    sys.facts.vendorDomain = "openai.com";
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks empty/whitespace vendorDomain", () => {
    const sys = setup();
    sys.facts.vendorDomain = "   ";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit flips false while submitting", () => {
    const sys = setup();
    sys.facts.vendorDomain = "openai.com";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
    sys.facts.submitStatus = "submitting";
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("effectiveExpectedOrigin defaults to https://<domain>", () => {
    const sys = setup();
    sys.facts.vendorDomain = "openai.com";
    expect(sys.derive.effectiveExpectedOrigin).toBe("https://openai.com");
  });

  it("effectiveExpectedOrigin uses explicit override when provided", () => {
    const sys = setup();
    sys.facts.vendorDomain = "openai.com";
    sys.facts.expectedOrigin = "https://chat.openai.com";
    expect(sys.derive.effectiveExpectedOrigin).toBe("https://chat.openai.com");
  });

  it("effectiveExpectedOrigin lowercases the auto-generated host", () => {
    const sys = setup();
    sys.facts.vendorDomain = "OpenAI.COM";
    expect(sys.derive.effectiveExpectedOrigin).toBe("https://openai.com");
  });

  it("effectiveExpectedOrigin is empty when vendorDomain is empty", () => {
    const sys = setup();
    expect(sys.derive.effectiveExpectedOrigin).toBe("");
  });

  it("hasError + needsSignIn are independent channels", () => {
    const sys = setup();
    sys.facts.errorMessage = "Network failure";
    expect(sys.derive.hasError).toBe(true);
    expect(sys.derive.needsSignIn).toBe(false);

    sys.facts.signInUrl = "/sign-in";
    expect(sys.derive.needsSignIn).toBe(true);
  });
});
