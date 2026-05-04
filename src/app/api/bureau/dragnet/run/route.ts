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
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  isAuthed,
  isPrivateOrLocalHost,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { createRun } from "../../../../../lib/v1/run-store";

interface RunRequestBody {
  targetUrl?: string;
  probePackId?: string;
  cadence?: "once" | "continuous";
  authorizationAcknowledged?: boolean;
}

const ALLOWED_TARGET_SCHEMES = new Set(["http:", "https:"]);
const BUNDLED_PACK_IDS = new Set(["canon-honesty"]);
const QUALIFIED_PACK_ID = /^[a-z0-9_-]+\/[a-z0-9_-]+@[a-zA-Z0-9._+-]+$/;

function isAllowedPackId(id: string): boolean {
  return BUNDLED_PACK_IDS.has(id) || QUALIFIED_PACK_ID.test(id);
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
  const targetUrl = body.targetUrl?.trim();
  const probePackId = body.probePackId?.trim();
  const cadence = body.cadence ?? "once";

  if (!targetUrl || !probePackId) {
    return NextResponse.json(
      { error: "Target endpoint and Probe-pack ID are required" },
      { status: 400 },
    );
  }
  if (cadence !== "once" && cadence !== "continuous") {
    return NextResponse.json(
      { error: "Cadence must be 'once' or 'continuous'" },
      { status: 400 },
    );
  }
  if (cadence === "continuous") {
    return NextResponse.json(
      {
        error:
          "Continuous monitoring is coming soon — for now, run once and we'll re-run on cycle when scheduling lands.",
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to probe this target before running.",
      },
      { status: 400 },
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { error: "Target endpoint must be a valid URL (include https://)" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TARGET_SCHEMES.has(parsed.protocol)) {
    return NextResponse.json(
      { error: "Target endpoint must use http:// or https://" },
      { status: 400 },
    );
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return NextResponse.json(
      {
        error:
          "Target endpoint cannot point at localhost, private, or link-local addresses.",
      },
      { status: 400 },
    );
  }
  if (!isAllowedPackId(probePackId)) {
    return NextResponse.json(
      {
        error:
          "Unknown probe-pack. Use 'canon-honesty' (bundled) or a NUCLEI-qualified ID like 'author/pack@version'.",
      },
      { status: 400 },
    );
  }
  const legacyRunId = randomUUID();
  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical phrase-id-shaped runId (vendor-scoped, e.g.
  // `openai-swift-falcon-3742`) — that becomes the user-facing phraseId.
  const { record } = createRun({
    pipeline: "bureau:dragnet",
    payload: {
      targetUrl,
      probePackId,
      cadence,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
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
