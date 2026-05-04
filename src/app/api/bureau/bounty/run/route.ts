// ---------------------------------------------------------------------------
// POST /api/bureau/bounty/run — BOUNTY file endpoint (Phase-6 stub)
// ---------------------------------------------------------------------------
//
// Auth tokens (HackerOne / Bugcrowd) NEVER appear in the request body
// or the response. Per the BOUNTY landing's "auth tokens stay LOCAL"
// posture — Studio's hosted mode reads operator-stored credentials at
// dispatch time, the form/route never touches them.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  isValidProgramSlug,
  isValidRekorUuid,
} from "../../../../../lib/bounty/run-form-module";
import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

interface BountyRequestBody {
  sourceRekorUuid?: string;
  target?: string;
  program?: string;
  vendor?: string;
  model?: string;
  authorizationAcknowledged?: boolean;
}

const VALID_TARGETS = new Set(["hackerone", "bugcrowd"]);

const VENDOR_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MODEL_SLUG_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;

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
        signInUrl: "/sign-in?redirect=/bureau/bounty/run",
      },
      { status: 401 },
    );
  }
  let body: BountyRequestBody;
  try {
    body = (await req.json()) as BountyRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const sourceRekorUuid = body.sourceRekorUuid?.trim().toLowerCase() ?? "";
  const target = body.target?.trim().toLowerCase() ?? "";
  const program = body.program?.trim().toLowerCase() ?? "";
  const vendor = body.vendor?.trim().toLowerCase() ?? "";
  const model = body.model?.trim().toLowerCase() ?? "";

  if (!sourceRekorUuid) {
    return NextResponse.json(
      { error: "Source Rekor UUID is required" },
      { status: 400 },
    );
  }
  if (!isValidRekorUuid(sourceRekorUuid)) {
    return NextResponse.json(
      { error: "Source Rekor UUID must be 64–80 hex characters" },
      { status: 400 },
    );
  }
  if (!VALID_TARGETS.has(target)) {
    return NextResponse.json(
      { error: "Target must be 'hackerone' or 'bugcrowd'" },
      { status: 400 },
    );
  }
  if (!program) {
    return NextResponse.json(
      { error: "Program slug is required (e.g. 'openai')" },
      { status: 400 },
    );
  }
  if (!isValidProgramSlug(program)) {
    return NextResponse.json(
      {
        error:
          "Program must be a short lowercase slug (e.g. 'openai'); no dots, no slashes.",
      },
      { status: 400 },
    );
  }
  if (!vendor || !VENDOR_SLUG_PATTERN.test(vendor)) {
    return NextResponse.json(
      { error: "Vendor must be a short lowercase slug (e.g. 'openai')" },
      { status: 400 },
    );
  }
  if (!model || !MODEL_SLUG_PATTERN.test(model) || model.length > 64) {
    return NextResponse.json(
      { error: "Model must be a slug like 'gpt-4o' or 'claude-3-5-sonnet'" },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to file this bounty before submitting.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Phrase ID prefix is the platform target — the URL self-discloses
  // *which platform was filed against*, not the source operator or
  // the affected vendor (vendor is in the receipt body).
  const phraseId = generateScopedPhraseId(`https://${target}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      target,
      program,
      vendor,
      model,
      sourceRekorUuid,
      status: "filing pending",
      note: "stub file — pluck-api /v1/bounty/file not yet wired; see plan",
    },
    { status: 200 },
  );
}
