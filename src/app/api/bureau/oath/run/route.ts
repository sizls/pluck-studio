// ---------------------------------------------------------------------------
// POST /api/bureau/oath/run — OATH verify endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:oath", payload: { ...this body... } }. !!
//
// Sibling-of-DRAGNET migration: this route stays alive as a deprecated
// alias so callers that haven't migrated keep working, but it now
// validates via the shared `validateOathPayload` and dual-writes into
// the v1 store so legacy + /v1/runs callers converge on the same
// phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. Vendor-domain grammar (hostname-only, no scheme/path), private-IP
//      block, hosting-origin https-only, ToS / authorization assertion.
//   4. On success: { runId, phraseId, vendorDomain, hostingOrigin,
//      expectedOrigin (back-compat alias), status:"verification pending",
//      deprecated: true, replacement: "/api/v1/runs" } + RFC 8594
//      Deprecation/Sunset/Link headers.
//      runId === phraseId — single primitive, identical on idempotent
//      retries (mirrors DRAGNET M5).
//
// Idempotency contract: legacy OATH callers double-clicking within ~60s
// dedupe to the SAME phraseId as a /v1/runs caller posting the same body
// — we synthesize the same minute-bucketed key the RunForm uses
// (`oath:<vendorDomain>:<hostingOrigin>:<minute>`) before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { normalizeVendorDomain } from "../../../../../lib/oath/run-form-module";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateOathPayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface OathRequestBody {
  vendorDomain?: string;
  hostingOrigin?: string;
  /** Back-compat alias for hostingOrigin. */
  expectedOrigin?: string;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the OATH RunForm
 * sends to /v1/runs. Format:
 *   `oath:<vendorDomain>:<hostingOrigin>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record. Mirrors DRAGNET's C1 fix.
 */
function synthesizeIdempotencyKey(
  vendorDomain: string,
  hostingOrigin: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `oath:${vendorDomain}:${hostingOrigin}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/oath/run",
      },
      { status: 401 },
    );
  }
  let body: OathRequestBody;
  try {
    body = (await req.json()) as OathRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting.
  const result = validateOathPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const vendorDomain = normalizeVendorDomain(body.vendorDomain ?? "");
  const explicitOrigin = (body.hostingOrigin ?? body.expectedOrigin ?? "").trim();
  const effectiveHostingOrigin =
    explicitOrigin.length > 0 ? explicitOrigin : `https://${vendorDomain}`;

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical vendor-scoped phraseId — that becomes the
  // user-facing runId.
  //
  // Payload shape MUST match what the OATH RunForm posts to /v1/runs so
  // (pipeline, payload, idempotencyKey) canonicalises identically and
  // legacy + /v1/runs callers converge on the SAME phraseId. The form
  // omits `hostingOrigin` when not explicitly set; we mirror that here.
  // canonicalJson() skips undefined object values, so an absent key and
  // an `undefined` value produce identical hashes.
  const { record } = createRun({
    pipeline: "bureau:oath",
    payload: {
      vendorDomain,
      hostingOrigin: explicitOrigin.length > 0 ? explicitOrigin : undefined,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(vendorDomain, effectiveHostingOrigin),
  });

  // The store-assigned runId is a vendor-scoped phrase ID because the
  // bureau:oath payload carries `vendorDomain` — `runIdForBureau` derives
  // `generateScopedPhraseId("https://<vendorDomain>")`, which gives the
  // same `openai-swift-falcon-3742` shape DRAGNET produces from
  // `targetUrl`. runId === phraseId, single primitive on retries.
  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      vendorDomain,
      hostingOrigin: effectiveHostingOrigin,
      // Back-compat alias — older clients (e.g. the v2-R0 OATH form) read
      // this. New consumers use hostingOrigin.
      expectedOrigin: effectiveHostingOrigin,
      status: "verification pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:oath",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
