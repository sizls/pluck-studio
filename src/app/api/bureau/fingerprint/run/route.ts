// ---------------------------------------------------------------------------
// POST /api/bureau/fingerprint/run — FINGERPRINT scan endpoint (Phase-4 stub)
// ---------------------------------------------------------------------------
//
// Third program through the Studio activation pattern. Same hardening
// posture as DRAGNET + OATH (shared via lib/security/request-guards),
// different domain validation:
//
//   - vendor: short slug ("openai", "anthropic", ...)
//   - model:  longer slug allowing dots/underscores ("gpt-4o",
//             "claude-3-5-sonnet", "llama-3.1-70b", ...)
//
// FINGERPRINT runs a fixed 5-probe calibration set against the
// vendor+model and emits a signed `ModelFingerprint/v1` cassette.
// Studio's hosted-mode runner wires the transport (OpenAI / Anthropic
// / etc) — the operator just picks the target. When pluck-api
// /v1/fingerprint/scan ships, this handler proxies to it.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import {
  isValidModelSlug,
  isValidVendorSlug,
} from "../../../../../lib/fingerprint/run-form-module";
import { generateScopedPhraseId } from "../../../../../lib/phrase-id";
import {
  isAuthed,
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../../lib/security/request-guards";

interface FingerprintRequestBody {
  vendor?: string;
  model?: string;
  authorizationAcknowledged?: boolean;
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
        signInUrl: "/sign-in?redirect=/bureau/fingerprint/run",
      },
      { status: 401 },
    );
  }
  let body: FingerprintRequestBody;
  try {
    body = (await req.json()) as FingerprintRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const vendor = body.vendor?.trim().toLowerCase() ?? "";
  const model = body.model?.trim().toLowerCase() ?? "";

  if (!vendor || !model) {
    return NextResponse.json(
      { error: "Vendor and Model are required (e.g. 'openai' + 'gpt-4o')" },
      { status: 400 },
    );
  }
  if (!isValidVendorSlug(vendor)) {
    return NextResponse.json(
      {
        error:
          "Vendor must be a short lowercase slug (e.g. 'openai', 'anthropic'); no spaces, no dots, no slashes.",
      },
      { status: 400 },
    );
  }
  if (!isValidModelSlug(model)) {
    return NextResponse.json(
      {
        error:
          "Model must be a slug like 'gpt-4o' or 'claude-3-5-sonnet'; lowercase letters, digits, '.', '-', '_' only.",
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to scan this vendor's model before running.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  // Vendor-scoped phrase ID — `<vendor>-<adj>-<noun>-<NNNN>`, where
  // the vendor prefix matches the form's `vendor` slug exactly.
  const phraseId = generateScopedPhraseId(`https://${vendor}.example`);

  return NextResponse.json(
    {
      runId,
      phraseId,
      vendor,
      model,
      status: "scan pending",
      note: "stub scan — pluck-api /v1/fingerprint/scan not yet wired; see plan",
    },
    { status: 200 },
  );
}
