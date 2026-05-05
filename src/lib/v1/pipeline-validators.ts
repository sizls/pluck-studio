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
// Migration status: ALL 11 Bureau pipelines now have REAL validators —
// every legacy /api/bureau/<slug>/run alias delegates here, and /v1/runs
// runs the same validator before persisting. One source of truth.
//   - bureau:dragnet     — extracted Phase 3 wedge.
//   - bureau:nuclei      — Wave 1 (cron grammar + license allowlist + …).
//   - bureau:oath        — Wave 1 (hostname grammar + private-IP block + …).
//   - bureau:fingerprint — Wave 2 (vendor slug + hosted-mode allowlist + …).
//   - bureau:custody     — Wave 2 (https-only bundleUrl + …).
//   - bureau:mole        — Wave 2 (canaryId slug + privacy invariant
//                          rejecting canaryBody / canaryContent).
//   - bureau:bounty      — Wave 3 (target enum + program slug + vendor/model
//                          slug grammar + auth-ack + privacy invariant
//                          rejecting any auth-token-shaped key).
//   - bureau:sbom-ai     — Wave 3 (artifactKind enum + https-only artifactUrl
//                          + private-IP block + optional expectedSha256).
//   - bureau:rotate      — Wave 3 (SPKI fingerprint grammar + reason enum +
//                          old !== new + privacy invariant rejecting any
//                          private-key-shaped key).
//   - bureau:tripwire    — Wave 3 (machineId slug + policySource enum +
//                          https-only customPolicyUrl when policySource
//                          = "custom" + private-IP block).
//   - bureau:whistle     — Wave 3 (https-only bundleUrl + category +
//                          routingPartner enums + anonymity caveat +
//                          privacy invariant rejecting any source-
//                          identifying key).
// ---------------------------------------------------------------------------

import {
  isValidProgramSlug,
  isValidRekorUuid as isValidBountyRekorUuid,
} from "../bounty/run-form-module";
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
import { isValidSpkiFingerprint } from "../rotate/run-form-module";
import { isValidSha256 } from "../sbom-ai/run-form-module";
import { isPrivateOrLocalHost } from "../security/request-guards";
import { isValidMachineId } from "../tripwire/run-form-module";

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
// BOUNTY — single source of truth for file-bounty payload rules.
//
// Mirrors the legacy /api/bureau/bounty/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (target enum,
// program slug grammar, vendor/model slug grammar, auth-ack) by hitting
// the unified surface directly.
//
// PRIVACY INVARIANT (defense-in-depth): the BOUNTY landing's "auth tokens
// stay LOCAL" posture means HackerOne / Bugcrowd tokens NEVER cross the
// form, the route, or the receipt. Studio reads operator-stored
// credentials at dispatch time. This validator REJECTS any payload key
// that looks like an auth token (Bearer-style header value, *_TOKEN env
// variable name, etc.) — wire-layer backstop in case a misbuilt client
// tries to "help" by forwarding a credential.
// ---------------------------------------------------------------------------

const BOUNTY_VALID_TARGETS = new Set(["hackerone", "bugcrowd"]);
const BOUNTY_VENDOR_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const BOUNTY_MODEL_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
// Reject any payload key that smells like an auth token. Match BOTH
// header-style ("authorization", "bearer") AND env-var-style
// ("H1_TOKEN", "BUGCROWD_TOKEN", "*_API_KEY"). Case-insensitive on the
// canonical lowercase form so "BEARER" and "bearer" both fail.
const BOUNTY_AUTH_TOKEN_KEY_PATTERN =
  /^(authorization|bearer|.*[_-]?token|.*[_-]?api[_-]?key|.*[_-]?secret)$/i;

export interface BountyPayload {
  sourceRekorUuid: string;
  target: "hackerone" | "bugcrowd";
  program: string;
  vendor: string;
  model: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:bounty` file-bounty payload. Identical to the rules
 * the legacy `/api/bureau/bounty/run` route enforces — both call sites
 * share THIS function so the contract cannot drift.
 */
export function validateBountyPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  // Privacy invariant — reject any key resembling an auth token. Wire-layer
  // backstop on the BOUNTY "auth tokens stay LOCAL" posture: even though
  // the receipt schema would never echo such a value, refusing it on the
  // wire prevents a misbuilt client from leaking the token into a server
  // log or a future receipt-extension.
  for (const key of Object.keys(body)) {
    if (BOUNTY_AUTH_TOKEN_KEY_PATTERN.test(key)) {
      return {
        ok: false,
        error:
          "BOUNTY never accepts auth-token-shaped fields on the wire — Studio reads operator-stored credentials at dispatch time. See the BOUNTY landing's 'auth tokens stay LOCAL' posture.",
      };
    }
  }

  const sourceRekorUuid =
    typeof body.sourceRekorUuid === "string"
      ? body.sourceRekorUuid.trim().toLowerCase()
      : "";
  const target =
    typeof body.target === "string" ? body.target.trim().toLowerCase() : "";
  const program =
    typeof body.program === "string" ? body.program.trim().toLowerCase() : "";
  const vendor =
    typeof body.vendor === "string" ? body.vendor.trim().toLowerCase() : "";
  const model =
    typeof body.model === "string" ? body.model.trim().toLowerCase() : "";

  if (!sourceRekorUuid) {
    return { ok: false, error: "Source Rekor UUID is required" };
  }
  if (!isValidBountyRekorUuid(sourceRekorUuid)) {
    return {
      ok: false,
      error: "Source Rekor UUID must be 64–80 hex characters",
    };
  }
  if (!BOUNTY_VALID_TARGETS.has(target)) {
    return { ok: false, error: "Target must be 'hackerone' or 'bugcrowd'" };
  }
  if (!program) {
    return {
      ok: false,
      error: "Program slug is required (e.g. 'openai')",
    };
  }
  if (!isValidProgramSlug(program)) {
    return {
      ok: false,
      error:
        "Program must be a short lowercase slug (e.g. 'openai'); no dots, no slashes.",
    };
  }
  if (!vendor || !BOUNTY_VENDOR_PATTERN.test(vendor)) {
    return {
      ok: false,
      error: "Vendor must be a short lowercase slug (e.g. 'openai')",
    };
  }
  if (!model || !BOUNTY_MODEL_PATTERN.test(model) || model.length > 64) {
    return {
      ok: false,
      error: "Model must be a slug like 'gpt-4o' or 'claude-3-5-sonnet'",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to file this bounty before submitting.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// SBOM-AI — single source of truth for publish-attestation payload rules.
//
// Mirrors the legacy /api/bureau/sbom-ai/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (artifactKind
// enum, https-only artifactUrl, private-IP block, optional expectedSha256
// grammar) by hitting the unified surface directly.
// ---------------------------------------------------------------------------

const SBOM_AI_VALID_KINDS = new Set(["probe-pack", "model-card", "mcp-server"]);
const SBOM_AI_ALLOWED_SCHEMES = new Set(["https:"]);

export interface SbomAiPayload {
  artifactUrl: string;
  artifactKind: "probe-pack" | "model-card" | "mcp-server";
  /** Optional cross-check against Studio's computed hash. */
  expectedSha256?: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:sbom-ai` publish-attestation payload. Identical to
 * the rules the legacy `/api/bureau/sbom-ai/run` route enforces — both
 * call sites share THIS function so the contract cannot drift.
 */
export function validateSbomAiPayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const artifactUrl =
    typeof body.artifactUrl === "string" ? body.artifactUrl.trim() : "";
  const artifactKind =
    typeof body.artifactKind === "string"
      ? body.artifactKind.trim().toLowerCase()
      : "";
  const expectedSha256 =
    typeof body.expectedSha256 === "string"
      ? body.expectedSha256.trim().toLowerCase()
      : "";

  if (!artifactUrl) {
    return {
      ok: false,
      error: "Artifact URL is required (https:// only)",
    };
  }
  if (!SBOM_AI_VALID_KINDS.has(artifactKind)) {
    return {
      ok: false,
      error:
        "Artifact kind must be one of 'probe-pack', 'model-card', 'mcp-server'",
    };
  }
  if (expectedSha256.length > 0 && !isValidSha256(expectedSha256)) {
    return {
      ok: false,
      error: "Expected sha256 must be 64 hex characters when provided",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to publish this artifact's provenance.",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(artifactUrl);
  } catch {
    return {
      ok: false,
      error: "Artifact URL must be a valid URL (include https://)",
    };
  }
  if (!SBOM_AI_ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { ok: false, error: "Artifact URL must use https://" };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      error:
        "Artifact URL cannot point at localhost, private, or link-local addresses.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// ROTATE — single source of truth for key-rotation payload rules.
//
// Mirrors the legacy /api/bureau/rotate/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (SPKI grammar,
// reason enum, old !== new, optional operator note bound, auth-ack)
// by hitting the unified surface directly.
//
// PRIVACY INVARIANT (defense-in-depth): ROTATE only ever sees PUBLIC
// SPKI fingerprints. Private-key material NEVER crosses Studio. This
// validator REJECTS any payload key resembling private-key material —
// wire-layer backstop in case a misbuilt client tries to "include the
// old private key for revocation proof". The runner signs the
// revocation server-side with operator-held HSM keys.
// ---------------------------------------------------------------------------

const ROTATE_VALID_REASONS = new Set(["compromised", "routine", "lost"]);
const ROTATE_MAX_NOTE_LENGTH = 512;
// Reject any payload key resembling private-key material. Spec calls
// for /private[_-]?key|secret/i; we expand to also catch PEM/JWK
// bundle field names ("priv", "p" alone, etc.) without false-positiving
// on legitimate keys we DO accept (oldKeyFingerprint, newKeyFingerprint).
const ROTATE_PRIVATE_MATERIAL_KEY_PATTERN =
  /(private[_-]?key|secret|privkey|pem)/i;

export interface RotatePayload {
  oldKeyFingerprint: string;
  newKeyFingerprint: string;
  reason: "compromised" | "routine" | "lost";
  operatorNote?: string;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:rotate` rotate-key payload. Identical to the rules
 * the legacy `/api/bureau/rotate/run` route enforces — both call sites
 * share THIS function so the contract cannot drift.
 */
export function validateRotatePayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  // Privacy invariant — reject any key resembling private key material.
  // We DO accept oldKeyFingerprint / newKeyFingerprint (those are public
  // SPKI hashes), but anything that looks like PEM/JWK content gets
  // rejected before we even look at it.
  for (const key of Object.keys(body)) {
    if (ROTATE_PRIVATE_MATERIAL_KEY_PATTERN.test(key)) {
      return {
        ok: false,
        error:
          "ROTATE never accepts private-key material on the wire — Studio receives only public SPKI fingerprints. The operator's runner signs revocations with operator-held HSM keys.",
      };
    }
  }

  const oldKeyFingerprint =
    typeof body.oldKeyFingerprint === "string"
      ? body.oldKeyFingerprint.trim().toLowerCase()
      : "";
  const newKeyFingerprint =
    typeof body.newKeyFingerprint === "string"
      ? body.newKeyFingerprint.trim().toLowerCase()
      : "";
  const reason =
    typeof body.reason === "string" ? body.reason.trim() : "";
  const operatorNote =
    typeof body.operatorNote === "string" ? body.operatorNote.trim() : "";

  if (!oldKeyFingerprint || !isValidSpkiFingerprint(oldKeyFingerprint)) {
    return {
      ok: false,
      error: "Old key fingerprint must be 64 hex characters",
    };
  }
  if (!newKeyFingerprint || !isValidSpkiFingerprint(newKeyFingerprint)) {
    return {
      ok: false,
      error: "New key fingerprint must be 64 hex characters",
    };
  }
  if (oldKeyFingerprint === newKeyFingerprint) {
    return {
      ok: false,
      error:
        "Old and new key fingerprints must differ — rotating to the same key is a no-op.",
    };
  }
  if (!ROTATE_VALID_REASONS.has(reason)) {
    return {
      ok: false,
      error: "Reason must be 'compromised', 'routine', or 'lost'",
    };
  }
  if (operatorNote.length > ROTATE_MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: `Operator note must be ≤ ${ROTATE_MAX_NOTE_LENGTH} characters.`,
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to rotate this key before submitting.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// TRIPWIRE — single source of truth for configure-deployment payload rules.
//
// Mirrors the legacy /api/bureau/tripwire/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (machineId
// slug grammar, policySource enum, https-only customPolicyUrl when
// policySource = "custom", private-IP block, auth-ack) by hitting the
// unified surface directly.
//
// SECURITY: customPolicyUrl is validated at submission. The Phase-2.5
// runner that ACTUALLY fetches the URL must re-validate scheme +
// re-resolve hostname + reject redirects + cap timeout/size + parse
// untrusted JSON (no eval). See the SECURITY block in the legacy
// route for the full runner contract.
// ---------------------------------------------------------------------------

const TRIPWIRE_VALID_POLICY_SOURCES = new Set(["default", "custom"]);
const TRIPWIRE_ALLOWED_SCHEMES = new Set(["https:"]);

export interface TripwirePayload {
  machineId: string;
  policySource: "default" | "custom";
  customPolicyUrl?: string;
  notarize: boolean;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:tripwire` configure-deployment payload. Identical
 * to the rules the legacy `/api/bureau/tripwire/run` route enforces —
 * both call sites share THIS function so the contract cannot drift.
 */
export function validateTripwirePayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  const machineId =
    typeof body.machineId === "string"
      ? body.machineId.trim().toLowerCase()
      : "";
  const policySource =
    typeof body.policySource === "string" ? body.policySource.trim() : "";
  const customPolicyUrl =
    typeof body.customPolicyUrl === "string"
      ? body.customPolicyUrl.trim()
      : "";

  if (!isValidMachineId(machineId)) {
    return {
      ok: false,
      error:
        "Machine ID must be a short lowercase slug (e.g. 'alice-mbp'); ≤ 48 chars, no spaces, no leading/trailing hyphen.",
    };
  }
  if (!TRIPWIRE_VALID_POLICY_SOURCES.has(policySource)) {
    return {
      ok: false,
      error: "Policy source must be 'default' or 'custom'",
    };
  }
  if (policySource === "custom") {
    if (!customPolicyUrl) {
      return {
        ok: false,
        error: "Custom policy URL is required when policy source = custom",
      };
    }
    let parsed: URL;
    try {
      parsed = new URL(customPolicyUrl);
    } catch {
      return {
        ok: false,
        error: "Custom policy URL must be a valid URL (include https://)",
      };
    }
    if (!TRIPWIRE_ALLOWED_SCHEMES.has(parsed.protocol)) {
      return { ok: false, error: "Custom policy URL must use https://" };
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return {
        ok: false,
        error:
          "Custom policy URL cannot point at localhost, private, or link-local addresses.",
      };
    }
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to deploy a tripwire on this machine.",
    };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// WHISTLE — single source of truth for submit-tip payload rules.
//
// Mirrors the legacy /api/bureau/whistle/run route's body validation so
// /v1/runs callers can't slip past program-specific rules (https-only
// bundleUrl, private-IP block, category enum, routingPartner enum,
// manualRedactPhrase length cap, both ack flags) by hitting the unified
// surface directly.
//
// PRIVACY INVARIANT (defense-in-depth): WHISTLE's load-bearing posture
// is anonymity. The receipt URL prefix is the routing-partner slug, NOT
// the source. The bundleUrl, while needed for canonical hashing
// (idempotency), MUST NOT echo back into the response body — only the
// category + routingPartner + status are operator-visible. This
// validator REJECTS any payload key resembling source-identifying
// metadata (sourceName, sourceEmail, sourceIp, etc.) — wire-layer
// backstop in case a misbuilt client tries to "be helpful" by
// forwarding identifying info.
// ---------------------------------------------------------------------------

const WHISTLE_ALLOWED_BUNDLE_SCHEMES = new Set(["https:"]);
const WHISTLE_VALID_CATEGORIES = new Set([
  "training-data",
  "policy-violation",
  "safety-incident",
]);
const WHISTLE_VALID_ROUTING_PARTNERS = new Set([
  "propublica",
  "bellingcat",
  "404media",
  "eff-press",
]);
const WHISTLE_MAX_REDACT_PHRASE_LENGTH = 256;
// Reject any payload key resembling source-identifying material.
// Anonymity-by-default — even an explicit "sourceName: null" indicates
// a misbuilt client. Reject so the operator gets a hard error rather
// than a quiet pass-through that might encourage future "let me set
// sourceName=…" usage.
const WHISTLE_SOURCE_KEY_PATTERN =
  /(source[_-]?(name|email|ip|address|phone|handle|user|id|identity|contact)|reporter[_-]?(name|email|ip|id))/i;

export interface WhistlePayload {
  bundleUrl: string;
  category: "training-data" | "policy-violation" | "safety-incident";
  routingPartner: "propublica" | "bellingcat" | "404media" | "eff-press";
  manualRedactPhrase?: string;
  anonymityCaveatAcknowledged: true;
  authorizationAcknowledged: true;
}

/**
 * Validate a `bureau:whistle` submit-tip payload. Identical to the rules
 * the legacy `/api/bureau/whistle/run` route enforces — both call sites
 * share THIS function so the contract cannot drift.
 */
export function validateWhistlePayload(payload: unknown): ValidatorResult {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = payload as Record<string, unknown>;

  // Privacy invariant — reject any source-identifying key. The receipt
  // schema already drops these at render; the validator backstops the
  // wire so a misbuilt client can't accidentally leak identity into a
  // server log or future receipt-extension.
  for (const key of Object.keys(body)) {
    if (WHISTLE_SOURCE_KEY_PATTERN.test(key)) {
      return {
        ok: false,
        error:
          "WHISTLE never accepts source-identifying fields on the wire — anonymity-by-default. Bundle the source's identity inside the encrypted bundle body if needed; never put it in the request payload.",
      };
    }
  }

  const bundleUrl =
    typeof body.bundleUrl === "string" ? body.bundleUrl.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const routingPartner =
    typeof body.routingPartner === "string" ? body.routingPartner.trim() : "";
  const manualRedactPhrase =
    typeof body.manualRedactPhrase === "string"
      ? body.manualRedactPhrase.trim()
      : "";

  if (!bundleUrl) {
    return {
      ok: false,
      error: "Bundle URL is required (https:// only)",
    };
  }
  if (!WHISTLE_VALID_CATEGORIES.has(category)) {
    return {
      ok: false,
      error:
        "Category must be one of 'training-data', 'policy-violation', 'safety-incident'",
    };
  }
  if (!WHISTLE_VALID_ROUTING_PARTNERS.has(routingPartner)) {
    return {
      ok: false,
      error:
        "Routing partner must be one of 'propublica', 'bellingcat', '404media', 'eff-press'",
    };
  }
  if (manualRedactPhrase.length > WHISTLE_MAX_REDACT_PHRASE_LENGTH) {
    return {
      ok: false,
      error: `Manual redact phrase must be ≤ ${WHISTLE_MAX_REDACT_PHRASE_LENGTH} characters.`,
    };
  }
  if (body.anonymityCaveatAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that anonymity is best-effort, NOT absolute, before submitting.",
    };
  }
  if (body.authorizationAcknowledged !== true) {
    return {
      ok: false,
      error:
        "You must acknowledge that you are authorized to submit this bundle.",
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
  if (!WHISTLE_ALLOWED_BUNDLE_SCHEMES.has(parsed.protocol)) {
    return { ok: false, error: "Bundle URL must use https://" };
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      error:
        "Bundle URL cannot point at localhost, private, or link-local addresses.",
    };
  }

  return { ok: true };
}

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
