// ---------------------------------------------------------------------------
// CSRF — double-submit cookie helper tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_TOKEN_HEX_LENGTH,
  csrfSetCookie,
  csrfTokenFromCookie,
  csrfTokenFromRequest,
  generateCsrfToken,
  isCsrfSafe,
  verifyCsrfToken,
} from "../csrf.js";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://studio.pluck.run/test", { headers });
}

describe("generateCsrfToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateCsrfToken();
    expect(token).toHaveLength(CSRF_TOKEN_HEX_LENGTH);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it("never returns the same value twice in a row", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(a).not.toBe(b);
  });
});

describe("csrfSetCookie", () => {
  it("returns a Set-Cookie value with the standard flags", () => {
    const cookie = csrfSetCookie("abc");
    expect(cookie).toContain(`${CSRF_COOKIE_NAME}=abc`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=86400");
  });
});

describe("csrfTokenFromCookie", () => {
  it("returns the token when the cookie is set", () => {
    const req = reqWith({ cookie: `${CSRF_COOKIE_NAME}=abc123` });
    expect(csrfTokenFromCookie(req)).toBe("abc123");
  });

  it("returns null when the cookie is absent", () => {
    const req = reqWith({});
    expect(csrfTokenFromCookie(req)).toBeNull();
  });

  it("returns null when the cookie value is empty", () => {
    const req = reqWith({ cookie: `${CSRF_COOKIE_NAME}=` });
    expect(csrfTokenFromCookie(req)).toBeNull();
  });

  it("parses the token among other cookies", () => {
    const req = reqWith({
      cookie: `sb-pluck-auth-token=eyJabc; ${CSRF_COOKIE_NAME}=xyz789; foo=bar`,
    });
    expect(csrfTokenFromCookie(req)).toBe("xyz789");
  });
});

describe("csrfTokenFromRequest", () => {
  it("prefers the header value", () => {
    const req = reqWith({ [CSRF_HEADER_NAME]: "header-token" });
    expect(csrfTokenFromRequest(req)).toBe("header-token");
  });

  it("falls back to the body's csrfToken field", () => {
    const req = reqWith({});
    expect(csrfTokenFromRequest(req, { csrfToken: "body-token" })).toBe(
      "body-token",
    );
  });

  it("returns null when neither header nor body has the token", () => {
    const req = reqWith({});
    expect(csrfTokenFromRequest(req, { foo: "bar" })).toBeNull();
  });

  it("ignores arrays and primitives passed as body", () => {
    const req = reqWith({});
    expect(csrfTokenFromRequest(req, ["csrf"])).toBeNull();
    expect(csrfTokenFromRequest(req, "csrf-string")).toBeNull();
  });
});

describe("verifyCsrfToken", () => {
  function tokenMatcher(token: string) {
    return reqWith({
      cookie: `${CSRF_COOKIE_NAME}=${token}`,
      [CSRF_HEADER_NAME]: token,
    });
  }

  it("returns true when cookie and header match (constant-time)", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(tokenMatcher(token))).toBe(true);
  });

  it("returns false when the header is missing", () => {
    const token = generateCsrfToken();
    const req = reqWith({ cookie: `${CSRF_COOKIE_NAME}=${token}` });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it("returns false when the cookie is missing", () => {
    const token = generateCsrfToken();
    const req = reqWith({ [CSRF_HEADER_NAME]: token });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it("returns false when the tokens don't match", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    const req = reqWith({
      cookie: `${CSRF_COOKIE_NAME}=${a}`,
      [CSRF_HEADER_NAME]: b,
    });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it("rejects tokens that are not 64-char hex (attacker-planted literal)", () => {
    const req = reqWith({
      cookie: `${CSRF_COOKIE_NAME}=not-hex`,
      [CSRF_HEADER_NAME]: "not-hex",
    });
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it("rejects mismatched lengths even if both pass the hex shape", () => {
    const short = "a".repeat(32);
    const req = reqWith({
      cookie: `${CSRF_COOKIE_NAME}=${short}`,
      [CSRF_HEADER_NAME]: short,
    });
    // Both are hex but neither is the canonical 64-char length.
    expect(verifyCsrfToken(req)).toBe(false);
  });

  it("accepts the token via the body field when the header is absent", () => {
    const token = generateCsrfToken();
    const req = reqWith({ cookie: `${CSRF_COOKIE_NAME}=${token}` });
    expect(verifyCsrfToken(req, { csrfToken: token })).toBe(true);
  });
});

describe("isCsrfSafe — bearer-token bypass", () => {
  it("passes a bearer-authenticated request without any CSRF token", () => {
    const req = reqWith({ authorization: "Bearer dev-test-jwt" });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("rejects an empty bearer-prefix request (catches `Bearer ` with no token)", () => {
    const req = reqWith({ authorization: "Bearer " });
    expect(isCsrfSafe(req)).toBe(false);
  });

  it("falls through to verifyCsrfToken for cookie-authenticated requests", () => {
    const token = generateCsrfToken();
    const req = reqWith({
      cookie: `${CSRF_COOKIE_NAME}=${token}; sb-pluck-auth-token=eyJ`,
      [CSRF_HEADER_NAME]: token,
    });
    expect(isCsrfSafe(req)).toBe(true);
  });

  it("rejects a cookie-authenticated request that omits the CSRF token", () => {
    const req = reqWith({
      cookie: "sb-pluck-auth-token=eyJ",
    });
    expect(isCsrfSafe(req)).toBe(false);
  });
});
