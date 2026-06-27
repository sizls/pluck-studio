// ---------------------------------------------------------------------------
// GET /api/v1/runs/[id] — fetch a single run record (STUB)
// ---------------------------------------------------------------------------
//
// Returns the full RunRecord shape for a given runId (a phrase ID, e.g.
// `openai-swift-falcon-3742`). The receipt page on each program
// reads from this endpoint when migrated; the page falls back to its
// pre-/v1 stub when the runId isn't in the store (lets old phrase IDs
// keep rendering during the migration runway).
//
// GET is public read by phraseId — anyone with the URL can read the
// receipt. The phraseId itself is the share credential (the
// "Google Docs share link" model — the other 11 program receipt pages
// don't auth-gate their server-side data reads either). POST stays
// auth-gated. Same-site (CSRF) and rate-limit gates still apply on GET
// to keep abuse and cross-site scrapers in check.
//
// PRIVACY: the run-store holds the FULL canonical payload (so the
// idempotency hash stays stable across retries), but some pipelines
// carry fields that MUST NOT echo to a phraseId-credentialed reader —
// most notably WHISTLE.bundleUrl (anonymity hazard) and ROTATE.operatorNote
// (incident-detail hazard). The per-pipeline redactor in `lib/v1/redact.ts`
// strips those fields from the GET response shape; the stored record is
// untouched. See `lib/v1/redact.ts` for the full registry.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  ownerIdFromRequest,
  rateLimit,
  rateLimitHeaders,
} from "../../../../../lib/security/request-guards";
import { redactPayloadForGet } from "../../../../../lib/v1/redact";
import { cancelRun, getRun } from "../../../../../lib/v1/run-store";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isSameSiteRequest(req)) {
    return NextResponse.json(
      { error: "cross-site request rejected" },
      { status: 403 },
    );
  }
  {
    const rl = rateLimit(req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too many requests — slow down and try again in a minute" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
  }

  const { id } = await context.params;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return NextResponse.json(
      { error: "invalid run id" },
      { status: 400 },
    );
  }

  const record = getRun(id);
  if (record === null) {
    return NextResponse.json(
      { error: "run not found" },
      { status: 404 },
    );
  }

  // Per-pipeline GET-side redaction. Strips fields that participated in
  // the canonical idempotency hash but MUST NOT echo to a phraseId-
  // credentialed reader (WHISTLE.bundleUrl + manualRedactPhrase,
  // ROTATE.operatorNote, …). Pass-through for pipelines without
  // privacy-sensitive persisted fields. The stored record is untouched —
  // a future GET re-derives the safe view from the same record.
  const safe = {
    ...record,
    payload: redactPayloadForGet(record.pipeline, record.payload),
  };

  return NextResponse.json(safe, { status: 200 });
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/runs/[id] — cancel a pending or running run
// ---------------------------------------------------------------------------
//
// Completes the v1 read+write CRUD-style surface (POST / GET-list /
// GET-by-id / DELETE). DELETE is the cancel verb — it does NOT erase
// the record. A cancelled run still resolves through GET so its
// receipt URL stays valid for audit + share.
//
// Status transitions (canonical — matches `cancelRun` in run-store.ts):
//   pending   → cancelled       (200 + record echo)
//   running   → cancelled       (200 + record echo; real backend signals runner)
//   anchored  → 409             (already-final, can't undo)
//   failed    → 409             (already-final)
//   cancelled → 200 idempotent  (returns alreadyCancelled=true; record unchanged)
//   missing   → 404
//
// AUTH: same gate as POST — `isAuthed` + `isSameSiteRequest` +
// `rateLimitOk`. NOT public-read like GET. Cancelling is state-
// modifying; callers must hold a Supabase session cookie (or the
// dev-mode Bearer affordance).
//
// PRIVACY: the success body echoes the cancelled record, so we run the
// same per-pipeline `redactPayloadForGet` redaction here as the GET
// handler. Without that, a WHISTLE bundleUrl or ROTATE operatorNote
// would leak through the cancel response — same anonymity hazard the
// GET path closes.
//
// =============================================================================
// SECURITY (stub-era) — coarse authorization
// =============================================================================
//
// Today, ANY authenticated caller can cancel ANY run. The auth gate
// only proves "the caller is signed in"; it does NOT prove "the caller
// owns this run." The Supabase user identity is intentionally not
// threaded through to a runs.owner_id check because the run-store stub
// has no concept of run ownership yet — runs are author-less in this
// pre-pluck-api phase.
//
// Tracking: bind runs to authenticated owners via pluck-api (the same
// migration that adds run ownership for the audit trail). Once that
// lands, the DELETE handler MUST check `record.ownerId === session.user.id`
// (or admin role) before invoking `cancelRun`. Until then, this is a
// known stub-era authorization gap — MUST be fixed before public alpha.
//
// This mirrors the NUCLEI author-handle stub gap (see
// `src/app/api/programs/nuclei/run/route.ts` SECURITY block, AE R1
// finding S1): operator-asserted identity is not yet bound to the
// authenticated user. Both close at the same pluck-api inflection.
// =============================================================================
export async function DELETE(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  if (!isSameSiteRequest(req)) {
    return NextResponse.json(
      { error: "cross-site request rejected" },
      { status: 403 },
    );
  }
  {
    const rl = rateLimit(req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too many requests — slow down and try again in a minute" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
  }
  if (!isAuthed(req)) {
    return NextResponse.json(
      { error: "authentication required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return NextResponse.json(
      { error: "invalid run id" },
      { status: 400 },
    );
  }

  // IDOR fix: only the run's creator can cancel it. Look up the record
  // BEFORE invoking `cancelRun` so the ownership check fires whether
  // the record exists yet or not — `cancelRun` itself doesn't take an
  // owner argument so the gate has to live here.
  //
  // Records created BEFORE the IDOR fix landed have `ownerId === null`
  // (legacy / stub data). We let those through — there are no
  // production records yet because the store is in-memory, so the
  // legacy-passthrough is only relevant for tests + dev. Once a real
  // record carries a non-null ownerId, that ownerId MUST match the
  // caller's derived ownerId or the cancel is rejected as 403.
  const existing = getRun(id);
  if (existing === null) {
    return NextResponse.json(
      { error: "run not found" },
      { status: 404 },
    );
  }
  if (existing.ownerId !== null) {
    const callerOwnerId = ownerIdFromRequest(req);
    if (callerOwnerId === null || existing.ownerId !== callerOwnerId) {
      return NextResponse.json(
        { error: "not authorized to cancel this run" },
        { status: 403 },
      );
    }
  }

  const result = cancelRun(id);

  if (result.kind === "not-found") {
    // Race: the run vanished (TTL eviction) between the getRun above
    // and the cancelRun call. Surface the same 404 the read side
    // would emit.
    return NextResponse.json(
      { error: "run not found" },
      { status: 404 },
    );
  }

  if (result.kind === "final-state") {
    return NextResponse.json(
      {
        error: `run is in final state '${result.status}' and cannot be cancelled`,
        status: result.status,
      },
      { status: 409 },
    );
  }

  // ok — cancelled (or already-cancelled, idempotent). Apply the same
  // GET-side redactor so privacy-sensitive fields don't leak through
  // the cancel response either. The stored record is untouched.
  const safe = {
    ...result.record,
    payload: redactPayloadForGet(result.record.pipeline, result.record.payload),
  };

  return NextResponse.json(
    { ...safe, alreadyCancelled: result.alreadyCancelled },
    { status: 200 },
  );
}
