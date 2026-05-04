// ---------------------------------------------------------------------------
// POST /api/bureau/dragnet/run — DRAGNET activation endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:dragnet", payload: { ...this body... } }. !!
//
// This route stays alive as a deprecated alias so callers that haven't
// migrated yet keep working. Existing contract tests (CSRF, auth, body
// validation, rate limit, output shape) stay green — the entire prior
// validation chain runs verbatim. After a successful validation we
// hand the resulting payload to the unified /v1/runs in-memory store
// so the receipt page can read it back via /api/v1/runs/[id], same as
// a native /v1/runs caller.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. URL scheme allowlist + private-IP block.
//   4. Pack-ID allowlist — `canon-honesty` or `<author>/<pack>@<version>`.
//   5. Per-IP rate limit.
//   6. ToS / probe-authorization assertion.
//   7. On success: { runId, phraseId, cadence, status: "cycle pending" }.
//      `runId` here remains the legacy UUID (existing tests assert UUID
//      shape); `phraseId` is the phrase ID that doubles as the canonical
//      /v1/runs runId. The receipt URL on the frontend redirects to the
//      phrase, not the UUID.
//
// Idempotency contract: legacy DRAGNET callers double-clicking within ~60s
// dedupe to the SAME phraseId as a /v1/runs caller posting the same body
// — we synthesize the same minute-bucketed key the RunForm uses
// (`dragnet:<pack>:<url>:<minute>`) before delegating to the v1 store.
// Without this synthesis every legacy POST creates a fresh ghost record
// that no /v1 caller could ever dedupe against. C1 fix.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateDragnetPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

interface RunRequestBody {
  targetUrl?: string;
  probePackId?: string;
  cadence?: "once" | "continuous";
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the
 * `/bureau/dragnet/run` RunForm sends to /v1/runs. Format:
 *   `dragnet:<probePackId>:<targetUrl>:<minute-bucket>`
 *
 * This guarantees that a legacy double-click and a /v1/runs double-click
 * with the same payload land on the SAME stored run record — the legacy
 * route can no longer create ghost runs that diverge from the unified store.
 *
 * The minute-bucket has a known seam: a click at :59.9 and another at
 * :00.1 cross the bucket boundary and produce different keys. That's
 * acceptable for the dedupe goal (catch double-click bursts, not
 * deliberate "run again" minutes apart). Documented in V1_API.md.
 */
function synthesizeIdempotencyKey(
  targetUrl: string,
  probePackId: string,
  cadence: "once" | "continuous",
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);
  // Cadence is included so a future "once" + "continuous" toggle on the
  // same target+pack within the same minute would NOT collide. Today
  // continuous is rejected upstream, but the key shape is forward-stable.
  return `dragnet:${probePackId}:${targetUrl}:${cadence}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/dragnet/run",
      },
      { status: 401 },
    );
  }
  let body: RunRequestBody;
  try {
    body = (await req.json()) as RunRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting (M1 fix).
  const result = validateDragnetPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, these are guaranteed strings and a known
  // cadence value. Trim/default to mirror the validator's normalization.
  const targetUrl = (body.targetUrl ?? "").trim();
  const probePackId = (body.probePackId ?? "").trim();
  const cadence = body.cadence ?? "once";

  const legacyRunId = randomUUID();
  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical phrase-id-shaped runId (vendor-scoped, e.g.
  // `openai-swift-falcon-3742`) — that becomes the user-facing phraseId.
  //
  // We synthesize an idempotency key from (targetUrl, probePackId, cadence,
  // minute-bucket) so a double-click within the same minute returns the
  // SAME phraseId — both for legacy callers and for /v1/runs callers
  // posting the same body. Without this, every legacy POST created a
  // ghost run regardless of dedupe (C1 critical from the AE review).
  const { record } = createRun({
    pipeline: "bureau:dragnet",
    payload: {
      targetUrl,
      probePackId,
      cadence,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(targetUrl, probePackId, cadence),
  });

  return NextResponse.json(
    {
      runId: legacyRunId,
      phraseId: record.runId,
      cadence,
      status: "cycle pending",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:dragnet",
    },
    { status: 200 },
  );
}
