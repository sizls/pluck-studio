// ---------------------------------------------------------------------------
// POST /api/bureau/bounty/run — BOUNTY file endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:bounty", payload: { ...this body... } }. !!
//
// Wave-3 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateBountyPayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. Per the BOUNTY landing's "auth tokens stay LOCAL" posture: tokens
//      NEVER appear in the request body or the response. The shared
//      validator REJECTS any payload key resembling an auth token —
//      defense-in-depth in case a misbuilt client tries to forward one.
//   4. Source-Rekor UUID hex grammar + target enum + program / vendor /
//      model slug grammar + ToS / authorization assertion.
//   5. On success: { runId, phraseId, target, program, vendor, model,
//      sourceRekorUuid, status:"filing pending", deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 8594 Deprecation/Sunset/Link
//      headers. runId === phraseId — single primitive, identical on
//      idempotent retries.
//
// Idempotency contract: legacy BOUNTY callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the
// same body — we synthesize the same minute-bucketed key the RunForm
// uses (`bounty:<target>:<program>:<sourceRekorUuid>:<minute>`) before
// delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateBountyPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface BountyRequestBody {
  sourceRekorUuid?: string;
  target?: string;
  program?: string;
  vendor?: string;
  model?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the BOUNTY RunForm
 * sends to /v1/runs. Format:
 *   `bounty:<target>:<program>:<sourceRekorUuid>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record.
 */
function synthesizeIdempotencyKey(
  target: string,
  program: string,
  sourceRekorUuid: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `bounty:${target}:${program}:${sourceRekorUuid}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/bounty/run",
      },
      { status: 401 },
    );
  }
  let body: BountyRequestBody;
  try {
    body = (await req.json()) as BountyRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting. Validator also enforces the privacy
  // invariant (rejects any auth-token-shaped payload key).
  const result = validateBountyPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const sourceRekorUuid = (body.sourceRekorUuid ?? "").trim().toLowerCase();
  const target = (body.target ?? "").trim().toLowerCase();
  const program = (body.program ?? "").trim().toLowerCase();
  const vendor = (body.vendor ?? "").trim().toLowerCase();
  const model = (body.model ?? "").trim().toLowerCase();

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical target-scoped phraseId — that becomes the
  // user-facing runId.
  const { record } = createRun({
    pipeline: "bureau:bounty",
    payload: {
      sourceRekorUuid,
      target,
      program,
      vendor,
      model,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(target, program, sourceRekorUuid),
  });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      target,
      program,
      vendor,
      model,
      sourceRekorUuid,
      status: "filing pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:bounty",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
