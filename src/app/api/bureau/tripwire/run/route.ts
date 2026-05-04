// ---------------------------------------------------------------------------
// POST /api/bureau/tripwire/run — TRIPWIRE configure endpoint (Phase-2 stub)
// ---------------------------------------------------------------------------
//
// First *configuration* program through the pattern. Receipt
// represents one active deployment, not a one-shot run.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isPrivateOrLocalHost,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { isValidMachineId } from "../../../../../lib/tripwire/run-form-module";

interface TripwireRequestBody {
  machineId?: string;
  policySource?: string;
  customPolicyUrl?: string;
  notarize?: boolean;
  authorizationAcknowledged?: boolean;
}

const VALID_POLICY_SOURCES = new Set(["default", "custom"]);
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
        signInUrl: "/sign-in?redirect=/bureau/tripwire/run",
      },
      { status: 401 },
    );
  }
  let body: TripwireRequestBody;
  try {
    body = (await req.json()) as TripwireRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const machineId = body.machineId?.trim().toLowerCase() ?? "";
  const policySource = body.policySource?.trim() ?? "";
  const customPolicyUrl = body.customPolicyUrl?.trim() ?? "";
  const notarize = body.notarize === true;

  if (!isValidMachineId(machineId)) {
    return NextResponse.json(
      {
        error:
          "Machine ID must be a short lowercase slug (e.g. 'alice-mbp'); ≤ 48 chars, no spaces, no leading/trailing hyphen.",
      },
      { status: 400 },
    );
  }
  if (!VALID_POLICY_SOURCES.has(policySource)) {
    return NextResponse.json(
      { error: "Policy source must be 'default' or 'custom'" },
      { status: 400 },
    );
  }
  if (policySource === "custom") {
    if (!customPolicyUrl) {
      return NextResponse.json(
        { error: "Custom policy URL is required when policy source = custom" },
        { status: 400 },
      );
    }
    let parsed: URL;
    try {
      parsed = new URL(customPolicyUrl);
    } catch {
      return NextResponse.json(
        { error: "Custom policy URL must be a valid URL (include https://)" },
        { status: 400 },
      );
    }
    if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
      return NextResponse.json(
        { error: "Custom policy URL must use https://" },
        { status: 400 },
      );
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return NextResponse.json(
        {
          error:
            "Custom policy URL cannot point at localhost, private, or link-local addresses.",
        },
        { status: 400 },
      );
    }
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to deploy a tripwire on this machine.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Phrase prefix is the machine ID — each machine's deployment has
  // its own permanent receipt URL like alice-mbp-amber-otter-3742.
  const phraseId = generateScopedPhraseId(`https://${machineId}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      machineId,
      policySource,
      notarize,
      status: "configuration pending",
      note: "stub configure — pluck-api /v1/tripwire/configure not yet wired; see plan",
    },
    { status: 200 },
  );
}
