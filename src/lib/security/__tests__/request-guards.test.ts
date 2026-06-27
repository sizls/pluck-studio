// ---------------------------------------------------------------------------
// request-guards — rateLimit verdict + header builder tests
// ---------------------------------------------------------------------------
//
// The rateLimit verdict and rateLimitHeaders helper are the seams every
// rate-limited route uses to emit `Retry-After` + `X-RateLimit-*` headers
// per IETF draft-ietf-httpapi-ratelimit-headers + RFC 7231.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetRateLimit } from "../../rate-limit.js";
import {
  ownerIdFromRequest,
  rateLimit,
  rateLimitHeaders,
} from "../request-guards.js";

beforeEach(() => {
  resetRateLimit();
});

afterEach(() => {
  resetRateLimit();
});

function newReq(ip = "203.0.113.10"): Request {
  return new Request("https://studio.pluck.run/test", {
    headers: { "x-forwarded-for": ip },
  });
}

describe("rateLimit verdict", () => {
  it("returns ok=true with remaining + reset on the first hit", () => {
    const v = rateLimit(newReq());
    expect(v.ok).toBe(true);
    expect(v.limit).toBe(10);
    expect(v.remaining).toBe(9);
    expect(v.retryAfterSeconds).toBe(0);
    expect(v.resetAtSeconds).toBeGreaterThan(0);
  });

  it("returns ok=false with positive Retry-After when the bucket fills", () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(newReq()).ok).toBe(true);
    }
    const blocked = rateLimit(newReq());
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("isolates buckets per IP", () => {
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(newReq("203.0.113.10")).ok).toBe(true);
    }
    expect(rateLimit(newReq("203.0.113.10")).ok).toBe(false);
    expect(rateLimit(newReq("198.51.100.20")).ok).toBe(true);
  });
});

describe("rateLimitHeaders builder", () => {
  it("emits X-RateLimit-* on every verdict", () => {
    const headers = rateLimitHeaders({
      ok: true,
      limit: 10,
      remaining: 7,
      resetAtSeconds: 1_700_000_060,
      retryAfterSeconds: 0,
    });
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("7");
    expect(headers["X-RateLimit-Reset"]).toBe("1700000060");
    expect(headers["Retry-After"]).toBeUndefined();
  });

  it("emits Retry-After only on a rejected verdict", () => {
    const headers = rateLimitHeaders({
      ok: false,
      limit: 10,
      remaining: 0,
      resetAtSeconds: 1_700_000_060,
      retryAfterSeconds: 42,
    });
    expect(headers["Retry-After"]).toBe("42");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
  });
});

describe("ownerIdFromRequest — IDOR foundation", () => {
  function reqWith(headers: Record<string, string>): Request {
    return new Request("https://studio.pluck.run/test", { headers });
  }

  it("returns null for an unauthenticated request", () => {
    expect(ownerIdFromRequest(reqWith({}))).toBeNull();
  });

  it("derives a stable opaque id from a Supabase auth cookie", () => {
    const req = reqWith({
      cookie: "sb-pluck-auth-token=eyJhbGciOiJIUzI1NiJ9.abc.def",
    });
    const id = ownerIdFromRequest(req);
    expect(id).not.toBeNull();
    expect(id).toMatch(/^[a-f0-9]{24}$/);
  });

  it("returns the same id for the same cookie across requests", () => {
    const req1 = reqWith({
      cookie: "sb-pluck-auth-token=eyJhbGciOiJIUzI1NiJ9.abc.def",
    });
    const req2 = reqWith({
      cookie: "sb-pluck-auth-token=eyJhbGciOiJIUzI1NiJ9.abc.def",
    });
    expect(ownerIdFromRequest(req1)).toBe(ownerIdFromRequest(req2));
  });

  it("returns different ids for different cookies (IDOR foundation)", () => {
    const userA = reqWith({
      cookie: "sb-pluck-auth-token=eyJhbGciOiJIUzI1NiJ9.aaa.bbb",
    });
    const userB = reqWith({
      cookie: "sb-pluck-auth-token=eyJhbGciOiJIUzI1NiJ9.xxx.yyy",
    });
    const idA = ownerIdFromRequest(userA);
    const idB = ownerIdFromRequest(userB);
    expect(idA).not.toBeNull();
    expect(idB).not.toBeNull();
    expect(idA).not.toBe(idB);
  });

  it("falls back to the bearer token when no cookie is present", () => {
    // vitest runs with NODE_ENV=test so bearer is allowed.
    const req = reqWith({ authorization: "Bearer dev-secret-token" });
    const id = ownerIdFromRequest(req);
    expect(id).not.toBeNull();
    expect(id).toMatch(/^[a-f0-9]{24}$/);
  });

  it("scopes cookie-derived ids vs bearer-derived ids so they cannot collide", () => {
    // Same raw secret used in both surfaces should still hash to
    // different owner ids because the seed is prefixed with the
    // surface name. Prevents an attacker from forging a session by
    // matching a token-string against a cookie-string.
    const reqCookie = reqWith({
      cookie: "sb-pluck-auth-token=shared-secret",
    });
    const reqBearer = reqWith({ authorization: "Bearer shared-secret" });
    expect(ownerIdFromRequest(reqCookie)).not.toBe(
      ownerIdFromRequest(reqBearer),
    );
  });
});
