import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  fingerprintRunFormModule,
  isValidModelSlug,
  isValidVendorSlug,
} from "../fingerprint/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: fingerprintRunFormModule });
  sys.start();
  return sys;
}

describe("fingerprintRunFormModule", () => {
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
    expect(sys.facts.vendor).toBe("");
    expect(sys.facts.model).toBe("");
    expect(sys.facts.authorizationAcknowledged).toBe(false);
    expect(sys.facts.submitStatus).toBe("idle");
    expect(sys.derive.canSubmit).toBe(false);
    expect(sys.derive.targetSlug).toBe("");
  });

  it("canSubmit requires vendor + model + auth-ack", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.model = "gpt-4o";
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks whitespace-only inputs", () => {
    const sys = setup();
    sys.facts.vendor = "   ";
    sys.facts.model = "   ";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit flips false while submitting", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    sys.facts.model = "gpt-4o";
    sys.facts.authorizationAcknowledged = true;
    sys.facts.submitStatus = "submitting";
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("targetSlug composes vendor/model", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    sys.facts.model = "gpt-4o";
    expect(sys.derive.targetSlug).toBe("openai/gpt-4o");
  });

  it("targetSlug lowercases", () => {
    const sys = setup();
    sys.facts.vendor = "OpenAI";
    sys.facts.model = "GPT-4O";
    expect(sys.derive.targetSlug).toBe("openai/gpt-4o");
  });

  it("targetSlug is empty when either field is empty", () => {
    const sys = setup();
    sys.facts.vendor = "openai";
    expect(sys.derive.targetSlug).toBe("");
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

describe("isValidVendorSlug", () => {
  it("accepts canonical vendor slugs", () => {
    expect(isValidVendorSlug("openai")).toBe(true);
    expect(isValidVendorSlug("anthropic")).toBe(true);
    expect(isValidVendorSlug("meta")).toBe(true);
    expect(isValidVendorSlug("a")).toBe(true); // single-char OK (start = end)
    expect(isValidVendorSlug("ab")).toBe(true);
    expect(isValidVendorSlug("ai-21")).toBe(true);
  });

  it("rejects slugs starting or ending with hyphen", () => {
    expect(isValidVendorSlug("-openai")).toBe(false);
    expect(isValidVendorSlug("openai-")).toBe(false);
  });

  it("rejects empty / oversized / non-slug shapes", () => {
    expect(isValidVendorSlug("")).toBe(false);
    expect(isValidVendorSlug("Open AI")).toBe(false);
    expect(isValidVendorSlug("openai/")).toBe(false);
    expect(isValidVendorSlug("openai.com")).toBe(false);
    expect(isValidVendorSlug("a".repeat(33))).toBe(false);
    expect(isValidVendorSlug("UPPER")).toBe(false);
  });
});

describe("isValidModelSlug", () => {
  it("accepts model slugs with dots / hyphens / underscores", () => {
    expect(isValidModelSlug("gpt-4o")).toBe(true);
    expect(isValidModelSlug("claude-3-5-sonnet")).toBe(true);
    expect(isValidModelSlug("llama-3.1-70b")).toBe(true);
    expect(isValidModelSlug("gemini_1_5_pro")).toBe(true);
  });

  it("rejects invalid model shapes", () => {
    expect(isValidModelSlug("")).toBe(false);
    expect(isValidModelSlug("gpt 4o")).toBe(false);
    expect(isValidModelSlug("openai/gpt-4o")).toBe(false);
    expect(isValidModelSlug("a".repeat(65))).toBe(false);
  });
});
