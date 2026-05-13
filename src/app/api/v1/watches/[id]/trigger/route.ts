// ---------------------------------------------------------------------------
// /api/v1/watches/[id]/trigger — POST (manual fire-now)  (STUB)
// ---------------------------------------------------------------------------
//
// Forces an out-of-band fire of the watch's fetch + observation cycle.
// Week-1 stub: triggerWatch in the store does a one-shot fetch() and
// writes a mock observation so the UI loop is end-to-end testable.
// Week-2: proxies to Worker `POST /v1/watches/:id/trigger`, which runs
// Playwright + the real agent and either streams back the observation
// (long-poll <=30s) or 202s with a poll URL.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../../lib/security/request-guards";
import { triggerWatch } from "../../../../../../lib/watch/store";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export const runtime = "nodejs";

export async function POST(
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
  if (!isAuthed(req)) {
    return NextResponse.json(
      { error: "authentication required" },
      { status: 401 },
    );
  }

  const { id } = await context.params;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return NextResponse.json({ error: "invalid watch id" }, { status: 400 });
  }

  const result = await triggerWatch(id);
  if (result.kind === "not-found") {
    return NextResponse.json({ error: "watch not found" }, { status: 404 });
  }
  if (result.kind === "not-active") {
    return NextResponse.json(
      { error: `watch is in status '${result.status}' and cannot be triggered` },
      { status: 409 },
    );
  }
  if (result.kind === "cooldown") {
    return NextResponse.json(
      {
        error: `triggered too recently — wait ${Math.ceil(result.waitMs / 1000)}s before firing again`,
        retryAfterMs: result.waitMs,
      },
      { status: 429, headers: { "Retry-After": String(Math.ceil(result.waitMs / 1000)) } },
    );
  }

  return NextResponse.json(result.observation, { status: 200 });
}
