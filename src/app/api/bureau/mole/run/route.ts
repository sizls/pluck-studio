// ---------------------------------------------------------------------------
// POST /api/bureau/mole/run — MOLE seal-canary endpoint (Phase-5 stub)
// ---------------------------------------------------------------------------
//
// Per landing's "Sealing comes BEFORE probing" callout: the canary
// commit is signed and anchored to Rekor BEFORE any probe touches the
// vendor. This endpoint emits the seal — never the canary body.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  FINGERPRINT_BOUNDS,
  isValidCanaryId,
  parseFingerprintPhrases,
} from "../../../../../lib/mole/run-form-module";
import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isPrivateOrLocalHost,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

interface MoleRequestBody {
  canaryId?: string;
  canaryUrl?: string;
  fingerprintPhrases?: string;
  authorizationAcknowledged?: boolean;
}

const ALLOWED_SCHEMES = new Set(["https:"]);

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
        signInUrl: "/sign-in?redirect=/bureau/mole/run",
      },
      { status: 401 },
    );
  }
  let body: MoleRequestBody;
  try {
    body = (await req.json()) as MoleRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const canaryId = body.canaryId?.trim().toLowerCase() ?? "";
  const canaryUrl = body.canaryUrl?.trim() ?? "";
  const fingerprintPhrases = body.fingerprintPhrases?.trim() ?? "";

  if (!isValidCanaryId(canaryId)) {
    return NextResponse.json(
      {
        error:
          "Canary ID must be a short lowercase slug (e.g. 'nyt-2024-01-15')",
      },
      { status: 400 },
    );
  }
  if (!canaryUrl) {
    return NextResponse.json(
      { error: "Canary URL is required (https:// only)" },
      { status: 400 },
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(canaryUrl);
  } catch {
    return NextResponse.json(
      { error: "Canary URL must be a valid URL (include https://)" },
      { status: 400 },
    );
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return NextResponse.json(
      { error: "Canary URL must use https://" },
      { status: 400 },
    );
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return NextResponse.json(
      {
        error:
          "Canary URL cannot point at localhost, private, or link-local addresses.",
      },
      { status: 400 },
    );
  }
  const { phrases, outOfBounds } = parseFingerprintPhrases(fingerprintPhrases);
  if (outOfBounds.length > 0) {
    return NextResponse.json(
      {
        error: `Fingerprint phrases must be ${FINGERPRINT_BOUNDS.MIN_LENGTH}–${FINGERPRINT_BOUNDS.MAX_LENGTH} chars; out-of-bounds: ${outOfBounds.join(" | ")}`,
      },
      { status: 400 },
    );
  }
  if (phrases.length === 0) {
    return NextResponse.json(
      { error: "At least one fingerprint phrase is required" },
      { status: 400 },
    );
  }
  if (phrases.length > FINGERPRINT_BOUNDS.MAX_COUNT) {
    return NextResponse.json(
      {
        error: `Maximum ${FINGERPRINT_BOUNDS.MAX_COUNT} fingerprint phrases (got ${phrases.length})`,
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge the canary-content-stays-private posture and authorization to seal.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Phrase prefix is the canary ID — the seal's URL self-discloses
  // *which* canary was sealed, never the body.
  const phraseId = generateScopedPhraseId(`https://${canaryId}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      canaryId,
      canaryUrl,
      fingerprintPhrases: phrases,
      status: "seal pending",
      note: "stub seal — pluck-api /v1/mole/seal not yet wired; see plan",
    },
    { status: 200 },
  );
}
