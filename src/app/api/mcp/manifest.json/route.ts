// ---------------------------------------------------------------------------
// /api/mcp/manifest.json — public MCP discovery surface
// ---------------------------------------------------------------------------
//
// Serves the Studio MCP discovery document describing Studio's
// /v1/runs surface as MCP-compatible resources, tools, and prompts.
// External MCP servers (the upcoming `@sizls/pluck-mcp` bridge) read
// this document to discover the Pluck Bureau programs an AI agent can
// list, fetch, or execute. NOTE: this is NOT an MCP-spec conformant
// manifest — MCP itself is a JSON-RPC runtime protocol; this is a
// Studio-invented discovery catalogue consumed by the bridge.
//
// Posture (matches /openapi.json):
//   - Public read — no auth gate. The document is discovery-only, like
//     robots.txt or openapi.json. Sensitive run data is gated at the
//     /v1/runs read paths, NOT here.
//   - Same-site CSRF defence + rate limit still apply (cheap insurance
//     against scrape floods).
//   - Cache-Control: public, max-age=300 — same 5-minute window every
//     other JSON-discovery surface uses.
//   - Content-Type: application/json; charset=utf-8.
//   - X-Content-Type-Options: nosniff.
//
// Base URL: derived from the inbound request origin (NextRequest.nextUrl.origin)
// so local dev / preview deploys advertise their own origin instead of
// the production URL. Set `STUDIO_BASE_URL` to override (useful when
// Studio sits behind a proxy that rewrites the visible host).
//
// The manifest is built by `buildManifest` (pure function over the
// program registry) — adding a Bureau program auto-extends the
// resources + tools enum. Snapshot-tested in `lib/mcp/__tests__/`.
// ---------------------------------------------------------------------------

import { type NextRequest, NextResponse } from "next/server";

import packageJson from "../../../../../package.json";
import { buildManifest } from "../../../../lib/mcp/build-manifest";
import {
  isSameSiteRequest,
  rateLimitOk,
} from "../../../../lib/security/request-guards";

export async function GET(req: NextRequest): Promise<Response> {
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

  const baseUrl = process.env.STUDIO_BASE_URL ?? req.nextUrl.origin;

  const manifest = buildManifest({
    baseUrl,
    version: packageJson.version,
  });

  return NextResponse.json(manifest, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
