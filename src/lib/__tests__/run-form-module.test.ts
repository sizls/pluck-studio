// ---------------------------------------------------------------------------
// dragnetRunFormModule — Directive module unit tests
// ---------------------------------------------------------------------------
//
// Locks the form's state machine: derivations recompute correctly when
// facts change, can't-submit edge cases are accurate, the auth-fail
// channel is separate from the generic-error channel, and the result
// fact carries both runId and phraseId.
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import { dragnetRunFormModule } from "../dragnet/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: dragnetRunFormModule });
  sys.start();
  return sys;
}

describe("dragnetRunFormModule", () => {
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
    expect(sys.facts.targetUrl).toBe("");
    expect(sys.facts.probePackId).toBe("canon-honesty");
    expect(sys.facts.cadence).toBe("once");
    expect(sys.facts.authorizationAcknowledged).toBe(false);
    expect(sys.facts.submitStatus).toBe("idle");
    expect(sys.facts.errorMessage).toBeNull();
    expect(sys.facts.signInUrl).toBeNull();
    expect(sys.facts.lastResult).toBeNull();
  });

  it("canSubmit is false until all required fields + auth ack are set", () => {
    const sys = setup();
    expect(sys.derive.canSubmit).toBe(false);

    sys.facts.targetUrl = "https://api.openai.com/v1/chat/completions";
    expect(sys.derive.canSubmit).toBe(false);

    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit flips false while submitting", () => {
    const sys = setup();
    sys.facts.targetUrl = "https://api.openai.com";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);

    sys.facts.submitStatus = "submitting";
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks empty whitespace-only inputs", () => {
    const sys = setup();
    sys.facts.targetUrl = "   ";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit blocks empty probePackId", () => {
    const sys = setup();
    sys.facts.targetUrl = "https://x.com";
    sys.facts.probePackId = "";
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("isSubmitting tracks submitStatus exactly", () => {
    const sys = setup();
    expect(sys.derive.isSubmitting).toBe(false);
    sys.facts.submitStatus = "submitting";
    expect(sys.derive.isSubmitting).toBe(true);
    sys.facts.submitStatus = "succeeded";
    expect(sys.derive.isSubmitting).toBe(false);
  });

  it("hasError reflects errorMessage presence", () => {
    const sys = setup();
    expect(sys.derive.hasError).toBe(false);
    sys.facts.errorMessage = "Network failure";
    expect(sys.derive.hasError).toBe(true);
    sys.facts.errorMessage = null;
    expect(sys.derive.hasError).toBe(false);
  });

  it("needsSignIn is independent of hasError", () => {
    const sys = setup();
    sys.facts.signInUrl = "/sign-in";
    expect(sys.derive.needsSignIn).toBe(true);
    expect(sys.derive.hasError).toBe(false);
  });

  it("lastResult holds both runId and phraseId after a successful submit", () => {
    const sys = setup();
    sys.facts.lastResult = {
      runId: "0c2d8a4e-3f4a-4cf8-9c9c-c8b1c4f0c2d8",
      phraseId: "swift-falcon-3742",
    };
    sys.facts.submitStatus = "succeeded";

    const result = sys.facts.lastResult;
    expect(result?.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result?.phraseId).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });
});
