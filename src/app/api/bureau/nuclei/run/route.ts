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
  parseVendorScope,
} from "../../../../../lib/nuclei/run-form-module";
import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";
import { validateNucleiPayload } from "../../../../../lib/v1/pipeline-validators";

interface NucleiRequestBody {
  author?: string;
  packName?: string;
  sbomRekorUuid?: string;
  vendorScope?: string;
  license?: string;
  recommendedInterval?: string;
  authorizationAcknowledged?: boolean;
}

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

  // Single source of truth — the same validator /v1/runs uses. Keeps the
  // two surfaces from drifting (M1 fix).
  const result = validateNucleiPayload(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // After validation passes, these are guaranteed strings — re-derive them
  // here for the response shape and phrase-id derivation. Trim/normalize
  // mirrors the validator's own normalization.
  const author = (body.author ?? "").trim().toLowerCase();
  const packName = (body.packName ?? "").trim();
  const sbomRekorUuid = (body.sbomRekorUuid ?? "").trim().toLowerCase();
  const vendorScope = (body.vendorScope ?? "").trim();
  const license = (body.license ?? "").trim();
  const recommendedInterval = (body.recommendedInterval ?? "").trim();
  const { pairs } = parseVendorScope(vendorScope);
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
