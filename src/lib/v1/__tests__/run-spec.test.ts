// ---------------------------------------------------------------------------
// run-spec — unit tests for validateRunSpec envelope-shape checks
// ---------------------------------------------------------------------------
//
// Locks the envelope contract for /v1/runs:
//   - Body must be a JSON object
//   - Unknown top-level keys are rejected (forward-compatible)
//   - pipeline must be a known string
//   - payload must be a JSON object
//   - idempotencyKey must be string of 1..256 chars when present
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { validateRunSpec } from "../run-spec.js";

const validBody = {
  pipeline: "bureau:dragnet",
  payload: {
    targetUrl: "https://api.openai.com/v1/chat/completions",
    probePackId: "canon-honesty",
    cadence: "once",
    authorizationAcknowledged: true,
  },
};

describe("validateRunSpec — happy path", () => {
  it("accepts a fully-formed body", () => {
    const r = validateRunSpec(validBody);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.pipeline).toBe("bureau:dragnet");
      expect(r.spec.payload).toEqual(validBody.payload);
      expect(r.spec.idempotencyKey).toBeUndefined();
    }
  });

  it("accepts a body with idempotencyKey", () => {
    const r = validateRunSpec({ ...validBody, idempotencyKey: "abc-123" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.idempotencyKey).toBe("abc-123");
    }
  });
});

describe("validateRunSpec — unknown top-level key rejection (minor fix)", () => {
  it("rejects an unexpected top-level key", () => {
    const r = validateRunSpec({ ...validBody, extra: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/unexpected top-level key: extra/);
    }
  });

  it("rejects multiple unknown keys (first one wins in error)", () => {
    const r = validateRunSpec({ ...validBody, foo: 1, bar: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/unexpected top-level key/);
    }
  });

  it("does not reject when only allowed keys are present", () => {
    const r = validateRunSpec({
      pipeline: "bureau:dragnet",
      payload: {},
      idempotencyKey: "k",
    });
    expect(r.ok).toBe(true);
  });
});

describe("validateRunSpec — envelope errors", () => {
  it("rejects null", () => {
    expect(validateRunSpec(null).ok).toBe(false);
  });

  it("rejects arrays", () => {
    expect(validateRunSpec([]).ok).toBe(false);
  });

  it("rejects primitives", () => {
    expect(validateRunSpec("hi").ok).toBe(false);
    expect(validateRunSpec(42).ok).toBe(false);
    expect(validateRunSpec(true).ok).toBe(false);
  });

  it("rejects missing pipeline", () => {
    const r = validateRunSpec({ payload: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/pipeline/);
    }
  });

  it("rejects unknown pipeline", () => {
    const r = validateRunSpec({ pipeline: "made-up", payload: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Unknown pipeline/);
    }
  });

  it("rejects payload that is an array", () => {
    const r = validateRunSpec({ pipeline: "bureau:dragnet", payload: [] });
    expect(r.ok).toBe(false);
  });

  it("rejects payload that is null", () => {
    const r = validateRunSpec({ pipeline: "bureau:dragnet", payload: null });
    expect(r.ok).toBe(false);
  });

  it("rejects idempotencyKey that is not a string", () => {
    const r = validateRunSpec({ ...validBody, idempotencyKey: 12 });
    expect(r.ok).toBe(false);
  });

  it("rejects empty-string idempotencyKey", () => {
    const r = validateRunSpec({ ...validBody, idempotencyKey: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects an idempotencyKey longer than 256 chars", () => {
    const r = validateRunSpec({ ...validBody, idempotencyKey: "x".repeat(257) });
    expect(r.ok).toBe(false);
  });
});
