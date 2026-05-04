// ---------------------------------------------------------------------------
// POST /api/bureau/rotate/run — ROTATE rotate endpoint (Phase-1.5 stub)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import { isValidSpkiFingerprint } from "../../../../../lib/rotate/run-form-module";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

interface RotateRequestBody {
  oldKeyFingerprint?: string;
  newKeyFingerprint?: string;
  reason?: string;
  operatorNote?: string;
  authorizationAcknowledged?: boolean;
}

const VALID_REASONS = new Set(["compromised", "routine", "lost"]);
const MAX_NOTE_LENGTH = 512;

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
        signInUrl: "/sign-in?redirect=/bureau/rotate/run",
      },
      { status: 401 },
    );
  }
  let body: RotateRequestBody;
  try {
    body = (await req.json()) as RotateRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const oldKeyFingerprint =
    body.oldKeyFingerprint?.trim().toLowerCase() ?? "";
  const newKeyFingerprint =
    body.newKeyFingerprint?.trim().toLowerCase() ?? "";
  const reason = body.reason?.trim() ?? "";
  const operatorNote = body.operatorNote?.trim() ?? "";

  if (!oldKeyFingerprint || !isValidSpkiFingerprint(oldKeyFingerprint)) {
    return NextResponse.json(
      { error: "Old key fingerprint must be 64 hex characters" },
      { status: 400 },
    );
  }
  if (!newKeyFingerprint || !isValidSpkiFingerprint(newKeyFingerprint)) {
    return NextResponse.json(
      { error: "New key fingerprint must be 64 hex characters" },
      { status: 400 },
    );
  }
  if (oldKeyFingerprint === newKeyFingerprint) {
    return NextResponse.json(
      {
        error:
          "Old and new key fingerprints must differ — rotating to the same key is a no-op.",
      },
      { status: 400 },
    );
  }
  if (!VALID_REASONS.has(reason)) {
    return NextResponse.json(
      { error: "Reason must be 'compromised', 'routine', or 'lost'" },
      { status: 400 },
    );
  }
  if (operatorNote.length > MAX_NOTE_LENGTH) {
    return NextResponse.json(
      {
        error: `Operator note must be ≤ ${MAX_NOTE_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to rotate this key before submitting.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Phrase ID prefix: the reason. Surfaces *why* the rotation
  // happened (compromised vs routine vs lost) in the URL itself —
  // social-pressure signal for compromised events.
  const phraseId = generateScopedPhraseId(`https://${reason}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      oldKeyFingerprint,
      newKeyFingerprint,
      reason,
      status: "rotation pending",
      note: "stub rotate — pluck-api /v1/rotate/revoke not yet wired; see plan",
    },
    { status: 200 },
  );
}
