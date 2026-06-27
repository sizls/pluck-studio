// ---------------------------------------------------------------------------
// Next.js middleware — issues the CSRF cookie on first page load
// ---------------------------------------------------------------------------
//
// Runs on every page navigation that isn't `/api/*` or a static
// asset. If the request doesn't already carry the `pluck-csrf`
// cookie, generate a fresh token and stamp it onto the response.
//
// The cookie is `SameSite=Lax` + 24h max-age + non-httpOnly so the
// client-side form helpers (`csrfJsonHeaders()`) can read it back
// and submit it as the `x-csrf-token` header on every mutating
// fetch call. Server routes verify the cookie/header pair via
// `verifyCsrfToken()`.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import {
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_HEX_LENGTH,
  generateCsrfToken,
} from "./lib/security/csrf";

export function middleware(req: NextRequest): NextResponse {
  const response = NextResponse.next();
  const existing = req.cookies.get(CSRF_COOKIE_NAME)?.value;
  const valid =
    existing !== undefined &&
    existing.length === CSRF_TOKEN_HEX_LENGTH &&
    /^[a-f0-9]+$/i.test(existing);
  if (!valid) {
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: generateCsrfToken(),
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 86400,
      // httpOnly intentionally false so client JS can read it and
      // submit the matching header on mutating fetches.
      httpOnly: false,
    });
  }
  return response;
}

/**
 * Run the middleware on every page request EXCEPT the API surface
 * (which doesn't need to issue cookies — it just validates them) and
 * the Next.js internals.
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon|robots\\.txt).*)"],
};
