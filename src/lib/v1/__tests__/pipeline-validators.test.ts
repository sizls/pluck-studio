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
  validateBountyPayload,
  validateCustodyPayload,
  validateDragnetPayload,
  validateFingerprintPayload,
  validateMolePayload,
  validateNucleiPayload,
  validateOathPayload,
  validateRotatePayload,
  validateSbomAiPayload,
  validateTripwirePayload,
  validateWhistlePayload,
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

  it("all 11 validators reject arrays + primitives", () => {
    // After Wave 3, ALL Bureau validators are real — none are stubs.
    // Every validator MUST reject non-object payloads as the first
    // gate. Loop through the registry to lock the contract.
    for (const p of BUREAU_PIPELINES) {
      expect(PIPELINE_VALIDATORS[p]([]).ok).toBe(false);
      expect(PIPELINE_VALIDATORS[p]("hi").ok).toBe(false);
      expect(PIPELINE_VALIDATORS[p](null).ok).toBe(false);
    }
  });

  it("Wave-3 validators are the exported real functions (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:bounty"]).toBe(validateBountyPayload);
    expect(PIPELINE_VALIDATORS["bureau:sbom-ai"]).toBe(validateSbomAiPayload);
    expect(PIPELINE_VALIDATORS["bureau:rotate"]).toBe(validateRotatePayload);
    expect(PIPELINE_VALIDATORS["bureau:tripwire"]).toBe(
      validateTripwirePayload,
    );
    expect(PIPELINE_VALIDATORS["bureau:whistle"]).toBe(validateWhistlePayload);
  });

  it("NUCLEI entry IS the exported validateNucleiPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:nuclei"]).toBe(validateNucleiPayload);
  });

  it("OATH entry IS the exported validateOathPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:oath"]).toBe(validateOathPayload);
  });

  it("FINGERPRINT entry IS the exported validateFingerprintPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:fingerprint"]).toBe(validateFingerprintPayload);
  });

  it("CUSTODY entry IS the exported validateCustodyPayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:custody"]).toBe(validateCustodyPayload);
  });

  it("MOLE entry IS the exported validateMolePayload (single source of truth)", () => {
    expect(PIPELINE_VALIDATORS["bureau:mole"]).toBe(validateMolePayload);
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

const validFingerprint = {
  vendor: "openai",
  model: "gpt-4o",
  authorizationAcknowledged: true as const,
};

describe("validateFingerprintPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateFingerprintPayload(validFingerprint)).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateFingerprintPayload(null).ok).toBe(false);
    expect(validateFingerprintPayload("hi").ok).toBe(false);
    expect(validateFingerprintPayload([]).ok).toBe(false);
  });

  it("rejects missing vendor + model", () => {
    const r = validateFingerprintPayload({ authorizationAcknowledged: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Vendor and Model are required/);
    }
  });

  it("rejects vendor with dots", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      vendor: "openai.com",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/short lowercase slug/);
    }
  });

  it("rejects vendor with slash", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      vendor: "openai/foo",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects oversized vendor (>32 chars)", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      vendor: "a".repeat(33),
    });
    expect(r.ok).toBe(false);
  });

  it("rejects unsupported vendor slugs (hosted-mode allowlist)", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      vendor: "acme",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/not yet supported/);
    }
  });

  it("accepts a multi-component model slug", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      vendor: "anthropic",
      model: "claude-3-5-sonnet",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts a model slug with dots (llama-3.1-70b)", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      vendor: "meta",
      model: "llama-3.1-70b",
    });
    expect(r.ok).toBe(true);
  });

  it("rejects model with spaces", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      model: "gpt 4o",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when authorization not acknowledged", () => {
    const r = validateFingerprintPayload({
      ...validFingerprint,
      authorizationAcknowledged: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/authorized to scan/);
    }
  });
});

const validCustody = {
  bundleUrl: "https://example.com/bundle.intoto.jsonl",
  authorizationAcknowledged: true as const,
};

describe("validateCustodyPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateCustodyPayload(validCustody)).toEqual({ ok: true });
  });

  it("accepts a fully-formed payload with expectedVendor", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      expectedVendor: "openai.com",
    });
    expect(r).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateCustodyPayload(null).ok).toBe(false);
    expect(validateCustodyPayload("hi").ok).toBe(false);
    expect(validateCustodyPayload([]).ok).toBe(false);
  });

  it("rejects missing bundleUrl", () => {
    const r = validateCustodyPayload({ authorizationAcknowledged: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/Bundle URL is required/);
    }
  });

  it("rejects http:// (HTTPS-only per CUSTODY spec)", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      bundleUrl: "http://example.com/bundle.json",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/https:\/\//);
    }
  });

  it("rejects localhost bundleUrl", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      bundleUrl: "https://localhost/bundle.json",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects RFC1918 bundleUrl host", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      bundleUrl: "https://10.0.0.1/bundle.json",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects link-local bundleUrl host", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      bundleUrl: "https://169.254.169.254/",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects malformed bundleUrl", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      bundleUrl: "not-a-url",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects expectedVendor with scheme", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      expectedVendor: "https://openai.com",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects expectedVendor that is localhost", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      expectedVendor: "localhost",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when authorization not acknowledged", () => {
    const r = validateCustodyPayload({
      ...validCustody,
      authorizationAcknowledged: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/authorized to fetch this bundle/);
    }
  });
});

const validMole = {
  canaryId: "nyt-2024-01-15",
  canaryUrl: "https://example.com/canary.txt",
  fingerprintPhrases:
    "first unique-enough fingerprint phrase, second unique-enough phrase",
  authorizationAcknowledged: true as const,
};

describe("validateMolePayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateMolePayload(validMole)).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateMolePayload(null).ok).toBe(false);
    expect(validateMolePayload("hi").ok).toBe(false);
    expect(validateMolePayload([]).ok).toBe(false);
  });

  it("rejects malformed canaryId", () => {
    const r = validateMolePayload({ ...validMole, canaryId: "NYT 2024" });
    expect(r.ok).toBe(false);
  });

  it("rejects missing canaryUrl", () => {
    const r = validateMolePayload({ ...validMole, canaryUrl: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects http:// canaryUrl", () => {
    const r = validateMolePayload({
      ...validMole,
      canaryUrl: "http://example.com/canary.txt",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects localhost canaryUrl", () => {
    const r = validateMolePayload({
      ...validMole,
      canaryUrl: "https://localhost/canary.txt",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects link-local canaryUrl", () => {
    const r = validateMolePayload({
      ...validMole,
      canaryUrl: "https://169.254.169.254/canary.txt",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects empty fingerprint phrases", () => {
    const r = validateMolePayload({
      ...validMole,
      fingerprintPhrases: "",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-bounds (too short) phrases", () => {
    const r = validateMolePayload({
      ...validMole,
      fingerprintPhrases: "short",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects > 7 phrases", () => {
    const tooMany = Array(8)
      .fill("a unique-enough fingerprint phrase")
      .join(",");
    const r = validateMolePayload({
      ...validMole,
      fingerprintPhrases: tooMany,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects when authorization not acknowledged", () => {
    const r = validateMolePayload({
      ...validMole,
      authorizationAcknowledged: false,
    });
    expect(r.ok).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payloads carrying canaryBody", () => {
    const r = validateMolePayload({
      ...validMole,
      canaryBody: "the secret canary text",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/never accepts canary body content/i);
    }
  });

  it("PRIVACY INVARIANT — rejects payloads carrying canaryContent", () => {
    const r = validateMolePayload({
      ...validMole,
      canaryContent: "alternative leak channel",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/never accepts canary body content/i);
    }
  });

  it("PRIVACY INVARIANT — rejects even when canaryBody is empty/null", () => {
    // Defense-in-depth: even an explicit `canaryBody: null` indicates a
    // misbuilt client. Reject so the operator gets a hard error rather
    // than a quiet pass-through that might encourage future "let me set
    // canaryBody=…" usage.
    expect(
      validateMolePayload({ ...validMole, canaryBody: null }).ok,
    ).toBe(false);
    expect(
      validateMolePayload({ ...validMole, canaryBody: "" }).ok,
    ).toBe(false);
    expect(
      validateMolePayload({ ...validMole, canaryContent: undefined }).ok,
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Wave 3 — BOUNTY / SBOM-AI / ROTATE / TRIPWIRE / WHISTLE validator parity
// ---------------------------------------------------------------------------

const validBounty = {
  sourceRekorUuid: "a".repeat(64),
  target: "hackerone" as const,
  program: "openai",
  vendor: "openai",
  model: "gpt-4o",
  authorizationAcknowledged: true as const,
};

describe("validateBountyPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateBountyPayload(validBounty)).toEqual({ ok: true });
  });

  it("rejects non-objects", () => {
    expect(validateBountyPayload(null).ok).toBe(false);
    expect(validateBountyPayload([]).ok).toBe(false);
  });

  it("rejects missing source uuid", () => {
    expect(
      validateBountyPayload({ ...validBounty, sourceRekorUuid: "" }).ok,
    ).toBe(false);
  });

  it("rejects malformed source uuid", () => {
    expect(
      validateBountyPayload({ ...validBounty, sourceRekorUuid: "not-hex" }).ok,
    ).toBe(false);
  });

  it("rejects unknown target", () => {
    expect(
      validateBountyPayload({ ...validBounty, target: "intigriti" }).ok,
    ).toBe(false);
  });

  it("rejects program with dots", () => {
    expect(
      validateBountyPayload({ ...validBounty, program: "openai.com" }).ok,
    ).toBe(false);
  });

  it("rejects oversized model slug", () => {
    expect(
      validateBountyPayload({ ...validBounty, model: "a".repeat(65) }).ok,
    ).toBe(false);
  });

  it("rejects missing auth-ack", () => {
    expect(
      validateBountyPayload({
        ...validBounty,
        authorizationAcknowledged: false,
      }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with Bearer key", () => {
    const r = validateBountyPayload({ ...validBounty, Bearer: "tok_abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/auth-token-shaped/i);
    }
  });

  it("PRIVACY INVARIANT — rejects payload with H1_TOKEN", () => {
    expect(
      validateBountyPayload({ ...validBounty, H1_TOKEN: "tok_abc" }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with BUGCROWD_TOKEN", () => {
    expect(
      validateBountyPayload({ ...validBounty, BUGCROWD_TOKEN: "tok_abc" }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with API_KEY", () => {
    expect(
      validateBountyPayload({ ...validBounty, API_KEY: "tok_abc" }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with authorization", () => {
    expect(
      validateBountyPayload({ ...validBounty, authorization: "Bearer x" }).ok,
    ).toBe(false);
  });
});

const validSbomAi = {
  artifactUrl: "https://example.com/pack.json",
  artifactKind: "probe-pack" as const,
  authorizationAcknowledged: true as const,
};

describe("validateSbomAiPayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateSbomAiPayload(validSbomAi)).toEqual({ ok: true });
  });

  it("rejects missing artifactUrl", () => {
    expect(
      validateSbomAiPayload({ ...validSbomAi, artifactUrl: "" }).ok,
    ).toBe(false);
  });

  it("rejects http://", () => {
    expect(
      validateSbomAiPayload({
        ...validSbomAi,
        artifactUrl: "http://example.com/x",
      }).ok,
    ).toBe(false);
  });

  it("rejects localhost host", () => {
    expect(
      validateSbomAiPayload({
        ...validSbomAi,
        artifactUrl: "https://localhost/x",
      }).ok,
    ).toBe(false);
  });

  it("rejects link-local host", () => {
    expect(
      validateSbomAiPayload({
        ...validSbomAi,
        artifactUrl: "https://169.254.169.254/x",
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown artifactKind", () => {
    expect(
      validateSbomAiPayload({ ...validSbomAi, artifactKind: "made-up" }).ok,
    ).toBe(false);
  });

  it("rejects malformed expectedSha256", () => {
    expect(
      validateSbomAiPayload({ ...validSbomAi, expectedSha256: "not-hex" }).ok,
    ).toBe(false);
  });

  it("accepts well-formed expectedSha256", () => {
    expect(
      validateSbomAiPayload({
        ...validSbomAi,
        expectedSha256: "a".repeat(64),
      }),
    ).toEqual({ ok: true });
  });

  it("rejects missing auth-ack", () => {
    expect(
      validateSbomAiPayload({
        ...validSbomAi,
        authorizationAcknowledged: false,
      }).ok,
    ).toBe(false);
  });

  it("accepts each canonical artifactKind", () => {
    for (const kind of ["probe-pack", "model-card", "mcp-server"]) {
      expect(
        validateSbomAiPayload({ ...validSbomAi, artifactKind: kind }),
      ).toEqual({ ok: true });
    }
  });
});

const validRotate = {
  oldKeyFingerprint: "a".repeat(64),
  newKeyFingerprint: "b".repeat(64),
  reason: "compromised" as const,
  authorizationAcknowledged: true as const,
};

describe("validateRotatePayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateRotatePayload(validRotate)).toEqual({ ok: true });
  });

  it("rejects missing/malformed old fingerprint", () => {
    expect(
      validateRotatePayload({ ...validRotate, oldKeyFingerprint: "" }).ok,
    ).toBe(false);
    expect(
      validateRotatePayload({ ...validRotate, oldKeyFingerprint: "not-hex" })
        .ok,
    ).toBe(false);
  });

  it("rejects missing/malformed new fingerprint", () => {
    expect(
      validateRotatePayload({ ...validRotate, newKeyFingerprint: "" }).ok,
    ).toBe(false);
  });

  it("rejects old === new (no-op rotation)", () => {
    expect(
      validateRotatePayload({
        ...validRotate,
        newKeyFingerprint: "a".repeat(64),
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown reason", () => {
    expect(
      validateRotatePayload({ ...validRotate, reason: "made-up" }).ok,
    ).toBe(false);
  });

  it("rejects oversized operator note", () => {
    expect(
      validateRotatePayload({
        ...validRotate,
        operatorNote: "x".repeat(513),
      }).ok,
    ).toBe(false);
  });

  it("rejects missing auth-ack", () => {
    expect(
      validateRotatePayload({
        ...validRotate,
        authorizationAcknowledged: false,
      }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with privateKey", () => {
    const r = validateRotatePayload({
      ...validRotate,
      privateKey: "-----BEGIN PRIVATE KEY-----...",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/never accepts private-key material/i);
    }
  });

  it("PRIVACY INVARIANT — rejects payload with private_key", () => {
    expect(
      validateRotatePayload({ ...validRotate, private_key: "secret" }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with secret-shaped key", () => {
    expect(
      validateRotatePayload({ ...validRotate, keySecret: "secret" }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with PEM-shaped key", () => {
    expect(
      validateRotatePayload({ ...validRotate, pem: "-----BEGIN..." }).ok,
    ).toBe(false);
  });

  it("does NOT reject the legitimate keyFingerprint fields", () => {
    // Sanity — old/new key FINGERPRINT (sha256 of public material) is
    // explicitly allowed despite the "key" substring.
    expect(validateRotatePayload(validRotate)).toEqual({ ok: true });
  });
});

const validTripwire = {
  machineId: "alice-mbp",
  policySource: "default" as const,
  notarize: false,
  authorizationAcknowledged: true as const,
};

describe("validateTripwirePayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateTripwirePayload(validTripwire)).toEqual({ ok: true });
  });

  it("rejects missing machineId", () => {
    expect(
      validateTripwirePayload({ ...validTripwire, machineId: "" }).ok,
    ).toBe(false);
  });

  it("rejects machineId with spaces", () => {
    expect(
      validateTripwirePayload({ ...validTripwire, machineId: "alice mbp" })
        .ok,
    ).toBe(false);
  });

  it("rejects oversized machineId", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        machineId: "a".repeat(49),
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown policySource", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        policySource: "made-up",
      }).ok,
    ).toBe(false);
  });

  it("custom policy without URL is rejected", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        policySource: "custom",
        customPolicyUrl: "",
      }).ok,
    ).toBe(false);
  });

  it("custom policy http:// is rejected", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        policySource: "custom",
        customPolicyUrl: "http://example.com/p.json",
      }).ok,
    ).toBe(false);
  });

  it("custom policy localhost is rejected", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        policySource: "custom",
        customPolicyUrl: "https://localhost/p.json",
      }).ok,
    ).toBe(false);
  });

  it("custom policy link-local is rejected", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        policySource: "custom",
        customPolicyUrl: "https://169.254.169.254/p.json",
      }).ok,
    ).toBe(false);
  });

  it("custom policy with valid public https URL is accepted", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        policySource: "custom",
        customPolicyUrl: "https://example.com/p.json",
      }),
    ).toEqual({ ok: true });
  });

  it("rejects missing auth-ack", () => {
    expect(
      validateTripwirePayload({
        ...validTripwire,
        authorizationAcknowledged: false,
      }).ok,
    ).toBe(false);
  });
});

const validWhistle = {
  bundleUrl: "https://example.com/tip.json",
  category: "training-data" as const,
  routingPartner: "propublica" as const,
  anonymityCaveatAcknowledged: true as const,
  authorizationAcknowledged: true as const,
};

describe("validateWhistlePayload", () => {
  it("accepts a fully-formed payload", () => {
    expect(validateWhistlePayload(validWhistle)).toEqual({ ok: true });
  });

  it("rejects missing bundleUrl", () => {
    expect(
      validateWhistlePayload({ ...validWhistle, bundleUrl: "" }).ok,
    ).toBe(false);
  });

  it("rejects http:// bundleUrl", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        bundleUrl: "http://example.com/tip.json",
      }).ok,
    ).toBe(false);
  });

  it("rejects localhost bundleUrl", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        bundleUrl: "https://localhost/tip.json",
      }).ok,
    ).toBe(false);
  });

  it("rejects unknown category", () => {
    expect(
      validateWhistlePayload({ ...validWhistle, category: "made-up" }).ok,
    ).toBe(false);
  });

  it("rejects unknown routing partner", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        routingPartner: "rando-news",
      }).ok,
    ).toBe(false);
  });

  it("rejects oversized manualRedactPhrase", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        manualRedactPhrase: "x".repeat(257),
      }).ok,
    ).toBe(false);
  });

  it("rejects missing anonymity caveat ack", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        anonymityCaveatAcknowledged: false,
      }).ok,
    ).toBe(false);
  });

  it("rejects missing authorization ack", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        authorizationAcknowledged: false,
      }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with sourceName", () => {
    const r = validateWhistlePayload({
      ...validWhistle,
      sourceName: "Jane Doe",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/source-identifying/i);
    }
  });

  it("PRIVACY INVARIANT — rejects payload with sourceEmail", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        sourceEmail: "x@y.com",
      }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with sourceIp", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        sourceIp: "203.0.113.5",
      }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with source_handle", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        source_handle: "@jane",
      }).ok,
    ).toBe(false);
  });

  it("PRIVACY INVARIANT — rejects payload with reporterName", () => {
    expect(
      validateWhistlePayload({
        ...validWhistle,
        reporterName: "Alice",
      }).ok,
    ).toBe(false);
  });
});
