// ---------------------------------------------------------------------------
// POST /api/bureau/mole/run — MOLE seal-canary endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:mole", payload: { ...this body... } }. !!
//
// Wave-2 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateMolePayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. Per landing's "Sealing comes BEFORE probing" callout: the canary
//      commit is signed and anchored to Rekor BEFORE any probe touches
//      the vendor. This endpoint emits the seal — never the canary body.
//   4. PRIVACY INVARIANT: the canary body NEVER enters this surface. The
//      shared validator rejects any payload carrying `canaryBody` /
//      `canaryContent` (defense-in-depth — receipt schema already drops
//      these, but the wire backstops).
//   5. canaryId slug + https-only canaryUrl + private-IP block + phrase
//      length/count bounds + ToS / authorization assertion.
//   6. On success: { runId, phraseId, canaryId, canaryUrl,
//      fingerprintPhrases, status:"seal pending", deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 8594 Deprecation/Sunset/Link
//      headers. runId === phraseId — single primitive, identical on
//      idempotent retries (mirrors DRAGNET M5).
//
// Idempotency contract: legacy MOLE callers double-clicking within ~60s
// dedupe to the SAME phraseId as a /v1/runs caller posting the same body
// — we synthesize the same minute-bucketed key the RunForm uses
// (`mole:<canaryId>:<canaryUrl>:<minute>`) before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { parseFingerprintPhrases } from "../../../../../lib/mole/run-form-module";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateMolePayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface MoleRequestBody {
  canaryId?: string;
  canaryUrl?: string;
  fingerprintPhrases?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the MOLE RunForm
 * sends to /v1/runs. Format:
 *   `mole:<canaryId>:<canaryUrl>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record. Mirrors DRAGNET's C1 fix.
 */
function synthesizeIdempotencyKey(
  canaryId: string,
  canaryUrl: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `mole:${canaryId}:${canaryUrl}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/mole/run",
      },
      { status: 401 },
    );
  }
  let body: MoleRequestBody;
  try {
    body = (await req.json()) as MoleRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting. Validator also enforces the privacy
  // invariant (rejects canaryBody / canaryContent).
  const result = validateMolePayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const canaryId = (body.canaryId ?? "").trim().toLowerCase();
  const canaryUrl = (body.canaryUrl ?? "").trim();
  const fingerprintPhrasesRaw = (body.fingerprintPhrases ?? "").trim();
  const { phrases } = parseFingerprintPhrases(fingerprintPhrasesRaw);

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical canary-id-scoped phraseId — that becomes the
  // user-facing runId. Phrase shape: `<canaryIdSlug>-<adj>-<noun>-NNNN`
  // (e.g. `nyt20240115-...`).
  //
  // PRIVACY: only canaryId, canaryUrl, fingerprintPhrases (the parsed
  // public-log array; not the canary body) and the auth-ack flag enter
  // the store payload. canaryBody/canaryContent are rejected upstream
  // by the validator.
  const { record } = createRun({
    pipeline: "bureau:mole",
    payload: {
      canaryId,
      canaryUrl,
      // Forms post `fingerprintPhrases` as the raw textarea string. The
      // store's payload reflects the same field shape as the RunForm
      // POSTs to /v1/runs so canonicalJson hashes identically across
      // both surfaces and dedupe converges.
      fingerprintPhrases: fingerprintPhrasesRaw,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(canaryId, canaryUrl),
  });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      canaryId,
      canaryUrl,
      // Echo the parsed phrase ARRAY (not the raw string) — back-compat
      // with the legacy response shape so existing clients continue to
      // see a list. Privacy-invariant: this is operator-supplied
      // metadata, NOT the canary body.
      fingerprintPhrases: phrases,
      status: "seal pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:mole",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
