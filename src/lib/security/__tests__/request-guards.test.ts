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
import { rateLimit, rateLimitHeaders } from "../request-guards.js";

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
