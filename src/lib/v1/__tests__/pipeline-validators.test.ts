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
  validateNucleiPayload,
  validateOathPayload,
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
    // OATH and NUCLEI are no longer stubs — they do real grammar
    // checking. See the dedicated describe blocks below.
    expect(PIPELINE_VALIDATORS["bureau:mole"]({})).toEqual({ ok: true });
    expect(PIPELINE_VALIDATORS["bureau:fingerprint"]({})).toEqual({ ok: true });
  });

  it("stub validators reject arrays + primitives", () => {
    expect(PIPELINE_VALIDATORS["bureau:mole"]([]).ok).toBe(false);
    expect(PIPELINE_VALIDATORS["bureau:mole"]("hi").ok).toBe(false);
    expect(PIPELINE_VALIDATORS["bureau:mole"](null).ok).toBe(false);
  });

  it("NUCLEI entry IS the exported validateNucleiPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:nuclei"]).toBe(validateNucleiPayload);
  });

  it("OATH entry IS the exported validateOathPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:oath"]).toBe(validateOathPayload);
  });
});

const validNuclei = {
  author: "alice",
  packName: "canon-honesty@0.1",
  sbomRekorUuid: "a".repeat(64),
  vendorScope: "openai/gpt-4o,anthropic/claude-3-5-sonnet",
  license: "MIT",
  recommendedInterval: "0 */4 * * *",
  authorizationAcknowledged: true as const,
};

describe("validateNucleiPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateNucleiPayload(validNuclei)).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateNucleiPayload(null).ok).toBe(false);
    expect(validateNucleiPayload("hi").ok).toBe(false);
    expect(validateNucleiPayload([]).ok).toBe(false);
  });

  it("rejects missing author", () => {
    const r = validateNucleiPayload({ ...validNuclei, author: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects oversized author (>32 chars)", () => {
    const r = validateNucleiPayload({ ...validNuclei, author: "a".repeat(33) });
    expect(r.ok).toBe(false);
  });

  it("rejects unversioned packName", () => {
    const r = validateNucleiPayload({ ...validNuclei, packName: "canon-honesty" });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed sbomRekorUuid", () => {
    const r = validateNucleiPayload({ ...validNuclei, sbomRekorUuid: "not-hex" });
    expect(r.ok).toBe(false);
  });

  it("rejects empty vendorScope", () => {
    const r = validateNucleiPayload({ ...validNuclei, vendorScope: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects vendorScope with invalid entries", () => {
    const r = validateNucleiPayload({
      ...validNuclei,
      vendorScope: "openai/gpt-4o,foo",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/foo/);
    }
  });

  it("rejects non-allowed license", () => {
    const r = validateNucleiPayload({ ...validNuclei, license: "WTFPL" });
    expect(r.ok).toBe(false);
  });

  it("rejects empty recommendedInterval", () => {
    const r = validateNucleiPayload({ ...validNuclei, recommendedInterval: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects oversized recommendedInterval (>64 chars)", () => {
    const r = validateNucleiPayload({
      ...validNuclei,
      recommendedInterval: "x".repeat(65),
    });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed cron grammar", () => {
    const r = validateNucleiPayload({
      ...validNuclei,
      recommendedInterval: "not cron",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/cron/i);
    }
  });

  it("rejects out-of-range cron ('0 25 * * *')", () => {
    const r = validateNucleiPayload({
      ...validNuclei,
      recommendedInterval: "0 25 * * *",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when authorizationAcknowledged is missing", () => {
    const r = validateNucleiPayload({
      ...validNuclei,
      authorizationAcknowledged: undefined,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when authorizationAcknowledged=false", () => {
    const r = validateNucleiPayload({
      ...validNuclei,
      authorizationAcknowledged: false,
    });
    expect(r.ok).toBe(false);
  });
});

const validOath = {
  vendorDomain: "openai.com",
  authorizationAcknowledged: true as const,
};

describe("validateOathPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateOathPayload(validOath)).toEqual({ ok: true });
  });

  it("accepts a fully-formed payload with explicit hostingOrigin", () => {
    const r = validateOathPayload({
      ...validOath,
      hostingOrigin: "https://chat.openai.com",
    });
    expect(r).toEqual({ ok: true });
  });

  it("accepts a full URL by extracting the hostname", () => {
    const r = validateOathPayload({
      ...validOath,
      vendorDomain: "https://openai.com/v1/chat",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts the legacy `expectedOrigin` field name (back-compat)", () => {
    const r = validateOathPayload({
      ...validOath,
      expectedOrigin: "https://chat.openai.com",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects non-objects", () => {
    expect(validateOathPayload(null).ok).toBe(false);
    expect(validateOathPayload("hi").ok).toBe(false);
    expect(validateOathPayload([]).ok).toBe(false);
  });

  it("rejects missing vendorDomain", () => {
    const r = validateOathPayload({ authorizationAcknowledged: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Vendor domain is required/);
    }
  });

  it("rejects vendorDomain that is a bare IP", () => {
    const r = validateOathPayload({ ...validOath, vendorDomain: "10.0.0.1" });
    expect(r.ok).toBe(false);
  });

  it("rejects vendorDomain that is localhost", () => {
    const r = validateOathPayload({ ...validOath, vendorDomain: "localhost" });
    expect(r.ok).toBe(false);
  });

  it("rejects single-label hostname (no TLD)", () => {
    const r = validateOathPayload({ ...validOath, vendorDomain: "openai" });
    expect(r.ok).toBe(false);
  });

  it("rejects vendorDomain with a path but no scheme", () => {
    const r = validateOathPayload({
      ...validOath,
      vendorDomain: "openai.com/api",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when authorization not acknowledged", () => {
    const r = validateOathPayload({
      ...validOath,
      authorizationAcknowledged: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/authorized to fetch/);
    }
  });

  it("rejects http:// hostingOrigin (HTTPS-only per OATH spec)", () => {
    const r = validateOathPayload({
      ...validOath,
      hostingOrigin: "http://openai.com",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/https:\/\//);
    }
  });

  it("rejects malformed hostingOrigin", () => {
    const r = validateOathPayload({
      ...validOath,
      hostingOrigin: "not-a-url",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects localhost hostingOrigin", () => {
    const r = validateOathPayload({
      ...validOath,
      hostingOrigin: "https://localhost",
    });
    expect(r.ok).toBe(false);
  });
});
