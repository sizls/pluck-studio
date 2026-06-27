// ---------------------------------------------------------------------------
// POST /api/programs/custody/run — CUSTODY verify-bundle endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "program:custody", payload: { ...this body... } }. !!
//
// Wave-2 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateCustodyPayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. https-only bundleUrl + private-IP block + optional expectedVendor
//      hostname grammar + ToS / authorization assertion.
//   4. On success: { runId, phraseId, bundleUrl, expectedVendor (or null),
//      status:"verification pending", deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 9745 Deprecation/Sunset/Link
//      headers. runId === phraseId — single primitive, identical on
//      idempotent retries (mirrors DRAGNET M5).
//
// Idempotency contract: legacy CUSTODY callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the same
// body — we synthesize the same minute-bucketed key the RunForm uses
// (`custody:<vendorOrUnknown>:<bundleUrl>:<minute>`) before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimit,
  rateLimitHeaders,
  ownerIdFromRequest,
} from "../../../../../lib/security/request-guards";
import { isCsrfSafe } from "../../../../../lib/security/csrf";
import { validateCustodyPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

import { DEPRECATION_HEADERS } from "../../../../../lib/api/deprecation-headers";
import { readBoundedJson } from "../../../../../lib/api/bounded-json";

interface CustodyRequestBody {
  bundleUrl?: string;
  expectedVendor?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the CUSTODY
 * RunForm sends to /v1/runs. Format:
 *   `custody:<vendorOrUnknown>:<bundleUrl>:<minute-bucket>`
 *
 * `vendorOrUnknown` is the operator-supplied expectedVendor when present,
 * else the literal string "unknown" (so a generic bundle still has a
 * dedupe key shape that's stable across the legacy + /v1/runs surfaces).
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record. Mirrors DRAGNET's C1 fix.
 */
function synthesizeIdempotencyKey(
  vendorOrUnknown: string,
  bundleUrl: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `custody:${vendorOrUnknown}:${bundleUrl}:${minuteBucket}`;
}

export async function POST(req: Request): Promise<Response> {
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
      {
        error: "authentication required",
        signInUrl: "/sign-in?redirect=/programs/custody/run",
      },
      { status: 401 },
    );
  }
  if (!isCsrfSafe(req)) {
    return NextResponse.json(
      { error: "csrf token invalid or missing" },
      { status: 403 },
    );
  }
  const parsed = await readBoundedJson(req);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.value as CustodyRequestBody;

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting.
  const result = validateCustodyPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const bundleUrl = (body.bundleUrl ?? "").trim();
  const explicitVendor = (body.expectedVendor ?? "").trim().toLowerCase();
  const vendorOrUnknown =
    explicitVendor.length > 0 ? explicitVendor : "unknown";

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical vendor- or bundle-scoped phraseId — that
  // becomes the user-facing runId.
  //
  // CUSTODY's vendor-scoped vs. bundleUrl-scoped phrase-prefix logic
  // lives in run-store#runIdForProgram: when expectedVendor is supplied,
  // we promote it to vendorDomain for `generateScopedPhraseId`; else
  // the bundle hostname is used. Form must omit `expectedVendor` when
  // empty so canonicalJson skips the field and legacy + /v1/runs hash
  // identically.
  const ownerId = ownerIdFromRequest(req);
  const { record } = createRun({
    pipeline: "program:custody",
    payload: {
      bundleUrl,
      // expectedVendor is canonical; promote to vendorDomain so the
      // store's scoping prefers expectedVendor over the bundle hostname.
      vendorDomain: explicitVendor.length > 0 ? explicitVendor : undefined,
      expectedVendor: explicitVendor.length > 0 ? explicitVendor : undefined,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(vendorOrUnknown, bundleUrl),
  }, { ownerId });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      bundleUrl,
      expectedVendor: explicitVendor.length > 0 ? explicitVendor : null,
      status: "verification pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=program:custody",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}