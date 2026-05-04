import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  custodyRunFormModule,
  normalizeBundleUrl,
} from "../custody/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: custodyRunFormModule });
  sys.start();
  return sys;
}

describe("custodyRunFormModule", () => {
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
    expect(sys.facts.bundleUrl).toBe("");
    expect(sys.facts.expectedVendor).toBe("");
    expect(sys.facts.authorizationAcknowledged).toBe(false);
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit requires bundleUrl + auth-ack", () => {
    const sys = setup();
    sys.facts.bundleUrl = "https://example.com/bundle.json";
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks whitespace-only bundleUrl", () => {
    const sys = setup();
    sys.facts.bundleUrl = "   ";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit flips false while submitting", () => {
    const sys = setup();
    sys.facts.bundleUrl = "https://example.com/bundle.json";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
    sys.facts.submitStatus = "submitting";
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("hasError + needsSignIn are independent channels", () => {
    const sys = setup();
    sys.facts.errorMessage = "Network failure";
    expect(sys.derive.hasError).toBe(true);
    expect(sys.derive.needsSignIn).toBe(false);
    sys.facts.signInUrl = "/sign-in";
    expect(sys.derive.needsSignIn).toBe(true);
  });

  it("expectedVendor is independent from bundleUrl", () => {
    const sys = setup();
    sys.facts.expectedVendor = "openai";
    expect(sys.facts.expectedVendor).toBe("openai");
  });
});

describe("normalizeBundleUrl", () => {
  it("trims whitespace", () => {
    expect(normalizeBundleUrl("  https://x.com/b.json  ")).toBe(
      "https://x.com/b.json",
    );
  });

  it("returns empty for empty input", () => {
    expect(normalizeBundleUrl("")).toBe("");
    expect(normalizeBundleUrl("   ")).toBe("");
  });
});
