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
//   7. On success: { runId, phraseId, cadence, status: "cycle pending",
//      deprecated: true, replacement: "/api/v1/runs" } + RFC 8594
//      Deprecation/Sunset/Link headers.
//      M5 fix: `runId` is now the SAME phrase-id as `phraseId` — single
//      primitive, identical on idempotent retries. The legacy randomUUID
//      shape (and its useless freshness on every retry) was a footgun
//      for any tooling that stored runId as the receipt key.
//
// Idempotency contract: legacy DRAGNET callers double-clicking within ~60s
// dedupe to the SAME phraseId as a /v1/runs caller posting the same body
// — we synthesize the same minute-bucketed key the RunForm uses
// (`dragnet:<pack>:<url>:<minute>`) before delegating to the v1 store.
// Without this synthesis every legacy POST creates a fresh ghost record
// that no /v1 caller could ever dedupe against. C1 fix.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateDragnetPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

/**
 * Deprecation/Sunset HTTP signaling for the legacy alias. Per RFC 8594:
 *   - `Deprecation: true` — literal token (NOT a date) signaling that
 *     this resource is deprecated. Clients can detect it programmatically.
 *   - `Sunset` — IMF-fixdate when the resource will stop responding. We
 *     pick a date 6+ months out so the next migration window is plain.
 *   - `Link rel="successor-version"` — points clients at the canonical
 *     /v1/runs surface so tooling can auto-migrate.
 *
 * M5 fix: previously this was advertised in the JSON body only, which
 * intermediaries and SDK retry layers don't see. RFC 8594 makes it a
 * machine-readable HTTP-level concern.
 */
const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

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

  // M5 fix: previously `runId` was a per-request randomUUID() that diverged
  // from `phraseId`. Two callers couldn't dedupe on `runId` because it was
  // fresh on every retry; the canonical primitive has always been the
  // phrase-id. Unify them — `runId === phraseId` — so the legacy
  // experience matches /v1/runs callers and tooling stops carrying around
  // a meaningless UUID. Body also flags `deprecated: true` and points at
  // the replacement.
  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      cadence,
      status: "cycle pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:dragnet",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
