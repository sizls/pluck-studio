// ---------------------------------------------------------------------------
// /v1/runs — per-pipeline payload validators
// ---------------------------------------------------------------------------
//
// `validateRunSpec` only does shallow shape-checking on the inbound body.
// The hard, program-specific rules — DRAGNET URL scheme allowlist + private-IP
// block + pack-ID grammar; NUCLEI cron grammar + license allowlist; etc. —
// historically lived inside each `/api/bureau/<slug>/run` route. When the
// /v1/runs unified surface landed, those rules were bypassed by callers that
// posted to `/v1/runs` directly: same body, same store, no per-program guard.
//
// This registry fixes that. Every Bureau pipeline maps to a validator
// function that runs AFTER `validateRunSpec` and BEFORE `createRun`. The
// legacy per-program routes call the SAME validator so there is one source
// of truth for "is this DRAGNET payload acceptable" — no drift between
// /v1/runs and /api/bureau/dragnet/run.
//
// Migration status:
//   - bureau:dragnet — REAL validator (extracted from the legacy route).
//   - bureau:nuclei  — REAL validator (M1 fix; cron grammar + license
//     allowlist + author/pack/rekor + vendor-scope parsing). Both /v1/runs
//     and the legacy /api/bureau/nuclei/run route share THIS function.
//   - bureau:oath    — REAL validator (hostname grammar + private-IP block
//     + hosting-origin https-only + auth-ack). Both /v1/runs and the legacy
//     /api/bureau/oath/run route share THIS function.
//   - bureau:fingerprint — REAL validator (vendor slug + hosted-mode
//     allowlist + model slug + auth-ack). Both /v1/runs and the legacy
//     /api/bureau/fingerprint/run route share THIS function.
//   - bureau:custody — REAL validator (https-only bundleUrl + private-IP
//     block + optional expectedVendor hostname + auth-ack). Both /v1/runs
//     and the legacy /api/bureau/custody/run route share THIS function.
//   - bureau:mole    — REAL validator (canaryId slug + https-only canaryUrl
//     + private-IP block + fingerprint phrase bounds + auth-ack +
//     privacy invariant: canaryBody / canaryContent are NEVER accepted).
//     Both /v1/runs and the legacy /api/bureau/mole/run route share
//     THIS function.
//   - bureau:whistle / bounty / sbom-ai / rotate / tripwire — STUB
//     validators (accept any object). These tighten as each program's
//     RunForm migrates to /v1/runs. The registry exists so the plumbing
//     is in place.
// ---------------------------------------------------------------------------

import {
  SUPPORTED_VENDORS,
  isSupportedVendor,
  isValidModelSlug,
  isValidVendorSlug,
} from "../fingerprint/run-form-module";
import {
  FINGERPRINT_BOUNDS,
  isValidCanaryId,
  parseFingerprintPhrases,
} from "../mole/run-form-module";
import {
  isAllowedLicense,
  isValidAuthor,
  isValidPackName,
  isValidRekorUuid,
  parseVendorScope,
  validateCron,
} from "../nuclei/run-form-module";
import { normalizeVendorDomain } from "../oath/run-form-module";
import { isPrivateOrLocalHost } from "../security/request-guards";

import { type BureauPipeline, BUREAU_PIPELINES } from "./run-spec";

export type ValidatorResult = { ok: true } | { ok: false; error: string };
export type PipelineValidator = (payload: unknown) => ValidatorResult;

// ---------------------------------------------------------------------------
// DRAGNET — single source of truth for activation payload rules.
// ---------------------------------------------------------------------------

const DRAGNET_ALLOWED_TARGET_SCHEMES = new Set(["http:", "https:"]);
const DRAGNET_BUNDLED_PACK_IDS = new Set(["canon-honesty"]);
const DRAGNET_QUALIFIED_PACK_ID =
  /^[a-z0-9_-]+\/[a-z0-9_-]+@[a-zA-Z0-9._+-]+$/;

function isAllowedDragnetPackId(id: string): boolean {
  return (
    DRAGNET_BUNDLED_PACK_IDS.has(id) || DRAGNET_QUALIFIED_PACK_ID.test(id)
  );
}

export interface DragnetPayload {
  targetUrl: string;
  probePackId: string;
  cadence: "once" | "continuous";
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:dragnet` activation payload. Identical to the rules
 * the legacy `/api/bureau/dragnet/run` route enforces — both call sites
 * share THIS function so the contract cannot drift.
 */
export function validateDragnetPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const rawTargetUrl = typeof body.targetUrl === "string" ? body.targetUrl : "";
  const rawProbePackId =
    typeof body.probePackId === "string" ? body.probePackId : "";
  const targetUrl = rawTargetUrl.trim();
  const probePackId = rawProbePackId.trim();
  const cadence = body.cadence === undefined ? "once" : body.cadence;

  if (!targetUrl || !probePackId) {
    return {
      ok: false,
      error: "Target endpoint and Probe-pack ID are required",
    };
  }
  if (cadence !== "once" && cadence !== "continuous") {
    return { ok: false, error: "Cadence must be 'once' or 'continuous'" };
  }
  if (cadence === "continuous") {
    return {
      ok: false,
      error:
        "Continuous monitoring is coming soon — for now, run once and we'll re-run on cycle when scheduling lands.",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to probe this target before running.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return {
      ok: false,
      error: "Target endpoint must be a valid URL (include https://)",
    };
  }
  if (!DRAGNET_ALLOWED_TARGET_SCHEMES.has(parsed.protocol)) {
    return {
      ok: false,
      error: "Target endpoint must use http:// or https://",
    };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      error:
        "Target endpoint cannot point at localhost, private, or link-local addresses.",
    };
  }
  if (!isAllowedDragnetPackId(probePackId)) {
    return {
      ok: false,
      error:
        "Unknown probe-pack. Use 'canon-honesty' (bundled) or a NUCLEI-qualified ID like 'author/pack@version'.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stub validators for the 10 programs that haven't migrated to /v1/runs yet.
// They accept any non-array object — same shape-check `validateRunSpec`
// already enforced. When each program's RunForm migrates, swap the stub
// for the real per-program validator (mirroring DRAGNET above).
// ---------------------------------------------------------------------------

function passthroughObjectValidator(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }

  return { ok: true };
}

// TODO(bureau:whistle): tighten when WHISTLE RunForm migrates to /v1/runs.
const validateWhistlePayload: PipelineValidator = passthroughObjectValidator;
// TODO(bureau:bounty): tighten when BOUNTY RunForm migrates to /v1/runs.
const validateBountyPayload: PipelineValidator = passthroughObjectValidator;
// TODO(bureau:sbom-ai): tighten when SBOM-AI RunForm migrates to /v1/runs.
const validateSbomAiPayload: PipelineValidator = passthroughObjectValidator;
// TODO(bureau:rotate): tighten when ROTATE RunForm migrates to /v1/runs.
const validateRotatePayload: PipelineValidator = passthroughObjectValidator;
// TODO(bureau:tripwire): tighten when TRIPWIRE RunForm migrates to /v1/runs.
const validateTripwirePayload: PipelineValidator = passthroughObjectValidator;

// ---------------------------------------------------------------------------
// NUCLEI — single source of truth for publish payload rules.
//
// Mirrors the legacy /api/bureau/nuclei/run route's body validation so /v1/runs
// callers can't slip past program-specific rules (cron grammar, license
// allowlist, etc.) by hitting the unified surface directly. M1 fix.
// ---------------------------------------------------------------------------

const NUCLEI_MAX_INTERVAL_LENGTH = 64;

export interface NucleiPayload {
  author: string;
  packName: string;
  sbomRekorUuid: string;
  vendorScope: string;
  license: string;
  recommendedInterval: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:nuclei` publish payload. Identical to the rules the
 * legacy `/api/bureau/nuclei/run` route enforces — both call sites share
 * THIS function so the contract cannot drift.
 */
export function validateNucleiPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const author =
    typeof body.author === "string" ? body.author.trim().toLowerCase() : "";
  const packName =
    typeof body.packName === "string" ? body.packName.trim() : "";
  const sbomRekorUuid =
    typeof body.sbomRekorUuid === "string"
      ? body.sbomRekorUuid.trim().toLowerCase()
      : "";
  const vendorScope =
    typeof body.vendorScope === "string" ? body.vendorScope.trim() : "";
  const license =
    typeof body.license === "string" ? body.license.trim() : "";
  const recommendedInterval =
    typeof body.recommendedInterval === "string"
      ? body.recommendedInterval.trim()
      : "";

  if (!isValidAuthor(author)) {
    return {
      ok: false,
      error: "Author must be a short lowercase slug (e.g. 'alice')",
    };
  }
  if (!isValidPackName(packName)) {
    return {
      ok: false,
      error:
        "Pack name must be in the form '<slug>@<version>' (e.g. 'canon-honesty@0.1')",
    };
  }
  if (!isValidRekorUuid(sbomRekorUuid)) {
    return {
      ok: false,
      error:
        "SBOM-AI Rekor UUID is required (64–80 hex characters). Without an SBOM-AI cross-reference, the entry would land at trustTier='ingested' and consumers would refuse it.",
    };
  }
  const { pairs, invalid } = parseVendorScope(vendorScope);
  if (pairs.length === 0) {
    return {
      ok: false,
      error:
        "Vendor scope must include at least one valid 'vendor/model' pair",
    };
  }
  if (invalid.length > 0) {
    return {
      ok: false,
      error: `Vendor scope contains malformed entries: ${invalid.join(", ")}`,
    };
  }
  if (!isAllowedLicense(license)) {
    return {
      ok: false,
      error: "License must be one of the allowed SPDX identifiers",
    };
  }
  if (
    recommendedInterval.length === 0 ||
    recommendedInterval.length > NUCLEI_MAX_INTERVAL_LENGTH
  ) {
    return {
      ok: false,
      error: `Recommended interval is required, ≤ ${NUCLEI_MAX_INTERVAL_LENGTH} characters.`,
    };
  }
  if (!validateCron(recommendedInterval)) {
    return {
      ok: false,
      error:
        "Recommended interval must be a valid 5-field cron expression (e.g. '0 */4 * * *').",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to publish this pack and the SBOM-AI cross-reference is genuine.",
    };
  }

  return { ok: true };
}


// ---------------------------------------------------------------------------
// OATH — single source of truth for verify payload rules.
//
// Mirrors the legacy /api/bureau/oath/run route's body validation so /v1/runs
// callers can't slip past program-specific rules (hostname grammar, hosting
// origin scheme, private-IP block, auth-ack) by hitting the unified surface
// directly.
// ---------------------------------------------------------------------------

const OATH_HOSTNAME_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const OATH_ALLOWED_ORIGIN_SCHEMES = new Set(["https:"]);

function isValidOathVendorDomain(s: string): boolean {
  // Bare hostname, no scheme, no path. Requires at least one dot
  // (TLD-bearing). Rejects IPs (no dots in the right pattern) + any
  // private/local hosts the operator might paste by mistake.
  const lowered = s.toLowerCase();
  if (!OATH_HOSTNAME_PATTERN.test(lowered)) {
    return false;
  }
  if (isPrivateOrLocalHost(lowered)) {
    return false;
  }

  return true;
}

export interface OathPayload {
  vendorDomain: string;
  hostingOrigin?: string;
  /** Back-compat alias for hostingOrigin. */
  expectedOrigin?: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:oath` verify payload. Identical to the rules the
 * legacy `/api/bureau/oath/run` route enforces — both call sites share
 * THIS function so the contract cannot drift.
 */
export function validateOathPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const rawVendorDomain =
    typeof body.vendorDomain === "string" ? body.vendorDomain : "";
  const vendorDomain = normalizeVendorDomain(rawVendorDomain);
  // hostingOrigin is canonical; expectedOrigin is the legacy alias.
  const rawHostingOrigin =
    typeof body.hostingOrigin === "string"
      ? body.hostingOrigin
      : typeof body.expectedOrigin === "string"
        ? body.expectedOrigin
        : "";
  const hostingOrigin = rawHostingOrigin.trim();

  if (!vendorDomain) {
    return {
      ok: false,
      error: "Vendor domain is required (e.g. 'openai.com')",
    };
  }
  if (!isValidOathVendorDomain(vendorDomain)) {
    return {
      ok: false,
      error:
        "Vendor domain must be a public hostname (e.g. 'openai.com'); no IPs, no localhost, no scheme, no path.",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to fetch this vendor's oath before running.",
    };
  }
  if (hostingOrigin.length > 0) {
    let parsed: URL;
    try {
      parsed = new URL(hostingOrigin);
    } catch {
      return {
        ok: false,
        error: "Hosting origin must be a valid URL (include https://)",
      };
    }
    if (!OATH_ALLOWED_ORIGIN_SCHEMES.has(parsed.protocol)) {
      return {
        ok: false,
        error: "Hosting origin must use https:// (per OATH wire spec)",
      };
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return {
        ok: false,
        error:
          "Hosting origin cannot point at localhost, private, or link-local addresses.",
      };
    }
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// FINGERPRINT — single source of truth for scan payload rules.
//
// Mirrors the legacy /api/bureau/fingerprint/run route's body validation
// so /v1/runs callers can't slip past program-specific rules (vendor
// slug grammar, hosted-mode allowlist, model slug grammar, auth-ack)
// by hitting the unified surface directly.
// ---------------------------------------------------------------------------

export interface FingerprintPayload {
  vendor: string;
  model: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:fingerprint` scan payload. Identical to the rules
 * the legacy `/api/bureau/fingerprint/run` route enforces — both call
 * sites share THIS function so the contract cannot drift.
 */
export function validateFingerprintPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const vendor =
    typeof body.vendor === "string" ? body.vendor.trim().toLowerCase() : "";
  const model =
    typeof body.model === "string" ? body.model.trim().toLowerCase() : "";

  if (!vendor || !model) {
    return {
      ok: false,
      error: "Vendor and Model are required (e.g. 'openai' + 'gpt-4o')",
    };
  }
  if (!isValidVendorSlug(vendor)) {
    return {
      ok: false,
      error:
        "Vendor must be a short lowercase slug (e.g. 'openai', 'anthropic'); no spaces, no dots, no slashes.",
    };
  }
  if (!isSupportedVendor(vendor)) {
    return {
      ok: false,
      error: `Vendor '${vendor}' is not yet supported in hosted mode. Supported: ${SUPPORTED_VENDORS.join(", ")}. Run the CLI with --responder for unsupported vendors.`,
    };
  }
  if (!isValidModelSlug(model)) {
    return {
      ok: false,
      error:
        "Model must be a slug like 'gpt-4o' or 'claude-3-5-sonnet'; lowercase letters, digits, '.', '-', '_' only.",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to scan this vendor's model before running.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// CUSTODY — single source of truth for verify-bundle payload rules.
//
// Mirrors the legacy /api/bureau/custody/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (https-only
// bundleUrl, private-IP block, optional expectedVendor hostname grammar,
// auth-ack) by hitting the unified surface directly.
// ---------------------------------------------------------------------------

const CUSTODY_ALLOWED_BUNDLE_SCHEMES = new Set(["https:"]);
const CUSTODY_VENDOR_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isValidCustodyExpectedVendor(s: string): boolean {
  const lowered = s.toLowerCase();
  if (!CUSTODY_VENDOR_PATTERN.test(lowered)) {
    return false;
  }
  if (isPrivateOrLocalHost(lowered)) {
    return false;
  }

  return true;
}

export interface CustodyPayload {
  bundleUrl: string;
  expectedVendor?: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:custody` verify-bundle payload. Identical to the
 * rules the legacy `/api/bureau/custody/run` route enforces — both call
 * sites share THIS function so the contract cannot drift.
 */
export function validateCustodyPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const bundleUrl =
    typeof body.bundleUrl === "string" ? body.bundleUrl.trim() : "";
  const expectedVendor =
    typeof body.expectedVendor === "string"
      ? body.expectedVendor.trim().toLowerCase()
      : "";

  if (!bundleUrl) {
    return {
      ok: false,
      error: "Bundle URL is required (https:// only, public host)",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to fetch this bundle before running.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(bundleUrl);
  } catch {
    return {
      ok: false,
      error: "Bundle URL must be a valid URL (include https://)",
    };
  }
  if (!CUSTODY_ALLOWED_BUNDLE_SCHEMES.has(parsed.protocol)) {
    return {
      ok: false,
      error: "Bundle URL must use https:// (per CUSTODY wire spec)",
    };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      error:
        "Bundle URL cannot point at localhost, private, or link-local addresses.",
    };
  }
  if (expectedVendor.length > 0 && !isValidCustodyExpectedVendor(expectedVendor)) {
    return {
      ok: false,
      error:
        "Expected vendor must be a public hostname (e.g. 'openai.com'); no IPs, no localhost, no scheme, no path.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// MOLE — single source of truth for seal-canary payload rules.
//
// Mirrors the legacy /api/bureau/mole/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (canaryId
// grammar, https-only canaryUrl, private-IP block, fingerprint phrase
// length + count bounds, auth-ack) by hitting the unified surface
// directly.
//
// PRIVACY INVARIANT (defense-in-depth): the canary BODY never enters the
// Studio request boundary. This validator REJECTS any payload carrying
// `canaryBody` or `canaryContent`. The receipt schema already excludes
// these fields; the validator backstops the wire.
// ---------------------------------------------------------------------------

const MOLE_ALLOWED_CANARY_SCHEMES = new Set(["https:"]);

export interface MolePayload {
  canaryId: string;
  canaryUrl: string;
  fingerprintPhrases: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:mole` seal-canary payload. Identical to the rules
 * the legacy `/api/bureau/mole/run` route enforces — both call sites
 * share THIS function so the contract cannot drift.
 */
export function validateMolePayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  // Privacy invariant: the canary body is NEVER published. Reject any
  // payload that supplies `canaryBody` or `canaryContent` so a misbuilt
  // client can't accidentally leak the body into the Studio surface.
  // Receipt schema already drops these fields; this is the wire-layer
  // backstop.
  if ("canaryBody" in body || "canaryContent" in body) {
    return {
      ok: false,
      error:
        "MOLE never accepts canary body content on the wire. Only canaryUrl + sha256-hashed fingerprint phrases enter the public log.",
    };
  }

  const canaryId =
    typeof body.canaryId === "string" ? body.canaryId.trim().toLowerCase() : "";
  const canaryUrl =
    typeof body.canaryUrl === "string" ? body.canaryUrl.trim() : "";
  const fingerprintPhrases =
    typeof body.fingerprintPhrases === "string"
      ? body.fingerprintPhrases.trim()
      : "";

  if (!isValidCanaryId(canaryId)) {
    return {
      ok: false,
      error:
        "Canary ID must be a short lowercase slug (e.g. 'nyt-2024-01-15')",
    };
  }
  if (!canaryUrl) {
    return {
      ok: false,
      error: "Canary URL is required (https:// only)",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(canaryUrl);
  } catch {
    return {
      ok: false,
      error: "Canary URL must be a valid URL (include https://)",
    };
  }
  if (!MOLE_ALLOWED_CANARY_SCHEMES.has(parsed.protocol)) {
    return {
      ok: false,
      error: "Canary URL must use https://",
    };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      error:
        "Canary URL cannot point at localhost, private, or link-local addresses.",
    };
  }
  const { phrases, outOfBounds } = parseFingerprintPhrases(fingerprintPhrases);
  if (outOfBounds.length > 0) {
    return {
      ok: false,
      error: `Fingerprint phrases must be ${FINGERPRINT_BOUNDS.MIN_LENGTH}–${FINGERPRINT_BOUNDS.MAX_LENGTH} chars; out-of-bounds: ${outOfBounds.join(" | ")}`,
    };
  }
  if (phrases.length === 0) {
    return {
      ok: false,
      error: "At least one fingerprint phrase is required",
    };
  }
  if (phrases.length > FINGERPRINT_BOUNDS.MAX_COUNT) {
    return {
      ok: false,
      error: `Maximum ${FINGERPRINT_BOUNDS.MAX_COUNT} fingerprint phrases (got ${phrases.length})`,
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge the canary-content-stays-private posture and authorization to seal.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Registry — one entry per Bureau pipeline. Compile-time exhaustiveness
// guaranteed by the Record<BureauPipeline, …> type below.
// ---------------------------------------------------------------------------

export const PIPELINE_VALIDATORS: Record<BureauPipeline, PipelineValidator> = {
  "bureau:dragnet": validateDragnetPayload,
  "bureau:oath": validateOathPayload,
  "bureau:fingerprint": validateFingerprintPayload,
  "bureau:custody": validateCustodyPayload,
  "bureau:whistle": validateWhistlePayload,
  "bureau:bounty": validateBountyPayload,
  "bureau:sbom-ai": validateSbomAiPayload,
  "bureau:rotate": validateRotatePayload,
  "bureau:tripwire": validateTripwirePayload,
  "bureau:nuclei": validateNucleiPayload,
  "bureau:mole": validateMolePayload,
};

// Belt-and-suspenders runtime check — if BUREAU_PIPELINES grows and someone
// forgets to add an entry to PIPELINE_VALIDATORS, this throws at import time
// in dev. The `Record<BureauPipeline, …>` already enforces this at the type
// level; this catches the (rare) case where the union and the array drift.
for (const p of BUREAU_PIPELINES) {
  if (!(p in PIPELINE_VALIDATORS)) {
    throw new Error(
      `[pipeline-validators] missing validator for bureau pipeline: ${p}`,
    );
  }
}
