// ---------------------------------------------------------------------------
// /api/v1/runs — POST (activate) + GET (list) (STUB)
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
import { PIPELINE_VALIDATORS } from "../../../../lib/v1/pipeline-validators";
import { redactPayloadForGet } from "../../../../lib/v1/redact";
import { createRun, listRuns } from "../../../../lib/v1/run-store";
import {
  type BureauPipeline,
  bureauSlugOf,
  isBureauPipeline,
  isFuturePipeline,
  validateRunSpec,
} from "../../../../lib/v1/run-spec";

/**
 * Best-effort peek at the pipeline before full validation, used only to
 * pick a pipeline-aware sign-in redirect on the 401 path. Returns a
 * Bureau slug if the body is shaped like `{ pipeline: "bureau:<slug>", … }`,
 * otherwise null (caller falls back to the generic /bureau redirect).
 */
function peekBureauSlug(req: Request, raw: unknown): string | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const pipeline = (raw as { pipeline?: unknown }).pipeline;
  if (typeof pipeline !== "string") {
    return null;
  }
  if (!isBureauPipeline(pipeline)) {
    return null;
  }
  // Belt — bureauSlugOf trusts the prefix; we already validated it.
  return bureauSlugOf(pipeline);
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
  // Parse body BEFORE the auth check so the 401 can carry a pipeline-aware
  // sign-in redirect (e.g. `/sign-in?redirect=/bureau/dragnet/run`). Body
  // parsing is cheap and the same-site + rate-limit gates above already
  // mitigate body-payload abuse.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }

  if (!isAuthed(req)) {
    const slug = peekBureauSlug(req, raw);
    const redirect = slug !== null ? `/bureau/${slug}/run` : "/bureau";
    return NextResponse.json(
      {
        error: "authentication required",
        signInUrl: `/sign-in?redirect=${redirect}`,
      },
      { status: 401 },
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

  // Per-pipeline payload validation. `validateRunSpec` only shape-checks
  // the envelope; the program-specific rules (DRAGNET URL allowlist +
  // private-IP block + pack-ID grammar; NUCLEI cron grammar; …) live in
  // the registry so /v1/runs and the legacy /api/bureau/<slug>/run share
  // a single source of truth. M1 fix.
  const validator = PIPELINE_VALIDATORS[spec.pipeline];
  const payloadResult = validator(spec.payload);
  if (!payloadResult.ok) {
    return NextResponse.json({ error: payloadResult.error }, { status: 400 });
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

// ---------------------------------------------------------------------------
// GET /api/v1/runs — list recent runs (paginated, cursor-based)
// ---------------------------------------------------------------------------
//
// Companion to GET /api/v1/runs/[id]. Same auth posture as the single-
// record GET — public read by phraseId is the contract today, so the
// list is also public read. Same-site (CSRF) and rate-limit gates still
// apply. Listing the entire stub store would be a privacy regression,
// but the GET-side payload redactor (redactPayloadForGet) strips the
// same fields here that it strips on the single-record GET — so a list
// scrape never leaks WHISTLE.bundleUrl, ROTATE.operatorNote, etc.
//
// Query params:
//   ?pipeline=bureau:dragnet — filter by bureau pipeline (optional)
//   ?since=<ISO timestamp>   — runs created strictly after this timestamp
//   ?limit=N                 — page size, default 20, max 100
//   ?cursor=<runId>          — opaque pagination cursor (the runId of the
//                              last item from a previous page)
//
// Response shape:
//   { runs: RedactedRunRecord[], nextCursor: string | null, totalCount: number }
//
// `runs[].payload` is redacted via the same per-pipeline registry as the
// single-record GET. `nextCursor` is null when no more pages.
// `totalCount` is the total matching the filter (across all pages) so
// UIs can render "showing N of M" without a second request.
// ---------------------------------------------------------------------------

const MAX_CURSOR_LEN = 128;

interface ParsedQuery {
  ok: true;
  pipeline?: BureauPipeline;
  since?: number;
  limit?: number;
  cursor?: string;
}

interface ParsedQueryErr {
  ok: false;
  error: string;
}

function parseListQuery(url: URL): ParsedQuery | ParsedQueryErr {
  const out: ParsedQuery = { ok: true };

  const pipeline = url.searchParams.get("pipeline");
  if (pipeline !== null) {
    if (!isBureauPipeline(pipeline)) {
      return {
        ok: false,
        error: `Unknown pipeline \`${pipeline}\`. Filter must be one of the bureau:* slugs.`,
      };
    }
    out.pipeline = pipeline;
  }

  const since = url.searchParams.get("since");
  if (since !== null) {
    const parsed = Date.parse(since);
    if (!Number.isFinite(parsed)) {
      return {
        ok: false,
        error: "`since` must be a parseable ISO-8601 timestamp.",
      };
    }
    out.since = parsed;
  }

  const limit = url.searchParams.get("limit");
  if (limit !== null) {
    const n = Number(limit);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "`limit` must be a number." };
    }
    // Clamp happens in listRuns; just pass through.
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

  return out;
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

  const result = listRuns({
    ...(parsed.pipeline !== undefined ? { pipeline: parsed.pipeline } : {}),
    ...(parsed.since !== undefined ? { since: parsed.since } : {}),
    ...(parsed.limit !== undefined ? { limit: parsed.limit } : {}),
    ...(parsed.cursor !== undefined ? { cursor: parsed.cursor } : {}),
  });

  // Per-pipeline GET-side redaction applied to EACH list item — same
  // contract as the single-record GET. The stored record is untouched;
  // we project a safe view of `payload` for serialization.
  const safe = result.runs.map((record) => ({
    ...record,
    payload: redactPayloadForGet(record.pipeline, record.payload),
  }));

  return NextResponse.json(
    {
      runs: safe,
      nextCursor: result.nextCursor,
      totalCount: result.totalCount,
    },
    { status: 200 },
  );
}
