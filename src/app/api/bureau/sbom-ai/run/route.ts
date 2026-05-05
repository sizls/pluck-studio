// ---------------------------------------------------------------------------
// POST /api/bureau/sbom-ai/run — SBOM-AI publish endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:sbom-ai", payload: { ...this body... } }. !!
//
// Wave-3 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateSbomAiPayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. https-only artifactUrl + private-IP block + artifactKind enum +
//      optional expectedSha256 grammar + ToS / authorization assertion.
//   4. On success: { runId, phraseId, artifactKind, artifactUrl,
//      expectedSha256 (or null), status:"publish pending",
//      deprecated: true, replacement: "/api/v1/runs" } + RFC 8594
//      Deprecation/Sunset/Link headers. runId === phraseId — single
//      primitive, identical on idempotent retries.
//
// Idempotency contract: legacy SBOM-AI callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the
// same body — we synthesize the same minute-bucketed key the RunForm
// uses (`sbom-ai:<artifactKind>:<artifactUrl>:<expectedSha256>:<minute>`)
// before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateSbomAiPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface SbomAiRequestBody {
  artifactUrl?: string;
  artifactKind?: string;
  expectedSha256?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the SBOM-AI
 * RunForm sends to /v1/runs. Format:
 *   `sbom-ai:<artifactKind>:<artifactUrl>:<expectedSha256OrNone>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record.
 */
function synthesizeIdempotencyKey(
  artifactKind: string,
  artifactUrl: string,
  expectedSha256: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);
  const hashSuffix = expectedSha256.length > 0 ? expectedSha256 : "none";

  return `sbom-ai:${artifactKind}:${artifactUrl}:${hashSuffix}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/sbom-ai/run",
      },
      { status: 401 },
    );
  }
  let body: SbomAiRequestBody;
  try {
    body = (await req.json()) as SbomAiRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting.
  const result = validateSbomAiPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const artifactUrl = (body.artifactUrl ?? "").trim();
  const artifactKind = (body.artifactKind ?? "").trim().toLowerCase();
  const expectedSha256 = (body.expectedSha256 ?? "").trim().toLowerCase();

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical artifactKind-scoped phraseId — that becomes
  // the user-facing runId.
  //
  // expectedSha256 is omitted from the payload when empty so canonicalJson
  // skips the field and legacy + /v1/runs hash identically.
  const { record } = createRun({
    pipeline: "bureau:sbom-ai",
    payload: {
      artifactUrl,
      artifactKind,
      expectedSha256: expectedSha256.length > 0 ? expectedSha256 : undefined,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(
      artifactKind,
      artifactUrl,
      expectedSha256,
    ),
  });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      artifactKind,
      artifactUrl,
      expectedSha256: expectedSha256.length > 0 ? expectedSha256 : null,
      status: "publish pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:sbom-ai",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
