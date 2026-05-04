// ---------------------------------------------------------------------------
// oathRunFormModule — Directive module unit tests
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  normalizeVendorDomain,
  oathRunFormModule,
} from "../oath/run-form-module.js";

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
    expect(sys.facts.hostingOrigin).toBe("");
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

  it("effectiveHostingOrigin defaults to https://<domain>", () => {
    const sys = setup();
    sys.facts.vendorDomain = "openai.com";
    expect(sys.derive.effectiveHostingOrigin).toBe("https://openai.com");
  });

  it("effectiveHostingOrigin uses explicit override when provided", () => {
    const sys = setup();
    sys.facts.vendorDomain = "openai.com";
    sys.facts.hostingOrigin = "https://chat.openai.com";
    expect(sys.derive.effectiveHostingOrigin).toBe("https://chat.openai.com");
  });

  it("effectiveHostingOrigin lowercases the auto-generated host", () => {
    const sys = setup();
    sys.facts.vendorDomain = "OpenAI.COM";
    expect(sys.derive.effectiveHostingOrigin).toBe("https://openai.com");
  });

  it("effectiveHostingOrigin is empty when vendorDomain is empty", () => {
    const sys = setup();
    expect(sys.derive.effectiveHostingOrigin).toBe("");
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

describe("normalizeVendorDomain", () => {
  it("accepts a bare hostname", () => {
    expect(normalizeVendorDomain("openai.com")).toBe("openai.com");
  });

  it("extracts the hostname from a full URL", () => {
    expect(normalizeVendorDomain("https://openai.com/v1/chat")).toBe(
      "openai.com",
    );
    expect(normalizeVendorDomain("https://api.openai.com/v1")).toBe(
      "api.openai.com",
    );
    expect(normalizeVendorDomain("HTTPS://OpenAI.COM/")).toBe("openai.com");
  });

  it("handles http:// URLs (lowercased)", () => {
    expect(normalizeVendorDomain("http://example.com")).toBe("example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeVendorDomain("  openai.com  ")).toBe("openai.com");
    expect(normalizeVendorDomain("\thttps://openai.com\n")).toBe("openai.com");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeVendorDomain("")).toBe("");
    expect(normalizeVendorDomain("   ")).toBe("");
  });

  it("returns lowercased input on URL parse failure", () => {
    // Garbage that starts with http:// but is otherwise unparseable.
    expect(normalizeVendorDomain("https://")).toBe("https://");
  });

  it("does not strip path or query for bare-hostname-with-slash inputs", () => {
    // No scheme → not a URL parse path → input is returned lowercased.
    // Server-side HOSTNAME_PATTERN will reject it.
    expect(normalizeVendorDomain("openai.com/api")).toBe("openai.com/api");
  });
});
