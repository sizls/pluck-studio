// ---------------------------------------------------------------------------
// POST /api/bureau/nuclei/run — NUCLEI publish endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:nuclei", payload: { ...this body... } }. !!
//
// Sibling-of-DRAGNET migration: this route stays alive as a deprecated
// alias so callers that haven't migrated keep working, but it now
// validates via the shared `validateNucleiPayload` and dual-writes into
// the v1 store so legacy + /v1/runs callers converge on the same
// phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. Per-IP rate limit.
//   4. TOFU enforcement (every entry MUST cross-reference an SBOM-AI
//      Rekor uuid) reproduced via the shared validator.
//   5. On success: { runId, phraseId, author, packName, sbomRekorUuid,
//      vendorScope[], license, recommendedInterval, status:"publish
//      pending", pendingVerdict, pendingTrustTier, deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 8594 Deprecation/Sunset/Link
//      headers. runId === phraseId — single primitive (mirrors DRAGNET M5).
//
// Idempotency contract: legacy NUCLEI callers double-clicking within ~60s
// dedupe to the SAME phraseId as a /v1/runs caller posting the same body
// — we synthesize the same minute-bucketed key the RunForm uses
// (`nuclei:<author>:<packName>:<sbomRekorUuid>:<minute>`).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  parseVendorScope,
} from "../../../../../lib/nuclei/run-form-module";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateNucleiPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface NucleiRequestBody {
  author?: string;
  packName?: string;
  sbomRekorUuid?: string;
  vendorScope?: string;
  license?: string;
  recommendedInterval?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the NUCLEI RunForm
 * sends to /v1/runs. Format:
 *   `nuclei:<author>:<packName>:<sbomRekorUuid>:<minute-bucket>`
 *
 * Mirrors DRAGNET's C1 fix — legacy double-click + /v1/runs double-click
 * with the same payload land on the SAME stored run record.
 */
function synthesizeIdempotencyKey(
  author: string,
  packName: string,
  sbomRekorUuid: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `nuclei:${author}:${packName}:${sbomRekorUuid}:${minuteBucket}`;
}

// SECURITY: author handle squat — until pluck-api binds NUCLEI authors
// to authenticated user IDs, anyone can submit any author=<handle>.
// Phrase-ID prefix bakes handle into receipt URL → impersonation
// primitive when registry goes public. Tracking: must be fixed before
// public registry launch (NUCLEI v1.0 GA gate). See AE R1 finding S1.
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
        signInUrl: "/sign-in?redirect=/bureau/nuclei/run",
      },
      { status: 401 },
    );
  }
  let body: NucleiRequestBody;
  try {
    body = (await req.json()) as NucleiRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting (M1 fix).
  const result = validateNucleiPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const author = (body.author ?? "").trim().toLowerCase();
  const packName = (body.packName ?? "").trim();
  const sbomRekorUuid = (body.sbomRekorUuid ?? "").trim().toLowerCase();
  const vendorScope = (body.vendorScope ?? "").trim();
  const license = (body.license ?? "").trim();
  const recommendedInterval = (body.recommendedInterval ?? "").trim();
  const { pairs } = parseVendorScope(vendorScope);

  // Delegate persistence to the unified /v1/runs store. The runId is
  // author-scoped (`alice-…`) because `runIdForBureau` resolves
  // `generateScopedPhraseId("https://<author>.example")` for NUCLEI
  // payloads carrying `author` — same shape the legacy route produced
  // pre-migration, and the same shape the /v1/runs caller sees.
  const { record } = createRun({
    pipeline: "bureau:nuclei",
    payload: {
      author,
      packName,
      sbomRekorUuid,
      vendorScope,
      license,
      recommendedInterval,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(author, packName, sbomRekorUuid),
  });

  // Anticipated verdict — Phase-stub: there's no real TOFU step yet, so
  // we mirror eventual semantics. A pre-validated sbomRekorUuid (passed
  // isValidRekorUuid above) anticipates 'published'. Once TOFU lands and
  // the cross-reference fails to verify against the SBOM-AI Rekor entry,
  // that path will downgrade to 'published-ingested-only' + tier
  // 'ingested' (registry-fenced; consumers refuse). The response shape
  // is ready for both verdicts now so subscribers don't have to do a
  // 2-field (verdict + trustTier) join later.
  const pendingVerdict: "published" | "published-ingested-only" = "published";
  const pendingTrustTier: "verified" | "ingested" = "verified";

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      author,
      packName,
      sbomRekorUuid,
      vendorScope: pairs,
      license,
      recommendedInterval,
      status: "publish pending",
      pendingVerdict,
      pendingTrustTier,
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:nuclei",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
