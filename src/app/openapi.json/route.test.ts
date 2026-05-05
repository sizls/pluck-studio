// ---------------------------------------------------------------------------
// /openapi.json route — contract test
// ---------------------------------------------------------------------------
//
// Locks the public surface:
//   - 200 OK
//   - Content-Type: application/json
//   - Cache-Control: public, max-age=300 (matches the spec's stale-while
//     -deployed contract; bump if you change `revalidate` in route.ts)
//   - Body parses as JSON and reports openapi: "3.1.0"
//   - Body declares all 4 endpoints (lightweight smoke — the deep
//     structural invariants live in scripts/__tests__/build-openapi.test.ts)
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { GET } from "./route.js";

interface OpenApiBody {
  openapi: string;
  paths: Record<string, Record<string, unknown>>;
}

describe("GET /openapi.json", () => {
  it("returns 200 with application/json content-type", async () => {
    const res = GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
  });

  it("sets Cache-Control: public, max-age=300", async () => {
    const res = GET();
    expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("body parses as a valid OpenAPI 3.1.0 document", async () => {
    const res = GET();
    const body = (await res.json()) as OpenApiBody;
    expect(body.openapi).toBe("3.1.0");
  });

  it("body documents all 4 /v1/runs endpoints", async () => {
    const res = GET();
    const body = (await res.json()) as OpenApiBody;
    expect(body.paths["/api/v1/runs"]?.post).toBeDefined();
    expect(body.paths["/api/v1/runs"]?.get).toBeDefined();
    expect(body.paths["/api/v1/runs/{id}"]?.get).toBeDefined();
    expect(body.paths["/api/v1/runs/{id}"]?.delete).toBeDefined();
  });
});
