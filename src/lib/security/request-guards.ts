// ---------------------------------------------------------------------------
// Shared request guards across program POST handlers
// ---------------------------------------------------------------------------
//
// DRAGNET, OATH, and the rest of the programs share the same
// route-level security posture: CSRF defence, auth check, rate limit.
// This module is the single source of truth so every program inherits
// the same hardening (and a regression in one place fails for all).
//
// What lives elsewhere:
//   - Per-route field validation (URL scheme, hostname allowlist,
//     pack-ID allowlist) stays inside each route — those checks are
//     domain-specific.
//   - Phrase-id generation lives in lib/phrase-id.ts.
//   - Rate-limit bucket lives in lib/rate-limit.ts.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

import { checkRateLimitState } from "../rate-limit";

const SUPABASE_AUTH_COOKIE_PATTERN = /^sb-[^-]+-auth-token(\.\d+)?$/;
const ALLOWED_ORIGIN_HOSTNAMES = new Set([
  "studio.pluck.run",
  "localhost",
  "127.0.0.1",
]);

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

export function isSameSiteRequest(req: Request): boolean {
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

export function hasSupabaseSession(req: Request): boolean {
  const cookieHeader = req.headers.get("cookie");

  if (!cookieHeader) {
    return false;
  }
  const cookies = cookieHeader.split(";").map((c) => c.trim().split("=")[0]);

  return cookies.some(
    (name) => name !== undefined && SUPABASE_AUTH_COOKIE_PATTERN.test(name),
  );
}

/**
 * Bearer-token branch is allowed in KNOWN dev / test environments only,
 * OR via explicit positive opt-in (`PLUCK_DEV_BEARER_AUTH=1`).
 *
 * Earlier this gated on `NODE_ENV !== "production"`, which silently
 * flipped on for any preview/staging deploy where `NODE_ENV` was unset
 * (Vercel preview URLs default to unset) — meaning a leaked preview URL
 * could be hit with `Authorization: Bearer anything` and pass the auth
 * gate. The whitelist + positive-opt-in pattern keeps tests + local dev
 * frictionless while locking unset/staging environments by default.
 *
 * Allowed when:
 *   - NODE_ENV === "test"        — Vitest defaults to this
 *   - NODE_ENV === "development" — `next dev` defaults to this
 *   - PLUCK_DEV_BEARER_AUTH === "1" — explicit opt-in for any other env
 */
export function bearerAllowedInThisEnv(): boolean {
  if (process.env.PLUCK_DEV_BEARER_AUTH === "1") {
    return true;
  }
  const env = process.env.NODE_ENV;
  return env === "test" || env === "development";
}

export function hasBearerToken(req: Request): boolean {
  const authz = req.headers.get("authorization");

  return authz !== null && authz.toLowerCase().startsWith("bearer ");
}

export function isAuthed(req: Request): boolean {
  if (hasSupabaseSession(req)) {
    return true;
  }
  if (bearerAllowedInThisEnv() && hasBearerToken(req)) {
    return true;
  }
  return false;
}

/**
 * Extract a stable per-session identifier so the v1 stores can pin
 * each run / watch to its creator and the DELETE/PATCH/POST-trigger
 * endpoints can reject cross-account access.
 *
 * The current STUB auth (cookie + bearer) does NOT verify a JWT
 * signature, so this can't return the canonical Supabase user UUID.
 * Instead it derives an opaque, deterministic hash of whatever
 * authenticates the request — the Supabase auth cookie value or the
 * bearer-token string. Same browser session → same ownerId; a
 * different browser (or anonymized cookie) → different ownerId.
 *
 * That's enough to close the IDOR: User A's cookie can't claim a
 * record User B's cookie created, because the two hashes don't
 * match. Hashes are SHA-256 truncated to 24 hex chars — short enough
 * to fit in a log line, long enough to avoid practical collisions in
 * a stub deployment.
 *
 * When the real `/v1/runs` runner ships with verified JWT auth, this
 * helper swaps the derivation to `jwt.sub` and every record
 * automatically pins to the verified user UUID. The store API stays
 * unchanged.
 *
 * Returns `null` when the request has no auth surface — callers
 * should treat that as a 401 (the `isAuthed` gate should already
 * catch it; this is defensive).
 */
export function ownerIdFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader !== null) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const sbCookie = cookies.find((c) => {
      const name = c.split("=")[0];
      return name !== undefined && SUPABASE_AUTH_COOKIE_PATTERN.test(name);
    });
    if (sbCookie !== undefined) {
      const value = sbCookie.split("=").slice(1).join("=");
      if (value.length > 0) {
        return hashOwnerSeed(`sb:${value}`);
      }
    }
  }
  const authz = req.headers.get("authorization");
  if (
    authz !== null &&
    authz.toLowerCase().startsWith("bearer ") &&
    bearerAllowedInThisEnv()
  ) {
    const token = authz.slice("bearer ".length).trim();
    if (token.length > 0) {
      return hashOwnerSeed(`bearer:${token}`);
    }
  }
  return null;
}

/**
 * SHA-256 of the raw seed, hex-truncated to 24 chars. Plenty of entropy
 * for ownership equality, short enough to render in log lines without
 * scrolling the terminal off-screen.
 */
function hashOwnerSeed(seed: string): string {
  return createHash("sha256").update(seed).digest("hex").slice(0, 24);
}

function clientKey(req: Request): string {
  // NB: in production behind Vercel/Cloudflare, X-Forwarded-For is
  // normalised by the upstream proxy. In dev, an attacker can spoof
  // XFF per request — pair with the rate-limit bucket cap to bound
  // the damage.
  const xff = req.headers.get("x-forwarded-for");
  const xri = req.headers.get("x-real-ip");
  const ip = xff?.split(",")[0]?.trim() ?? xri ?? "unknown";
  const cookieMark = hasSupabaseSession(req) ? "session" : "anon";

  return `${ip}::${cookieMark}`;
}

export interface RateLimitVerdict {
  /** True when the request fit within the bucket. */
  ok: boolean;
  /** Configured limit (requests per window). */
  limit: number;
  /** Tokens left in the current window AFTER this check. */
  remaining: number;
  /** Unix epoch SECONDS when the bucket resets (per IETF
   *  draft-ietf-httpapi-ratelimit-headers convention). */
  resetAtSeconds: number;
  /** Seconds the client should wait before retrying (0 when ok). */
  retryAfterSeconds: number;
}

export function rateLimit(req: Request): RateLimitVerdict {
  const state = checkRateLimitState(clientKey(req), {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
  const nowMs = Date.now();
  const retryAfterSeconds = state.allowed
    ? 0
    : Math.max(1, Math.ceil((state.resetAt - nowMs) / 1000));

  return {
    ok: state.allowed,
    limit: RATE_LIMIT_MAX,
    remaining: state.remaining,
    resetAtSeconds: Math.ceil(state.resetAt / 1000),
    retryAfterSeconds,
  };
}

export function rateLimitOk(req: Request): boolean {
  return rateLimit(req).ok;
}

/**
 * Build the rate-limit response headers per IETF
 * draft-ietf-httpapi-ratelimit-headers + RFC 7231 `Retry-After`.
 *
 * Emit on every response (success and 429) so clients can
 * predict throttling — RFC behaviour. `Retry-After` is only set
 * when the request was rejected.
 */
export function rateLimitHeaders(
  v: RateLimitVerdict,
): Record<string, string> {
  const h: Record<string, string> = {
    "X-RateLimit-Limit": String(v.limit),
    "X-RateLimit-Remaining": String(v.remaining),
    "X-RateLimit-Reset": String(v.resetAtSeconds),
  };
  if (!v.ok) {
    h["Retry-After"] = String(v.retryAfterSeconds);
  }
  return h;
}

const LOCAL_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
  "::",
  "127.0.0.1",
]);

/**
 * Cosmetic SSRF guard — DNS-resolution-time filter is C2's job (lands
 * with the real runner). This rejects obvious mistakes server-side so
 * a typo doesn't quietly anchor a worthless run.
 */
export function isPrivateOrLocalHost(hostname: string): boolean {
  if (LOCAL_HOSTNAMES.has(hostname)) {
    return true;
  }
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
  const lower = hostname.toLowerCase();
  if (lower.startsWith("[fc") || lower.startsWith("[fd")) {
    return true;
  }
  if (lower.startsWith("[fe80:")) {
    return true;
  }
  return false;
}
