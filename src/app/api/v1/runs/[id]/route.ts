// ---------------------------------------------------------------------------
// GET /api/v1/runs/[id] — fetch a single run record (STUB)
// ---------------------------------------------------------------------------
//
// Returns the full RunRecord shape for a given runId (a phrase ID, e.g.
// `openai-swift-falcon-3742`). The receipt page on each Bureau program
// reads from this endpoint when migrated; the page falls back to its
// pre-/v1 stub when the runId isn't in the store (lets old phrase IDs
// keep rendering during the migration runway).
//
// GET is public read by phraseId — anyone with the URL can read the
// receipt. The phraseId itself is the share credential (the
// "Google Docs share link" model — the other 11 program receipt pages
// don't auth-gate their server-side data reads either). POST stays
// auth-gated. Same-site (CSRF) and rate-limit gates still apply on GET
// to keep abuse and cross-site scrapers in check.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { getRun } from "../../../../../lib/v1/run-store";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  req: Request,
  context: RouteContext,
): Promise<Response> {
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

  const { id } = await context.params;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return NextResponse.json(
      { error: "invalid run id" },
      { status: 400 },
    );
  }

  const record = getRun(id);
  if (record === null) {
    return NextResponse.json(
      { error: "run not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(record, { status: 200 });
}
