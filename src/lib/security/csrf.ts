// ---------------------------------------------------------------------------
// CSRF — double-submit cookie pattern
// ---------------------------------------------------------------------------
//
// The `isSameSiteRequest` gate (Sec-Fetch-Site + Origin/Referer fallback)
// catches the bulk of CSRF in modern browsers but leaks in two edge
// cases the audit's offensive lens flagged:
//
//   1. Older browsers don't send `Sec-Fetch-Site`. The Origin/Referer
//      fallback survives most XSS-driven CSRF but breaks against an
//      attacker who controls a same-site subdomain (e.g. picking up a
//      compromised pluck.run sub-host).
//   2. Some CDN edge configurations strip `Sec-Fetch-Site` before the
//      request reaches the Next.js route. The fallback fires but is
//      itself soft.
//
// The double-submit cookie closes both gaps. Flow:
//
//   - On first GET that lands on Studio, middleware sets a random
//     32-byte hex token in the `pluck-csrf` cookie (`SameSite=Lax`,
//     non-httpOnly so client JS can read it, `Secure` in production).
//   - Forms / fetch callers read the cookie and send the same token
//     back in the `x-csrf-token` header.
//   - Server-side `verifyCsrfToken` checks that cookie and header
//     match. The attacker can't read the cookie (cross-origin), can't
//     write the header in a `<form>` POST, and the JSON content-type
//     forces a preflight that blocks the body channel.
//
// The token is stable per session (24h max-age) so users don't lose
// their submit on every page nav. We rotate when the cookie expires
// or when the user signs in (Supabase auth flow re-issues).
//
// This module is import-safe in both server and client code — it only
// reaches for `node:crypto` inside server-only helpers. The client
// reads the cookie via `document.cookie`, which is exposed by
// `csrfTokenFromDocument` in the companion `csrf-client.ts` module.
// ---------------------------------------------------------------------------

import { randomBytes, timingSafeEqual } from "node:crypto";

export const CSRF_COOKIE_NAME = "pluck-csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

/** Length of the hex-encoded token. 32 bytes → 64 hex chars. */
export const CSRF_TOKEN_HEX_LENGTH = 64;

const HEX_PATTERN = /^[a-f0-9]+$/i;

/** Generate a fresh CSRF token. 32 random bytes hex-encoded. */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/** Set-Cookie value for the CSRF token. SameSite=Lax, non-httpOnly. */
export function csrfSetCookie(token: string): string {
  const flags = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "Path=/",
    "SameSite=Lax",
    "Max-Age=86400",
  ];
  if (process.env.NODE_ENV === "production") {
    flags.push("Secure");
  }
  return flags.join("; ");
}

/** Extract the CSRF token from the request's cookie header. */
export function csrfTokenFromCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader === null) {
    return null;
  }
  for (const raw of cookieHeader.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(`${CSRF_COOKIE_NAME}=`)) {
      continue;
    }
    const value = trimmed.slice(CSRF_COOKIE_NAME.length + 1);
    if (value.length === 0) {
      return null;
    }
    return value;
  }
  return null;
}

/**
 * Extract the CSRF token that the caller submitted. The header path is
 * preferred (standard double-submit), with an explicit `csrfToken` body
 * field as a fallback so HTML form posts that can't add custom headers
 * still work.
 */
export function csrfTokenFromRequest(
  req: Request,
  body?: unknown,
): string | null {
  const headerValue = req.headers.get(CSRF_HEADER_NAME);
  if (headerValue !== null && headerValue.length > 0) {
    return headerValue;
  }
  if (body !== null && typeof body === "object" && !Array.isArray(body)) {
    const fromBody = (body as Record<string, unknown>).csrfToken;
    if (typeof fromBody === "string" && fromBody.length > 0) {
      return fromBody;
    }
  }
  return null;
}

/**
 * True when the request needs no CSRF gate — bearer-token auth
 * doesn't have a CSRF vector because there's no ambient cookie
 * credential the attacker can ride on. CLI clients, MCP bridges, and
 * the test suite all use bearer auth, so the cookie-based defense
 * doesn't apply to them.
 *
 * Cookie-based auth (Supabase session) DOES carry a CSRF vector and
 * requires the matching token in the header (or body fallback).
 */
export function isCsrfSafe(req: Request, body?: unknown): boolean {
  const authz = req.headers.get("authorization");
  if (
    authz !== null &&
    authz.toLowerCase().startsWith("bearer ") &&
    authz.length > "bearer ".length
  ) {
    return true;
  }
  return verifyCsrfToken(req, body);
}

/**
 * Constant-time CSRF verification. True iff the cookie token and the
 * submitted token are both present, the same length, the same hex
 * shape, and byte-equal.
 *
 * The shape check matters because Next.js dev-mode HMR has been
 * observed to overwrite cookies with `expired` markers — without the
 * hex-shape filter, an attacker who can plant a literal string could
 * trick the comparison into succeeding on a forged value.
 */
export function verifyCsrfToken(req: Request, body?: unknown): boolean {
  const cookie = csrfTokenFromCookie(req);
  const submitted = csrfTokenFromRequest(req, body);
  if (cookie === null || submitted === null) {
    return false;
  }
  if (cookie.length !== submitted.length) {
    return false;
  }
  if (
    cookie.length !== CSRF_TOKEN_HEX_LENGTH ||
    !HEX_PATTERN.test(cookie) ||
    !HEX_PATTERN.test(submitted)
  ) {
    return false;
  }
  // Both strings are hex; convert to bytes for timingSafeEqual.
  const a = Buffer.from(cookie, "hex");
  const b = Buffer.from(submitted, "hex");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}
