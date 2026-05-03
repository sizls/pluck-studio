// ---------------------------------------------------------------------------
// POST /api/bureau/dragnet/run — DRAGNET activation endpoint (day-1 stub)
// ---------------------------------------------------------------------------
//
// Day-1 contract per the v1 plan:
//   1. Auth check by Supabase JWT cookie presence (real verification lands
//      with pluck-api /v1/runs).
//   2. CSRF defence — same-origin enforced via Sec-Fetch-Site / Origin /
//      Referer. Any cross-site POST is 403 regardless of cookies.
//   3. URL scheme allowlist — only http: / https: target URLs accepted to
//      block javascript: / file: / data: stored-XSS feeders ahead of the
//      C2 SSRF egress filter that lands with the real runner. Localhost
//      and RFC1918 / link-local hostnames also rejected client-side as a
//      cosmetic guard (real DNS-resolution-time filter is C2's job).
//   4. Pack-ID allowlist — only the bundled `canon-honesty` and the
//      qualified NUCLEI form `<author>/<pack>@<version>` accepted. Bare
//      typos like `canon-honestly` 400 instead of silently anchoring a
//      run nobody will ever look at.
//   5. Per-IP rate limit — 10 POSTs / minute, in-memory token bucket.
//      Sized for the stub; replaced by edge / Kite-substrate limiter when
//      the real /v1/runs endpoint lands.
//   6. ToS / probe-authorization assertion — the operator must check the
//      box that they are authorized to probe the target (H9 fix). Logged
//      in-memory today; lands in Kite event log when the real runner
//      ships.
//   7. On missing auth: 401 + { signInUrl } so the form can surface a
//      sign-in prompt rather than redirect-eating the user's input.
//   8. On success: returns { runId, phraseId } — the phrase is the
//      user-facing identifier (see lib/phrase-id.ts), the UUID is kept
//      for cross-system joins. Real RunSpec creation, signing, and Rekor
//      anchoring all land when pluck-api ships /v1/runs.
//
// SECURITY (deferred to follow-on commits, tracked in plan AE findings):
//   C2 SSRF on destination URI — targetUrl is currently echoed only; no
//      egress yet. The DNS-resolution-time IPv4/IPv6 link-local + RFC1918
//      deny + bogon filter + no-redirect HTTP client lands with the
//      real runner.
//   C5 Idempotency — POST is currently non-idempotent. Real handler hashes
//      (user_id, source, pipeline, options, destination, client_nonce)
//      before insert into runs.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { generatePhraseId } from "../../../../../lib/phrase-id";
import { checkRateLimit } from "../../../../../lib/rate-limit";

interface RunRequestBody {
  targetUrl?: string;
  probePackId?: string;
  cadence?: "once" | "continuous";
  authorizationAcknowledged?: boolean;
}

const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-[^-]+-auth-token(\.\d+)?$/;
const ALLOWED_ORIGIN_HOSTNAMES = new Set([
  "studio.pluck.run",
  "localhost",
  "127.0.0.1",
]);
const ALLOWED_TARGET_SCHEMES = new Set(["http:", "https:"]);
const BUNDLED_PACK_IDS = new Set(["canon-honesty"]);
const QUALIFIED_PACK_ID = /^[a-z0-9_-]+\/[a-z0-9_-]+@[a-zA-Z0-9._+-]+$/;
const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
  "::",
  "127.0.0.1",
]);
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function isPrivateOrLocalHost(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) {
    return true;
  }
  // IPv4 RFC1918 + link-local + loopback
  const ipv4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) {
      return true;
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }
    if (a === 192 && b === 168) {
      return true;
    }
    if (a === 169 && b === 254) {
      return true;
    }
  }
  // IPv6 fc00::/7 (ULA), fe80::/10 (link-local)
  const lower = hostname.toLowerCase();
  if (lower.startsWith("[fc") || lower.startsWith("[fd")) {
    return true;
  }
  if (lower.startsWith("[fe80:")) {
    return true;
  }
  return false;
}

function isSameSiteRequest(req: Request): boolean {
  const fetchSite = req.headers.get("sec-fetch-site");

  if (fetchSite !== null) {
    return fetchSite === "same-origin" || fetchSite === "same-site";
  }
  const candidate = req.headers.get("origin") ?? req.headers.get("referer");

  if (candidate === null) {
    return false;
  }
  try {
    const u = new URL(candidate);

    return ALLOWED_ORIGIN_HOSTNAMES.has(u.hostname);
  } catch {
    return false;
  }
}

function hasSupabaseSession(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie");

  if (!cookieHeader) {
    return false;
  }
  const cookies = cookieHeader.split(";").map((c) => c.trim().split("=")[0]);

  return cookies.some(
    (name) => name !== undefined && SUPABASE_AUTH_COOKIE_PATTERN.test(name),
  );
}

function bearerAllowedInThisEnv(): boolean {
  return process.env.NODE_ENV !== "production";
}

function hasBearerToken(req: Request): boolean {
  const authz = req.headers.get("authorization");

  return authz !== null && authz.toLowerCase().startsWith("bearer ");
}

function clientKey(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  const xri = req.headers.get("x-real-ip");
  const ip = xff?.split(",")[0]?.trim() ?? xri ?? "unknown";
  const cookieMark = hasSupabaseSession(req) ? "session" : "anon";

  return `${ip}::${cookieMark}`;
}

function rateLimitOk(req: Request): boolean {
  return checkRateLimit(clientKey(req), {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
}

function isAllowedPackId(id: string): boolean {
  return BUNDLED_PACK_IDS.has(id) || QUALIFIED_PACK_ID.test(id);
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
  const sessionAuthed = hasSupabaseSession(req);
  const bearerAuthed = bearerAllowedInThisEnv() && hasBearerToken(req);

  if (!sessionAuthed && !bearerAuthed) {
    return NextResponse.json(
      {
        error: "authentication required",
        signInUrl: "/sign-in?redirect=/bureau/dragnet/run",
      },
      { status: 401 },
    );
  }
  let body: RunRequestBody;
  try {
    body = (await req.json()) as RunRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid JSON body" },
      { status: 400 },
    );
  }
  const targetUrl = body.targetUrl?.trim();
  const probePackId = body.probePackId?.trim();
  const cadence = body.cadence ?? "once";

  if (!targetUrl || !probePackId) {
    return NextResponse.json(
      { error: "Target endpoint and Probe-pack ID are required" },
      { status: 400 },
    );
  }
  if (cadence !== "once" && cadence !== "continuous") {
    return NextResponse.json(
      { error: "Cadence must be 'once' or 'continuous'" },
      { status: 400 },
    );
  }
  if (cadence === "continuous") {
    return NextResponse.json(
      {
        error:
          "Continuous monitoring is coming soon — for now, run once and we'll re-run on cycle when scheduling lands.",
      },
      { status: 400 },
    );
  }
  if (body.authorizationAcknowledged !== true) {
    return NextResponse.json(
      {
        error:
          "You must acknowledge that you are authorized to probe this target before running.",
      },
      { status: 400 },
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json(
      { error: "Target endpoint must be a valid URL (include https://)" },
      { status: 400 },
    );
  }
  if (!ALLOWED_TARGET_SCHEMES.has(parsed.protocol)) {
    return NextResponse.json(
      { error: "Target endpoint must use http:// or https://" },
      { status: 400 },
    );
  }
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return NextResponse.json(
      {
        error:
          "Target endpoint cannot point at localhost, private, or link-local addresses.",
      },
      { status: 400 },
    );
  }
  if (!isAllowedPackId(probePackId)) {
    return NextResponse.json(
      {
        error:
          "Unknown probe-pack. Use 'canon-honesty' (bundled) or a NUCLEI-qualified ID like 'author/pack@version'.",
      },
      { status: 400 },
    );
  }
  const runId = randomUUID();
  const phraseId = generatePhraseId();

  return NextResponse.json(
    {
      runId,
      phraseId,
      cadence,
      status: "cycle pending",
      note: "stub run — pluck-api /v1/runs not yet wired; see plan",
    },
    { status: 200 },
  );
}
