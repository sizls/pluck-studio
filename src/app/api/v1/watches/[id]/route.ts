// ---------------------------------------------------------------------------
// /api/v1/watches/[id] — GET (read) + PATCH (update) + DELETE (archive)
// ---------------------------------------------------------------------------
//
// Mirrors the /api/v1/runs/[id] shape. GET is public-read; PATCH + DELETE
// are auth-gated (state-modifying). DELETE soft-archives (the record
// stays for audit) — operators wanting a hard delete need the worker
// admin endpoint (lands Week-2).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { redactWatchForGet } from "../../../../../lib/v1/redact";
import {
  archiveWatch,
  getWatch,
  listObservations,
  updateWatch,
} from "../../../../../lib/watch/store";
import { validateWatchUpdate } from "../../../../../lib/v1/watch-validators";

const MAX_REQUEST_BODY_BYTES = 64 * 1024;

async function readBoundedJson(
  req: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string; status: number }> {
  const lenHeader = req.headers.get("content-length");
  if (lenHeader !== null) {
    const len = Number.parseInt(lenHeader, 10);
    if (Number.isFinite(len) && len > MAX_REQUEST_BODY_BYTES) {
      return { ok: false, error: "request body too large", status: 413 };
    }
  }
  try {
    return { ok: true, value: await req.json() };
  } catch {
    return { ok: false, error: "invalid JSON body", status: 400 };
  }
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function validateId(id: string): { ok: true } | { ok: false; error: string } {
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return { ok: false, error: "invalid watch id" };
  }

  return { ok: true };
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
  const idCheck = validateId(id);
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }

  const record = getWatch(id);
  if (record === null) {
    return NextResponse.json({ error: "watch not found" }, { status: 404 });
  }

  // Include the most recent observation history inline so the receipt page
  // can render without a second round trip. Cap small — full history is
  // its own endpoint when it ships.
  const { observations, totalCount } = listObservations(id, 20);

  // GET is public-read by phraseId. Strip operator address lists; keep
  // every other field. The stored record is untouched.
  return NextResponse.json(
    {
      ...redactWatchForGet(record),
      observations,
      observationCount: totalCount,
    },
    { status: 200 },
  );
}

export async function PATCH(
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
  const idCheck = validateId(id);
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }

  const parsed = await readBoundedJson(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const validated = validateWatchUpdate(parsed.value);
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }

  const result = updateWatch(id, validated.update);
  if (result.kind === "not-found") {
    return NextResponse.json({ error: "watch not found" }, { status: 404 });
  }
  if (result.kind === "archived") {
    return NextResponse.json(
      { error: "watch is archived and cannot be updated" },
      { status: 409 },
    );
  }

  // Operator's own PATCH response — they wrote these channel addresses,
  // so they can see them back. Mirror the GET shape (redacted) so client
  // code reading the PATCH response uses the same projection consistently.
  return NextResponse.json(redactWatchForGet(result.record), { status: 200 });
}

export async function DELETE(
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
  const idCheck = validateId(id);
  if (!idCheck.ok) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 });
  }

  const result = archiveWatch(id);
  if (result.kind === "not-found") {
    return NextResponse.json({ error: "watch not found" }, { status: 404 });
  }
  if (result.kind === "archived") {
    // Already archived → idempotent ok. Re-fetch with null-check (the
    // watch may have been evicted between archiveWatch's check and now).
    const current = getWatch(id);
    if (current === null) {
      return NextResponse.json({ error: "watch not found" }, { status: 404 });
    }

    return NextResponse.json(
      { ...redactWatchForGet(current), alreadyArchived: true },
      { status: 200 },
    );
  }

  return NextResponse.json(redactWatchForGet(result.record), { status: 200 });
}
