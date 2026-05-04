// ---------------------------------------------------------------------------
// POST /api/bureau/sbom-ai/run — SBOM-AI publish endpoint (Phase-1.5 stub)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isValidSha256,
} from "../../../../../lib/sbom-ai/run-form-module";
import {
  isAuthed,
  isPrivateOrLocalHost,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

interface SbomAiRequestBody {
  artifactUrl?: string;
  artifactKind?: string;
  expectedSha256?: string;
  authorizationAcknowledged?: boolean;
}

const VALID_KINDS = new Set(["probe-pack", "model-card", "mcp-server"]);
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
        signInUrl: "/sign-in?redirect=/bureau/sbom-ai/run",
      },
      { status: 401 },
    );
  }
  let body: SbomAiRequestBody;
  try {
    body = (await req.json()) as SbomAiRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const artifactUrl = body.artifactUrl?.trim() ?? "";
  const artifactKind = body.artifactKind?.trim().toLowerCase() ?? "";
  const expectedSha256 = body.expectedSha256?.trim().toLowerCase() ?? "";

  if (!artifactUrl) {
    return NextResponse.json(
      { error: "Artifact URL is required (https:// only)" },
      { status: 400 },
    );
  }
  if (!VALID_KINDS.has(artifactKind)) {
    return NextResponse.json(
      {
        error:
          "Artifact kind must be one of 'probe-pack', 'model-card', 'mcp-server'",
      },
      { status: 400 },
    );
  }
  if (expectedSha256.length > 0 && !isValidSha256(expectedSha256)) {
    return NextResponse.json(
      { error: "Expected sha256 must be 64 hex characters when provided" },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to publish this artifact's provenance.",
      },
      { status: 400 },
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(artifactUrl);
  } catch {
    return NextResponse.json(
      { error: "Artifact URL must be a valid URL (include https://)" },
      { status: 400 },
    );
  }
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return NextResponse.json(
      { error: "Artifact URL must use https://" },
      { status: 400 },
    );
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return NextResponse.json(
      {
        error:
          "Artifact URL cannot point at localhost, private, or link-local addresses.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Phrase prefix: artifact kind. Surfaces *what kind of artifact*
  // this attestation covers in the URL itself (probe-pack-..., etc).
  const phraseId = generateScopedPhraseId(`https://${artifactKind}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      artifactKind,
      artifactUrl,
      expectedSha256: expectedSha256.length > 0 ? expectedSha256 : null,
      status: "publish pending",
      note: "stub publish — pluck-api /v1/sbom-ai/publish not yet wired; see plan",
    },
    { status: 200 },
  );
}
