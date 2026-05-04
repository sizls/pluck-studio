// ---------------------------------------------------------------------------
// pipeline-validators — unit tests for the per-pipeline validator registry
// ---------------------------------------------------------------------------
//
// Locks two contracts:
//   1. The DRAGNET validator enforces every legacy /api/bureau/dragnet/run
//      rule (URL scheme allowlist, private-IP block, pack-ID grammar,
//      cadence, authorization ack).
//   2. The registry has an entry for every BureauPipeline — exhaustiveness
//      is enforced at the type level, but we belt-and-suspenders runtime
//      check it so import-time errors surface immediately.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  PIPELINE_VALIDATORS,
  validateDragnetPayload,
} from "../pipeline-validators.js";
import { BUREAU_PIPELINES } from "../run-spec.js";

const validDragnet = {
  targetUrl: "https://api.openai.com/v1/chat/completions",
  probePackId: "canon-honesty",
  cadence: "once" as const,
  authorizationAcknowledged: true as const,
};

describe("validateDragnetPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateDragnetPayload(validDragnet)).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateDragnetPayload(null).ok).toBe(false);
    expect(validateDragnetPayload("hi").ok).toBe(false);
    expect(validateDragnetPayload([]).ok).toBe(false);
  });

  it("rejects missing targetUrl + probePackId", () => {
    const r = validateDragnetPayload({ ...validDragnet, targetUrl: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Target endpoint and Probe-pack ID/);
    }
  });

  it("rejects missing authorizationAcknowledged", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      authorizationAcknowledged: undefined,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/authorized to probe/);
    }
  });

  it("rejects authorizationAcknowledged=false explicitly", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      authorizationAcknowledged: false,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects continuous cadence (coming-soon stub)", () => {
    const r = validateDragnetPayload({ ...validDragnet, cadence: "continuous" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Continuous monitoring is coming soon/);
    }
  });

  it("rejects unknown cadence value", () => {
    const r = validateDragnetPayload({ ...validDragnet, cadence: "weekly" });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed targetUrl", () => {
    const r = validateDragnetPayload({ ...validDragnet, targetUrl: "not-a-url" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/valid URL/);
    }
  });

  it("rejects javascript: scheme", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      targetUrl: "javascript:alert(1)",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/http:\/\/ or https:\/\//);
    }
  });

  it("rejects file: scheme", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      targetUrl: "file:///etc/passwd",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects http://localhost", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      targetUrl: "http://localhost:8080/",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/localhost.*private.*link-local/);
    }
  });

  it("rejects RFC1918 10.0.0.0/8", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      targetUrl: "http://10.0.0.1/",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects link-local 169.254.169.254 (AWS IMDS)", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      targetUrl: "http://169.254.169.254/latest/meta-data/",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown probe-pack id", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      probePackId: "canon-honestly",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Unknown probe-pack/);
    }
  });

  it("accepts a NUCLEI-qualified pack id", () => {
    const r = validateDragnetPayload({
      ...validDragnet,
      probePackId: "alice/honest-llm@1.0.0",
    });
    expect(r.ok).toBe(true);
  });
});

describe("PIPELINE_VALIDATORS registry", () => {
  it("has a validator for every BureauPipeline", () => {
    for (const p of BUREAU_PIPELINES) {
      expect(PIPELINE_VALIDATORS[p]).toBeTypeOf("function");
    }
  });

  it("DRAGNET entry IS the exported validateDragnetPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:dragnet"]).toBe(validateDragnetPayload);
  });

  it("stub validators accept any non-array object", () => {
    expect(PIPELINE_VALIDATORS["bureau:oath"]({ anything: 1 })).toEqual({
      ok: true,
    });
    expect(PIPELINE_VALIDATORS["bureau:nuclei"]({})).toEqual({ ok: true });
  });

  it("stub validators reject arrays + primitives", () => {
    expect(PIPELINE_VALIDATORS["bureau:oath"]([]).ok).toBe(false);
    expect(PIPELINE_VALIDATORS["bureau:oath"]("hi").ok).toBe(false);
    expect(PIPELINE_VALIDATORS["bureau:oath"](null).ok).toBe(false);
  });
});
