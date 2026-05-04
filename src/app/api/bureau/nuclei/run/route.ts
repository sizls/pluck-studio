// ---------------------------------------------------------------------------
// POST /api/bureau/nuclei/run — NUCLEI publish endpoint (Phase-3 stub)
// ---------------------------------------------------------------------------
//
// Authors publish probe-packs to the registry. The form's TOFU
// enforcement (every entry MUST cross-reference an SBOM-AI Rekor uuid)
// is reproduced server-side: missing/malformed sbomRekorUuid → 400.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  isAllowedLicense,
  isValidAuthor,
  isValidPackName,
  isValidRekorUuid,
  parseVendorScope,
  validateCron,
} from "../../../../../lib/nuclei/run-form-module";
import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

interface NucleiRequestBody {
  author?: string;
  packName?: string;
  sbomRekorUuid?: string;
  vendorScope?: string;
  license?: string;
  recommendedInterval?: string;
  authorizationAcknowledged?: boolean;
}

const MAX_INTERVAL_LENGTH = 64;

// SECURITY: author handle squat — until pluck-api binds NUCLEI authors
// to authenticated user IDs, anyone can submit any author=<handle>.
// Phrase-ID prefix bakes handle into receipt URL → impersonation
// primitive when registry goes public. Tracking: must be fixed before
// public registry launch (NUCLEI v1.0 GA gate). See AE R1 finding S1.
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
        signInUrl: "/sign-in?redirect=/bureau/nuclei/run",
      },
      { status: 401 },
    );
  }
  let body: NucleiRequestBody;
  try {
    body = (await req.json()) as NucleiRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const author = body.author?.trim().toLowerCase() ?? "";
  const packName = body.packName?.trim() ?? "";
  const sbomRekorUuid = body.sbomRekorUuid?.trim().toLowerCase() ?? "";
  const vendorScope = body.vendorScope?.trim() ?? "";
  const license = body.license?.trim() ?? "";
  const recommendedInterval = body.recommendedInterval?.trim() ?? "";

  if (!isValidAuthor(author)) {
    return NextResponse.json(
      { error: "Author must be a short lowercase slug (e.g. 'alice')" },
      { status: 400 },
    );
  }
  if (!isValidPackName(packName)) {
    return NextResponse.json(
      {
        error:
          "Pack name must be in the form '<slug>@<version>' (e.g. 'canon-honesty@0.1')",
      },
      { status: 400 },
    );
  }
  if (!isValidRekorUuid(sbomRekorUuid)) {
    return NextResponse.json(
      {
        error:
          "SBOM-AI Rekor UUID is required (64–80 hex characters). Without an SBOM-AI cross-reference, the entry would land at trustTier='ingested' and consumers would refuse it.",
      },
      { status: 400 },
    );
  }
  const { pairs, invalid } = parseVendorScope(vendorScope);
  if (pairs.length === 0) {
    return NextResponse.json(
      { error: "Vendor scope must include at least one valid 'vendor/model' pair" },
      { status: 400 },
    );
  }
  if (invalid.length > 0) {
    return NextResponse.json(
      {
        error: `Vendor scope contains malformed entries: ${invalid.join(", ")}`,
      },
      { status: 400 },
    );
  }
  if (!isAllowedLicense(license)) {
    return NextResponse.json(
      { error: `License must be one of the allowed SPDX identifiers` },
      { status: 400 },
    );
  }
  if (recommendedInterval.length === 0 || recommendedInterval.length > MAX_INTERVAL_LENGTH) {
    return NextResponse.json(
      {
        error: `Recommended interval is required, ≤ ${MAX_INTERVAL_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }
  if (!validateCron(recommendedInterval)) {
    return NextResponse.json(
      {
        error:
          "Recommended interval must be a valid 5-field cron expression (e.g. '0 */4 * * *').",
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to publish this pack and the SBOM-AI cross-reference is genuine.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Phrase prefix is the author — registry entries belong to authors;
  // the URL self-discloses provenance.
  const phraseId = generateScopedPhraseId(`https://${author}.example`);

  // Anticipated verdict — Phase-stub: there's no real TOFU step yet, so
  // we mirror eventual semantics. A pre-validated sbomRekorUuid (passed
  // isValidRekorUuid above) anticipates 'published'. Once TOFU lands and
  // the cross-reference fails to verify against the SBOM-AI Rekor entry,
  // that path will downgrade to 'published-ingested-only' + tier
  // 'ingested' (registry-fenced; consumers refuse). The response shape
  // is ready for both verdicts now so subscribers don't have to do a
  // 2-field (verdict + trustTier) join later.
  const pendingVerdict: "published" | "published-ingested-only" = "published";
  const pendingTrustTier: "verified" | "ingested" = "verified";

  return NextResponse.json(
    {
      runId,
      phraseId,
      author,
      packName,
      sbomRekorUuid,
      vendorScope: pairs,
      license,
      recommendedInterval,
      status: "publish pending",
      pendingVerdict,
      pendingTrustTier,
      note: "stub publish — pluck-api /v1/nuclei/publish not yet wired; see plan",
    },
    { status: 200 },
  );
}
