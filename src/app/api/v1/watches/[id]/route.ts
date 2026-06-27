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
  ownerIdFromRequest,
  rateLimit,
  rateLimitHeaders,
} from "../../../../../lib/security/request-guards";
import { redactWatchForGet } from "../../../../../lib/v1/redact";
import {
  archiveWatch,
  getWatch,
  listObservations,
  updateWatch,
} from "../../../../../lib/watch/store";
import { validateWatchUpdate } from "../../../../../lib/v1/watch-validators";
import { readBoundedJson } from "../../../../../lib/api/bounded-json";

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
  {
    const rl = rateLimit(req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too many requests — slow down and try again in a minute" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
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
  {
    const rl = rateLimit(req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too many requests — slow down and try again in a minute" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
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

  // IDOR fix: PATCH is owner-only. Lookup the record BEFORE invoking
  // updateWatch so the ownership check fires whether or not the update
  // would succeed. Legacy watches (ownerId === null) pass through to
  // preserve the pre-IDOR-fix behavior.
  const existing = getWatch(id);
  if (existing === null) {
    return NextResponse.json({ error: "watch not found" }, { status: 404 });
  }
  if (existing.ownerId !== null) {
    const callerOwnerId = ownerIdFromRequest(req);
    if (callerOwnerId === null || existing.ownerId !== callerOwnerId) {
      return NextResponse.json(
        { error: "not authorized to update this watch" },
        { status: 403 },
      );
    }
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
  {
    const rl = rateLimit(req);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "too many requests — slow down and try again in a minute" },
        { status: 429, headers: rateLimitHeaders(rl) },
      );
    }
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

  // IDOR fix: archive (DELETE) is owner-only. Same pattern as PATCH.
  {
    const existing = getWatch(id);
    if (existing === null) {
      return NextResponse.json({ error: "watch not found" }, { status: 404 });
    }
    if (existing.ownerId !== null) {
      const callerOwnerId = ownerIdFromRequest(req);
      if (callerOwnerId === null || existing.ownerId !== callerOwnerId) {
        return NextResponse.json(
          { error: "not authorized to archive this watch" },
          { status: 403 },
        );
      }
    }
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
