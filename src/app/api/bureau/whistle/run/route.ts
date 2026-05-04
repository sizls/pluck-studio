// ---------------------------------------------------------------------------
// POST /api/bureau/whistle/run — WHISTLE submit endpoint (Phase-5 stub)
// ---------------------------------------------------------------------------
//
// First *capture* program through the activation pattern. Operator
// submits a tip-bundle URL + category + routing partner; Studio
// fetches, redacts, routes, anchors. The receipt is the operator's
// proof of submission; verifying the truth of the tip is downstream.
//
// V2-A scope:
//   - URL-fetched bundle only (paste-JSON deferred)
//   - Single routing partner per submission
//   - Both anonymityCaveatAcknowledged AND authorizationAcknowledged
//     required (heavier legal posture than verify programs)
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

interface WhistleRequestBody {
  bundleUrl?: string;
  category?: string;
  routingPartner?: string;
  manualRedactPhrase?: string;
  anonymityCaveatAcknowledged?: boolean;
  authorizationAcknowledged?: boolean;
}

const ALLOWED_BUNDLE_SCHEMES = new Set(["https:"]);
const VALID_CATEGORIES = new Set([
  "training-data",
  "policy-violation",
  "safety-incident",
]);
const VALID_ROUTING_PARTNERS = new Set([
  "propublica",
  "bellingcat",
  "404media",
  "eff-press",
]);
// Sanity bound on the manual-redact phrase — long phrases mean the
// scrub regex grows unboundedly, slowing the redactor on big bundles.
const MAX_REDACT_PHRASE_LENGTH = 256;

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
        signInUrl: "/sign-in?redirect=/bureau/whistle/run",
      },
      { status: 401 },
    );
  }
  let body: WhistleRequestBody;
  try {
    body = (await req.json()) as WhistleRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const bundleUrl = body.bundleUrl?.trim();
  const category = body.category?.trim();
  const routingPartner = body.routingPartner?.trim();
  const manualRedactPhrase = body.manualRedactPhrase?.trim() ?? "";

  if (!bundleUrl) {
    return NextResponse.json(
      { error: "Bundle URL is required (https:// only)" },
      { status: 400 },
    );
  }
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json(
      {
        error:
          "Category must be one of 'training-data', 'policy-violation', 'safety-incident'",
      },
      { status: 400 },
    );
  }
  if (!routingPartner || !VALID_ROUTING_PARTNERS.has(routingPartner)) {
    return NextResponse.json(
      {
        error:
          "Routing partner must be one of 'propublica', 'bellingcat', '404media', 'eff-press'",
      },
      { status: 400 },
    );
  }
  if (manualRedactPhrase.length > MAX_REDACT_PHRASE_LENGTH) {
    return NextResponse.json(
      {
        error: `Manual redact phrase must be ≤ ${MAX_REDACT_PHRASE_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }
  if (body.anonymityCaveatAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that anonymity is best-effort, NOT absolute, before submitting.",
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to submit this bundle.",
      },
      { status: 400 },
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(bundleUrl);
  } catch {
    return NextResponse.json(
      { error: "Bundle URL must be a valid URL (include https://)" },
      { status: 400 },
    );
  }
  if (!ALLOWED_BUNDLE_SCHEMES.has(parsed.protocol)) {
    return NextResponse.json(
      { error: "Bundle URL must use https://" },
      { status: 400 },
    );
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return NextResponse.json(
      {
        error:
          "Bundle URL cannot point at localhost, private, or link-local addresses.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // For WHISTLE the phrase ID prefix is the routing-partner slug,
  // NOT the bundle source — anonymity-by-default. The vendor or
  // source identity stays inside the bundle body, never in the URL.
  const phraseId = generateScopedPhraseId(`https://${routingPartner}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      category,
      routingPartner,
      status: "submission pending",
      note: "stub submit — pluck-api /v1/whistle/submit not yet wired; see plan",
    },
    { status: 200 },
  );
}
