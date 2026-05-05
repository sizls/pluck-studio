// ---------------------------------------------------------------------------
// POST /api/bureau/whistle/run — WHISTLE submit endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:whistle", payload: { ...this body... } }. !!
//
// Wave-3 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateWhistlePayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. PRIVACY INVARIANT: the receipt URL prefix is the routing-partner
//      slug, NOT the source. The bundleUrl participates in the canonical
//      hash (idempotency) but is NEVER echoed in the response body. The
//      shared validator REJECTS any payload key resembling
//      source-identifying material (sourceName, sourceEmail, sourceIp,
//      etc.).
//   4. https-only bundleUrl + private-IP block + category enum +
//      routingPartner enum + manualRedactPhrase length cap + BOTH
//      anonymity-caveat AND authorization acks.
//   5. On success: { runId, phraseId, category, routingPartner,
//      status:"submission pending", deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 8594 Deprecation/Sunset/Link
//      headers. NOTE: bundleUrl is intentionally NOT echoed —
//      anonymity-by-default. runId === phraseId — single primitive,
//      identical on idempotent retries.
//
// Idempotency contract: legacy WHISTLE callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the
// same body — we synthesize the same minute-bucketed key the RunForm
// uses (`whistle:<routingPartner>:<category>:<bundleUrl>:<minute>`)
// before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateWhistlePayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface WhistleRequestBody {
  bundleUrl?: string;
  category?: string;
  routingPartner?: string;
  manualRedactPhrase?: string;
  anonymityCaveatAcknowledged?: boolean;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the WHISTLE
 * RunForm sends to /v1/runs. Format:
 *   `whistle:<routingPartner>:<category>:<bundleUrl>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record.
 */
function synthesizeIdempotencyKey(
  routingPartner: string,
  category: string,
  bundleUrl: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `whistle:${routingPartner}:${category}:${bundleUrl}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/whistle/run",
      },
      { status: 401 },
    );
  }
  let body: WhistleRequestBody;
  try {
    body = (await req.json()) as WhistleRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting. Validator also enforces the privacy
  // invariant (rejects any source-identifying payload key).
  const result = validateWhistlePayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const bundleUrl = (body.bundleUrl ?? "").trim();
  const category = (body.category ?? "").trim();
  const routingPartner = (body.routingPartner ?? "").trim();
  const manualRedactPhraseRaw = (body.manualRedactPhrase ?? "").trim();

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical routing-partner-scoped phraseId — that
  // becomes the user-facing runId. The phrase prefix is the routing
  // partner, NEVER the bundle source — anonymity-by-default.
  const { record } = createRun({
    pipeline: "bureau:whistle",
    payload: {
      bundleUrl,
      category,
      routingPartner,
      manualRedactPhrase:
        manualRedactPhraseRaw.length > 0 ? manualRedactPhraseRaw : undefined,
      anonymityCaveatAcknowledged: body.anonymityCaveatAcknowledged,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(
      routingPartner,
      category,
      bundleUrl,
    ),
  });

  // Privacy invariant: NEVER echo `bundleUrl` here — anonymity-by-default.
  // The bundleUrl participates in the canonical hash (idempotency) but
  // does not surface in the receipt or the response. Same posture as the
  // legacy route's pre-migration response.
  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      category,
      routingPartner,
      status: "submission pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:whistle",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
