// ---------------------------------------------------------------------------
// POST /api/v1/runs — unified pipeline activation endpoint (STUB)
// ---------------------------------------------------------------------------
//
// The single canonical surface for kicking off any pipeline run. Today
// it consolidates the 11 per-program Bureau activation stubs at
// `/api/bureau/<slug>/run`; tomorrow it unifies the non-Bureau shelves
// (extract, sense, act, fleet) under the same shape.
//
// Day-N contract:
//   1. Auth check (Supabase JWT cookie OR dev-mode Bearer) — same gate
//      the per-program routes use, via `lib/security/request-guards`.
//   2. CSRF defence — same-origin enforced via Sec-Fetch-Site / Origin /
//      Referer.
//   3. Per-IP+session rate limit.
//   4. RunSpec body validation — pipeline must be one of the 11 bureau
//      slugs OR documented future surface (extract/sense/act/fleet, all
//      rejected today with a 400 + "documented but not yet implemented").
//   5. Idempotency: same canonicalised (pipeline, payload, idempotencyKey)
//      always returns the same runId.
//   6. Persist to in-memory store (lib/v1/run-store.ts — STUB).
//
// Response (200):
//   { runId, receiptUrl, status: "pending", reused: boolean }
//
// `reused` is true when an idempotency replay returns the existing
// record. Lets the client distinguish "fresh run created" from "your
// retry hit our cache" without changing status codes.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../lib/security/request-guards";
import { createRun } from "../../../../lib/v1/run-store";
import {
  isBureauPipeline,
  isFuturePipeline,
  validateRunSpec,
} from "../../../../lib/v1/run-spec";

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
        signInUrl: "/sign-in?redirect=/bureau",
      },
      { status: 401 },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  const validated = validateRunSpec(raw);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const { spec } = validated;

  if (isFuturePipeline(spec.pipeline)) {
    return NextResponse.json(
      {
        error: `Pipeline \`${spec.pipeline}\` is documented but not yet implemented. Use a bureau:* pipeline today; the non-Bureau shelves land in a future release.`,
      },
      { status: 400 },
    );
  }
  if (!isBureauPipeline(spec.pipeline)) {
    // Belt-and-suspenders — validateRunSpec already rejects unknowns.
    return NextResponse.json(
      { error: `Unknown pipeline \`${spec.pipeline}\`.` },
      { status: 400 },
    );
  }

  const { record, reused } = createRun(spec);

  return NextResponse.json(
    {
      runId: record.runId,
      receiptUrl: record.receiptUrl,
      status: record.status,
      reused,
    },
    { status: 200 },
  );
}
