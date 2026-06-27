// ---------------------------------------------------------------------------
// CSRF — client-side helpers
// ---------------------------------------------------------------------------
//
// Forms running in the browser need to read the `pluck-csrf` cookie
// and add it to the `x-csrf-token` header of every mutating fetch
// call. The cookie is non-httpOnly specifically so this read works.
//
// This module is browser-only — it accesses `document.cookie`. Server
// code should import the companion `csrf.ts` instead.
// ---------------------------------------------------------------------------

import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "./csrf";

/**
 * Read the current CSRF token from `document.cookie`. Returns null
 * when the cookie hasn't been set yet (e.g. on first visit before
 * middleware ran, or when JS reads cookies before the response with
 * the Set-Cookie header lands).
 */
export function csrfTokenFromDocument(): string | null {
  if (typeof document === "undefined" || typeof document.cookie !== "string") {
    return null;
  }
  for (const raw of document.cookie.split(";")) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith(`${CSRF_COOKIE_NAME}=`)) {
      continue;
    }
    const value = trimmed.slice(CSRF_COOKIE_NAME.length + 1);
    if (value.length === 0) {
      return null;
    }
    return decodeURIComponent(value);
  }
  return null;
}

/**
 * Build the headers a mutating fetch call should send. Includes the
 * CSRF header when the token is readable; falls back to omitting it
 * when not (the server returns 403 in that case so the operator sees
 * a clear "csrf token missing" message instead of silent failure).
 */
export function csrfRequestHeaders(): Record<string, string> {
  const token = csrfTokenFromDocument();
  if (token === null) {
    return {};
  }
  return { [CSRF_HEADER_NAME]: token };
}

/**
 * Convenience for fetch initializers. Spreads the standard
 * content-type header with the CSRF token when present:
 *
 *   fetch("/api/v1/runs", {
 *     method: "POST",
 *     headers: csrfJsonHeaders(),
 *     body: JSON.stringify(body),
 *   });
 */
export function csrfJsonHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    ...csrfRequestHeaders(),
  };
}
