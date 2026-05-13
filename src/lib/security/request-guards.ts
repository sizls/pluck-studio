// ---------------------------------------------------------------------------
// Shared request guards across Bureau program POST handlers
// ---------------------------------------------------------------------------
//
// DRAGNET, OATH, and the rest of the Bureau programs share the same
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

import { checkRateLimit } from "../rate-limit";

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

export function rateLimitOk(req: Request): boolean {
  return checkRateLimit(clientKey(req), {
    max: RATE_LIMIT_MAX,
    windowMs: RATE_LIMIT_WINDOW_MS,
  });
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
