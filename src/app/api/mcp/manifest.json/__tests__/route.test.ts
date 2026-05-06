// ---------------------------------------------------------------------------
// /api/mcp/manifest.json — contract tests
// ---------------------------------------------------------------------------
//
// Locks the public-discovery surface:
//   - 200 OK + application/json + parseable JSON
//   - Cache-Control: public, max-age=300
//   - X-Content-Type-Options: nosniff
//   - Manifest carries $schema, name, version, resources, tools,
//     prompts, auth (the seven load-bearing fields)
//   - Cross-site → 403 (CSRF defence applies even to public endpoints)
//   - Rate-limited → 429 (cheap insurance against scrape floods)
//   - No auth gate — public read, like /openapi.json
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetRateLimit } from "../../../../../lib/rate-limit.js";
import { GET } from "../route.js";

const SAME_SITE = {
  "sec-fetch-site": "same-origin",
};

function getReq(headers: Record<string, string> = SAME_SITE): Request {
  return new Request("http://localhost:3030/api/mcp/manifest.json", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  resetRateLimit();
});

afterEach(() => {
  resetRateLimit();
});

describe("GET /api/mcp/manifest.json", () => {
  it("returns 200 with application/json content-type", async () => {
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  });

  it("sets Cache-Control: public, max-age=300", async () => {
    const res = await GET(getReq());
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const res = await GET(getReq());
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("body parses as JSON with the seven load-bearing fields", async () => {
    const res = await GET(getReq());
    const body = (await res.json()) as Record<string, unknown>;

    expect(body.$schema).toBeDefined();
    expect(body.name).toBe("pluck-studio");
    expect(typeof body.version).toBe("string");
    expect(Array.isArray(body.resources)).toBe(true);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(Array.isArray(body.prompts)).toBe(true);
    expect(typeof body.auth).toBe("object");
  });

  it("manifest tools include pluck.search, pluck.diff, pluck.run", async () => {
    const res = await GET(getReq());
    const body = (await res.json()) as { tools: Array<{ name: string }> };
    const names = body.tools.map((t) => t.name);

    expect(names).toContain("pluck.search");
    expect(names).toContain("pluck.diff");
    expect(names).toContain("pluck.run");
  });

  it("rejects cross-site GETs with 403 (CSRF defence)", async () => {
    const res = await GET(getReq({ "sec-fetch-site": "cross-site" }));
    expect(res.status).toBe(403);
  });

  it("returns 429 when rate-limited", async () => {
    // Burn through the per-IP+session bucket. The shared rate-limit
    // module caps at 10 same-site requests per minute (matches the
    // /v1/runs and /openapi.json posture). Twelve hits guarantees we
    // trip the limit on the 11th or 12th.
    for (let i = 0; i < 11; i++) {
      await GET(getReq());
    }
    const res = await GET(getReq());
    expect(res.status).toBe(429);
  });

  it("does NOT require auth — manifest is public discovery", async () => {
    // No authorization header, no cookie. Should still return 200.
    const res = await GET(getReq());
    expect(res.status).toBe(200);
  });
});
