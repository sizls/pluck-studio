// ---------------------------------------------------------------------------
// POST /api/bureau/oath/run — OATH verify endpoint (Phase-4 stub)
// ---------------------------------------------------------------------------
//
// OATH's flow is fundamentally different from DRAGNET's: instead of
// executing a probe-pack against a target endpoint, OATH fetches a
// vendor's `/.well-known/pluck-oath.json`, verifies the DSSE envelope,
// cross-checks the served Origin against `body.vendor`, and emits a
// verdict (verified | signature-failed | origin-mismatch | expired |
// not-found | fetch-failed).
//
// Day-1 contract:
//   1. Shared CSRF + auth + rate-limit guards (lib/security/request-guards).
//   2. Domain-specific validation:
//      - vendorDomain: bare hostname (e.g. "openai.com"), validated
//        against private-IP and TLD-shape rules.
//      - expectedOrigin (optional): full URL like "https://chat.openai.com"
//        used to override the auto-derived `https://<vendorDomain>`.
//   3. ToS / authorization-to-fetch assertion.
//   4. On success: returns { runId, phraseId, status:"verification pending" }.
//      Real verify path lands when pluck-api /v1/oath/verify ships.
//
// SECURITY (deferred):
//   - HTTPS-only fetch with 256 KiB cap + 10s timeout + no-redirect lands
//     server-side with the real /v1/oath/verify endpoint.
//   - Rate-limit shares the global per-IP+session bucket with DRAGNET
//     (same lib/rate-limit.ts).
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

interface OathRequestBody {
  vendorDomain?: string;
  expectedOrigin?: string;
  authorizationAcknowledged?: boolean;
}

const ALLOWED_ORIGIN_SCHEMES = new Set(["https:"]);
const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isValidVendorDomain(s: string): boolean {
  // Bare hostname, no scheme, no path. We require at least one dot
  // (TLD-bearing). Reject IPs (no dots in the right pattern) and any
  // private/local hosts the operator might paste by mistake.
  const lowered = s.toLowerCase();
  if (!HOSTNAME_PATTERN.test(lowered)) {
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
        signInUrl: "/sign-in?redirect=/bureau/oath/run",
      },
      { status: 401 },
    );
  }
  let body: OathRequestBody;
  try {
    body = (await req.json()) as OathRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const vendorDomain = body.vendorDomain?.trim().toLowerCase();
  const expectedOrigin = body.expectedOrigin?.trim();

  if (!vendorDomain) {
    return NextResponse.json(
      { error: "Vendor domain is required (e.g. 'openai.com')" },
      { status: 400 },
    );
  }
  if (!isValidVendorDomain(vendorDomain)) {
    return NextResponse.json(
      {
        error:
          "Vendor domain must be a public hostname (e.g. 'openai.com'); no IPs, no localhost, no scheme, no path.",
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to fetch this vendor's oath before running.",
      },
      { status: 400 },
    );
  }
  if (expectedOrigin !== undefined && expectedOrigin.length > 0) {
    let parsed: URL;
    try {
      parsed = new URL(expectedOrigin);
    } catch {
      return NextResponse.json(
        { error: "Expected origin must be a valid URL (include https://)" },
        { status: 400 },
      );
    }
    if (!ALLOWED_ORIGIN_SCHEMES.has(parsed.protocol)) {
      return NextResponse.json(
        { error: "Expected origin must use https:// (per OATH wire spec)" },
        { status: 400 },
      );
    }
    if (isPrivateOrLocalHost(parsed.hostname)) {
      return NextResponse.json(
        {
          error:
            "Expected origin cannot point at localhost, private, or link-local addresses.",
        },
        { status: 400 },
      );
    }
  }
  const runId = randomUUID();
  // Vendor-scoped phrase ID — the URL self-discloses the OATH target.
  const phraseId = generateScopedPhraseId(`https://${vendorDomain}`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      vendorDomain,
      expectedOrigin: expectedOrigin && expectedOrigin.length > 0
        ? expectedOrigin
        : `https://${vendorDomain}`,
      status: "verification pending",
      note: "stub verify — pluck-api /v1/oath/verify not yet wired; see plan",
    },
    { status: 200 },
  );
}
