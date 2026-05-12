// ---------------------------------------------------------------------------
// /api/v1/watches — POST (create) + GET (list)  (STUB)
// ---------------------------------------------------------------------------
//
// The canonical surface for periodic semantic monitoring. Mirrors the
// /api/v1/runs shape (auth gate, CSRF gate, rate-limit gate, idempotency,
// stub-store persistence). Standalone — Watches are NOT Bureau runs.
//
// Day-N contract:
//   1. Same-site (CSRF) gate.
//   2. Rate-limit gate.
//   3. Auth gate (Supabase JWT cookie OR dev-mode Bearer).
//   4. WatchSpec body validation (lib/v1/watch-validators).
//   5. Idempotency: same (url, intent, fetcherKind, idempotencyKey) returns
//      the same watchId on retries.
//   6. Persist to in-memory store (lib/watch/store — STUB).
//
// Response (200):
//   { watchId, receiptUrl, status, reused: boolean }
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../lib/security/request-guards";
import {
  createWatch,
  listWatches,
} from "../../../../lib/watch/store";
import {
  isWatchStatus,
  type WatchStatus,
} from "../../../../lib/v1/watch-spec";
import { validateWatchSpec } from "../../../../lib/v1/watch-validators";

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

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isAuthed(req)) {
    return NextResponse.json(
      {
        error: "authentication required",
        signInUrl: "/sign-in?redirect=/watch",
      },
      { status: 401 },
    );
  }

  const validated = validateWatchSpec(raw);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const { record, reused } = createWatch(validated.spec);

  return NextResponse.json(
    {
      watchId: record.watchId,
      receiptUrl: record.receiptUrl,
      status: record.status,
      reused,
    },
    { status: 200 },
  );
}

// ---------------------------------------------------------------------------
// GET — list watches (paginated, cursor-based)
// ---------------------------------------------------------------------------
//
// Public-read by watchId (the phrase-id IS the share credential, same
// posture as /v1/runs). Same-site (CSRF) + rate-limit gates still apply.
//
// Query params:
//   ?status=<WatchStatus>      single or comma-separated allowlist
//   ?limit=N                   page size, default 20, max 100
//   ?cursor=<watchId>          opaque cursor
//
// Default behavior (no `status`): archived watches are HIDDEN. Operators
// query `?status=archived` explicitly to surface them.

const MAX_CURSOR_LEN = 128;

interface ParsedQuery {
  readonly ok: true;
  readonly status?: WatchStatus[];
  readonly limit?: number;
  readonly cursor?: string;
}

interface ParsedQueryErr {
  readonly ok: false;
  readonly error: string;
}

function parseListQuery(url: URL): ParsedQuery | ParsedQueryErr {
  const out: { -readonly [K in keyof ParsedQuery]: ParsedQuery[K] } = { ok: true };

  const status = url.searchParams.get("status");
  if (status !== null) {
    if (status.length === 0) {
      return {
        ok: false,
        error: "`status` must be a non-empty WatchStatus or comma-separated list.",
      };
    }
    const parts = status
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length === 0) {
      return {
        ok: false,
        error: "`status` must be a non-empty WatchStatus or comma-separated list.",
      };
    }
    const accepted: WatchStatus[] = [];
    for (const part of parts) {
      if (!isWatchStatus(part)) {
        return {
          ok: false,
          error: `Unknown status \`${part}\`. Filter must be one of: active, paused, running, failed, archived.`,
        };
      }
      accepted.push(part);
    }
    out.status = accepted;
  }

  const limit = url.searchParams.get("limit");
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "`limit` must be a number." };
    }
    out.limit = n;
  }

  const cursor = url.searchParams.get("cursor");
  if (cursor !== null) {
    if (cursor.length === 0 || cursor.length > MAX_CURSOR_LEN) {
      return {
        ok: false,
        error: `\`cursor\` must be 1..${MAX_CURSOR_LEN} characters.`,
      };
    }
    out.cursor = cursor;
  }

  return out as ParsedQuery;
}

export async function GET(req: Request): Promise<Response> {
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

  const parsed = parseListQuery(new URL(req.url));
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = listWatches({
    ...(parsed.status !== undefined ? { status: parsed.status } : {}),
    ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
    ...(parsed.cursor !== undefined ? { cursor: parsed.cursor } : {}),
  });

  return NextResponse.json(
    {
      watches: result.watches,
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
    },
    { status: 200 },
  );
}
