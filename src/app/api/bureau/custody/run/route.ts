// ---------------------------------------------------------------------------
// POST /api/bureau/custody/run — CUSTODY verify-bundle endpoint (Phase-6 stub)
// ---------------------------------------------------------------------------
//
// Fourth program through the Studio activation pattern. CUSTODY's
// existing `/bureau/custody/verify` is a journalist drag-and-drop tool
// (no signed receipt). This `/run` flow is the operator complement:
// fetch + verify a CustodyBundle URL server-side, emit a signed
// FRE 902(13) compliance verdict.
//
// Day-1 contract:
//   1. Shared CSRF + auth + rate-limit guards (lib/security/request-guards).
//   2. Domain validation: bundleUrl HTTPS-only, public, not localhost
//      / private / link-local. expectedVendor is an optional bare
//      hostname slug (used to assert `body.vendor === expectedVendor`).
//   3. ToS / authorization-to-fetch assertion.
//   4. On success: returns { runId, phraseId, status:"verification pending" }.
//      Real verify path lands when pluck-api /v1/custody/verify ships.
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

interface CustodyRequestBody {
  bundleUrl?: string;
  expectedVendor?: string;
  authorizationAcknowledged?: boolean;
}

const ALLOWED_BUNDLE_SCHEMES = new Set(["https:"]);
const VENDOR_SLUG_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isValidExpectedVendor(s: string): boolean {
  const lowered = s.toLowerCase();
  if (!VENDOR_SLUG_PATTERN.test(lowered)) {
    return false;
  }
  if (isPrivateOrLocalHost(lowered)) {
    return false;
  }
  return true;
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
  if (!isAuthed(req)) {
    return NextResponse.json(
      {
        error: "authentication required",
        signInUrl: "/sign-in?redirect=/bureau/custody/run",
      },
      { status: 401 },
    );
  }
  let body: CustodyRequestBody;
  try {
    body = (await req.json()) as CustodyRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const bundleUrl = body.bundleUrl?.trim();
  const expectedVendor = body.expectedVendor?.trim().toLowerCase();

  if (!bundleUrl) {
    return NextResponse.json(
      { error: "Bundle URL is required (https:// only, public host)" },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to fetch this bundle before running.",
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
      { error: "Bundle URL must use https:// (per CUSTODY wire spec)" },
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
  if (expectedVendor !== undefined && expectedVendor.length > 0) {
    if (!isValidExpectedVendor(expectedVendor)) {
      return NextResponse.json(
        {
          error:
            "Expected vendor must be a public hostname (e.g. 'openai.com'); no IPs, no localhost, no scheme, no path.",
        },
        { status: 400 },
      );
    }
  }
  const runId = randomUUID();
  // Vendor-scoped phrase ID — prefer expectedVendor when supplied so the
  // URL self-discloses the asserted target; else fall back to the
  // bundle-URL hostname.
  const phraseId = expectedVendor && expectedVendor.length > 0
    ? generateScopedPhraseId(`https://${expectedVendor}`)
    : generateScopedPhraseId(bundleUrl);

  return NextResponse.json(
    {
      runId,
      phraseId,
      bundleUrl,
      expectedVendor: expectedVendor && expectedVendor.length > 0
        ? expectedVendor
        : null,
      status: "verification pending",
      note: "stub verify — pluck-api /v1/custody/verify not yet wired; see plan",
    },
    { status: 200 },
  );
}
