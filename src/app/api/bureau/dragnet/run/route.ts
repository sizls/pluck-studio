// ---------------------------------------------------------------------------
// POST /api/bureau/dragnet/run — DRAGNET activation endpoint (day-1 stub)
// ---------------------------------------------------------------------------
//
// Day-1 contract per the v1 plan:
//   1. Auth check by Supabase JWT cookie presence (real verification lands
//      with pluck-api /v1/runs).
//   2. CSRF defence — same-origin enforced via Sec-Fetch-Site / Origin /
//      Referer (shared via lib/security/request-guards).
//   3. URL scheme allowlist + private-IP block (shared via request-guards).
//   4. Pack-ID allowlist — only the bundled `canon-honesty` and the
//      qualified NUCLEI form `<author>/<pack>@<version>` accepted.
//   5. Per-IP rate limit (shared via request-guards).
//   6. ToS / probe-authorization assertion (DRAGNET-specific copy).
//   7. On success: returns { runId, phraseId } — the phrase is the
//      user-facing identifier (vendor-scoped per R2), the UUID is kept
//      for cross-system joins.
//
// Shared guards live in `lib/security/request-guards.ts`. OATH
// (sibling route) reuses them — domain-specific validation per route.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isPrivateOrLocalHost,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

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
  const runId = randomUUID();
  // Vendor-scoped: e.g. `openai-swift-falcon-3742`.
  const phraseId = generateScopedPhraseId(targetUrl);

  return NextResponse.json(
    {
      runId,
      phraseId,
      cadence,
      status: "cycle pending",
      note: "stub run — pluck-api /v1/runs not yet wired; see plan",
    },
    { status: 200 },
  );
}
