// ---------------------------------------------------------------------------
// POST /api/bureau/rotate/run — ROTATE rotate endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:rotate", payload: { ...this body... } }. !!
//
// Wave-3 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateRotatePayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. PRIVACY INVARIANT: private-key material NEVER enters this surface.
//      The shared validator rejects any payload key resembling private
//      key material (defense-in-depth — the operator's runner signs
//      revocations server-side with operator-held HSM keys).
//   4. SPKI fingerprint hex grammar + reason enum + old !== new + optional
//      operatorNote length cap + ToS / authorization assertion.
//   5. On success: { runId, phraseId, oldKeyFingerprint, newKeyFingerprint,
//      reason, status:"rotation pending", deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 8594 Deprecation/Sunset/Link
//      headers. runId === phraseId — single primitive, identical on
//      idempotent retries.
//
// Idempotency contract: legacy ROTATE callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the
// same body — we synthesize the same minute-bucketed key the RunForm
// uses (`rotate:<reason>:<oldKey>:<newKey>:<minute>`) before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateRotatePayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface RotateRequestBody {
  oldKeyFingerprint?: string;
  newKeyFingerprint?: string;
  reason?: string;
  operatorNote?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the ROTATE RunForm
 * sends to /v1/runs. Format:
 *   `rotate:<reason>:<oldKey>:<newKey>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record.
 */
function synthesizeIdempotencyKey(
  reason: string,
  oldKeyFingerprint: string,
  newKeyFingerprint: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `rotate:${reason}:${oldKeyFingerprint}:${newKeyFingerprint}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/rotate/run",
      },
      { status: 401 },
    );
  }
  let body: RotateRequestBody;
  try {
    body = (await req.json()) as RotateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting. Validator also enforces the privacy
  // invariant (rejects any private-key-material-shaped payload key).
  const result = validateRotatePayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const oldKeyFingerprint = (body.oldKeyFingerprint ?? "").trim().toLowerCase();
  const newKeyFingerprint = (body.newKeyFingerprint ?? "").trim().toLowerCase();
  const reason = (body.reason ?? "").trim();
  const operatorNoteRaw = (body.operatorNote ?? "").trim();

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical reason-scoped phraseId — that becomes the
  // user-facing runId.
  const { record } = createRun({
    pipeline: "bureau:rotate",
    payload: {
      oldKeyFingerprint,
      newKeyFingerprint,
      reason,
      // operatorNote is optional; omit when empty so canonicalJson
      // skips it and legacy + /v1/runs hash identically.
      operatorNote: operatorNoteRaw.length > 0 ? operatorNoteRaw : undefined,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(
      reason,
      oldKeyFingerprint,
      newKeyFingerprint,
    ),
  });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      oldKeyFingerprint,
      newKeyFingerprint,
      reason,
      status: "rotation pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:rotate",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
