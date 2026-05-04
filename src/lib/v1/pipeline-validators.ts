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
//   - bureau:oath / fingerprint / custody / whistle / bounty / sbom-ai /
//     rotate / tripwire / mole — STUB validators (accept any object).
//     These tighten as each program's RunForm migrates to /v1/runs. The
//     registry exists so the plumbing is in place.
// ---------------------------------------------------------------------------

import {
  isAllowedLicense,
  isValidAuthor,
  isValidPackName,
  isValidRekorUuid,
  parseVendorScope,
  validateCron,
} from "../nuclei/run-form-module";
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

// TODO(bureau:oath): tighten when OATH RunForm migrates to /v1/runs.
const validateOathPayload: PipelineValidator = passthroughObjectValidator;
// TODO(bureau:fingerprint): tighten when FINGERPRINT RunForm migrates to /v1/runs.
const validateFingerprintPayload: PipelineValidator = passthroughObjectValidator;
// TODO(bureau:custody): tighten when CUSTODY RunForm migrates to /v1/runs.
const validateCustodyPayload: PipelineValidator = passthroughObjectValidator;
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

// TODO(bureau:mole): tighten when MOLE RunForm migrates to /v1/runs.
const validateMolePayload: PipelineValidator = passthroughObjectValidator;

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
