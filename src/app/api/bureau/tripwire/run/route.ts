// ---------------------------------------------------------------------------
// POST /api/bureau/tripwire/run — TRIPWIRE configure endpoint (DEPRECATED ALIAS)
// ---------------------------------------------------------------------------
//
// !! DEPRECATED — clients should POST to /api/v1/runs with
//    { pipeline: "bureau:tripwire", payload: { ...this body... } }. !!
//
// Wave-3 migration: this route stays alive as a deprecated alias so callers
// that haven't migrated keep working, but it now validates via the shared
// `validateTripwirePayload` and dual-writes into the v1 store so legacy
// + /v1/runs callers converge on the same phraseId for the same payload.
//
// Day-1 contract preserved:
//   1. Auth check by Supabase JWT cookie presence.
//   2. CSRF defence — same-origin enforced.
//   3. machineId slug grammar + policySource enum + https-only
//      customPolicyUrl (when policySource = "custom") + private-IP block
//      + ToS / authorization assertion.
//   4. On success: { runId, phraseId, machineId, policySource, notarize,
//      status:"configuration pending", deprecated: true,
//      replacement: "/api/v1/runs" } + RFC 8594 Deprecation/Sunset/Link
//      headers. runId === phraseId — single primitive, identical on
//      idempotent retries.
//
// SECURITY: customPolicyUrl is validated at submission. The runner
// (Phase 2.5) that ACTUALLY fetches the URL must re-validate scheme +
// re-resolve hostname + reject redirects + cap timeout/size + parse
// untrusted JSON (no eval). See the SECURITY block in the validator
// for the full runner contract.
//
// Idempotency contract: legacy TRIPWIRE callers double-clicking within
// ~60s dedupe to the SAME phraseId as a /v1/runs caller posting the
// same body — we synthesize the same minute-bucketed key the RunForm
// uses (`tripwire:<machineId>:<policySource>:<minute>`) before delegating.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateTripwirePayload } from "../../../../../lib/v1/pipeline-validators";
import { createRun } from "../../../../../lib/v1/run-store";

const DEPRECATION_HEADERS: Record<string, string> = {
  Deprecation: "true",
  Sunset: "Wed, 31 Dec 2026 23:59:59 GMT",
  Link: '</api/v1/runs>; rel="successor-version"',
};

interface TripwireRequestBody {
  machineId?: string;
  policySource?: string;
  customPolicyUrl?: string;
  notarize?: boolean;
  authorizationAcknowledged?: boolean;
}

/**
 * Synthesize the same minute-bucketed idempotency key the TRIPWIRE
 * RunForm sends to /v1/runs. Format:
 *   `tripwire:<machineId>:<policySource>:<minute-bucket>`
 *
 * Legacy double-click + /v1/runs double-click with the same payload land
 * on the SAME stored run record.
 */
function synthesizeIdempotencyKey(
  machineId: string,
  policySource: string,
  now: number = Date.now(),
): string {
  const minuteBucket = Math.floor(now / 60_000);

  return `tripwire:${machineId}:${policySource}:${minuteBucket}`;
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
        signInUrl: "/sign-in?redirect=/bureau/tripwire/run",
      },
      { status: 401 },
    );
  }
  let body: TripwireRequestBody;
  try {
    body = (await req.json()) as TripwireRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting.
  const result = validateTripwirePayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, normalize for the response shape + dedupe key.
  const machineId = (body.machineId ?? "").trim().toLowerCase();
  const policySource = (body.policySource ?? "").trim();
  const customPolicyUrl = (body.customPolicyUrl ?? "").trim();
  const notarize = body.notarize === true;

  // Delegate persistence to the unified /v1/runs store so the receipt
  // page can read this run back via GET /api/v1/runs/[id]. The store
  // assigns the canonical machine-id-scoped phraseId — that becomes
  // the user-facing runId.
  //
  // customPolicyUrl is omitted from the payload when empty (default
  // policy) so canonicalJson skips it and legacy + /v1/runs hash
  // identically.
  const { record } = createRun({
    pipeline: "bureau:tripwire",
    payload: {
      machineId,
      policySource,
      customPolicyUrl:
        policySource === "custom" && customPolicyUrl.length > 0
          ? customPolicyUrl
          : undefined,
      notarize,
      authorizationAcknowledged: body.authorizationAcknowledged,
    },
    idempotencyKey: synthesizeIdempotencyKey(machineId, policySource),
  });

  return NextResponse.json(
    {
      runId: record.runId,
      phraseId: record.runId,
      machineId,
      policySource,
      notarize,
      status: "configuration pending",
      deprecated: true,
      replacement: "/api/v1/runs",
      note: "deprecated alias — POST to /api/v1/runs with pipeline=bureau:tripwire",
    },
    { status: 200, headers: DEPRECATION_HEADERS },
  );
}
