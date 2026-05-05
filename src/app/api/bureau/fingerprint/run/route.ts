// ---------------------------------------------------------------------------
// POST /api/bureau/fingerprint/run — FINGERPRINT scan endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:fingerprint", payload: { ...this body... } }. !!
//
// Wave-2 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateFingerprintPayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. Vendor slug grammar + hosted-mode allowlist + model slug grammar +
//      ToS / authorization assertion.
//   4. On success: { runId, phraseId, vendor, model, status:"scan pending",
//      deprecated: true, replacement: "/api/v1/runs" } + RFC 8594
//      Deprecation/Sunset/Link headers. runId === phraseId — single
//      primitive, identical on idempotent retries (mirrors DRAGNET M5).
//
// Idempotency contract: legacy FINGERPRINT callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the same
// body — we synthesize the same minute-bucketed key the RunForm uses
// (`fingerprint:<vendor>:<model>:<minute>`) before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateFingerprintPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface FingerprintRequestBody {
  vendor?: string;
  model?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the FINGERPRINT
 * RunForm sends to /v1/runs. Format:
 *   `fingerprint:<vendor>:<model>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record. Mirrors DRAGNET's C1 fix.
 */
function synthesizeIdempotencyKey(
  vendor: string,
  model: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `fingerprint:${vendor}:${model}:${minuteBucket}`;
}

export async function POST(req: Request): Promise<Response> {
  if (!isSameSiteRequest(req)) {
    return NextResponse.json(
      { error: "cross-site request rejected" },
      { status: 403 },
    );
  }
  if (!rateLimitOk(req)) {
    return NextResponse.json(
      { error: "too many requests — slow down and try again in a minute" },
      { status: 429 },
    );
  }
  if (!isAuthed(req)) {
    return NextResponse.json(
      {
        error: "authentication required",
        signInUrl: "/sign-in?redirect=/bureau/fingerprint/run",
      },
      { status: 401 },
    );
  }
  let body: FingerprintRequestBody;
  try {
    body = (await req.json()) as FingerprintRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting.
  const result = validateFingerprintPayload(body);
  if (!result.ok) {
    // FINGERPRINT-specific affordance: when the failure is "vendor not in
    // hosted allowlist", echo the supportedVendors array so the client
    // can show the operator the alternatives. Mirrors the legacy shape.
    const isUnsupported = /not yet supported in hosted mode/.test(result.error);

    if (isUnsupported) {
      // Lazy import keeps this branch from pulling SUPPORTED_VENDORS into
      // the hot path on every request.
      const { SUPPORTED_VENDORS } = await import(
        "../../../../../lib/fingerprint/run-form-module"
      );

      return NextResponse.json(
        { error: result.error, supportedVendors: SUPPORTED_VENDORS },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const vendor = (body.vendor ?? "").trim().toLowerCase();
  const model = (body.model ?? "").trim().toLowerCase();

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical vendor-scoped phraseId — that becomes the
  // user-facing runId.
  //
  // Payload shape MUST match what the FINGERPRINT RunForm posts to
  // /v1/runs so (pipeline, payload, idempotencyKey) canonicalises
  // identically and legacy + /v1/runs callers converge on the SAME
  // phraseId.
  const { record } = createRun({
    pipeline: "bureau:fingerprint",
    payload: {
      vendor,
      model,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(vendor, model),
  });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      vendor,
      model,
      status: "scan pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:fingerprint",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
