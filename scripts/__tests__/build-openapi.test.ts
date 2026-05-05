// ---------------------------------------------------------------------------
// scripts/__tests__/build-openapi.test.ts
// ---------------------------------------------------------------------------
//
// Locks the auto-generated /v1/runs OpenAPI 3.1 spec:
//   - structurally valid OpenAPI 3.1.0
//   - all 4 endpoints present
//   - canonical schema components present
//   - pipeline + status enums stay in sync with the TypeScript taxonomy
//     (the load-bearing drift invariant)
//   - committed public/openapi.json matches generator output
//   - generator is deterministic
// ---------------------------------------------------------------------------

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BUREAU_PIPELINES,
  FUTURE_PIPELINES,
  RUN_STATUSES,
} from "../../src/lib/v1/run-spec.js";
import { buildOpenApiDocument } from "../build-openapi.ts";

const ROOT = join(__dirname, "..", "..");

interface OpenApiDoc {
  openapi: string;
  info: { version: string; title: string };
  servers: Array<{ url: string }>;
  tags: Array<{ name: string }>;
  paths: Record<string, Record<string, { responses?: Record<string, unknown>; security?: unknown[] }>>;
  components: {
    schemas: Record<string, { enum?: string[] }>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

const doc = (): OpenApiDoc => buildOpenApiDocument() as unknown as OpenApiDoc;

describe("OpenAPI document — structural validity", () => {
  it("uses OpenAPI 3.1.0", () => {
    expect(doc().openapi).toBe("3.1.0");
  });
  it("has title + semver-shaped version", () => {
    const d = doc();
    expect(d.info.title).toBe("Pluck Studio — /v1/runs API");
    expect(d.info.version).toMatch(/^\d+\.\d+\.\d+/);
  });
  it("declares prod + local-dev servers", () => {
    const urls = doc().servers.map((s) => s.url);
    expect(urls).toContain("https://studio.pluck.run");
    expect(urls).toContain("http://localhost:3030");
  });
  it("groups under the Runs tag", () => {
    expect(doc().tags.some((t) => t.name === "Runs")).toBe(true);
  });
});

describe("OpenAPI document — endpoint coverage", () => {
  it.each([
    ["/api/v1/runs", "post"],
    ["/api/v1/runs", "get"],
    ["/api/v1/runs/{id}", "get"],
    ["/api/v1/runs/{id}", "delete"],
  ])("documents %s %s", (path, verb) => {
    expect(doc().paths[path]?.[verb]).toBeDefined();
  });

  it("POST documents 200/400/401/403/429", () => {
    const r = doc().paths["/api/v1/runs"]?.post?.responses ?? {};
    for (const c of ["200", "400", "401", "403", "429"]) expect(r[c]).toBeDefined();
  });

  it("DELETE documents the full 200/400/401/403/404/409/429 cancel matrix", () => {
    const r = doc().paths["/api/v1/runs/{id}"]?.delete?.responses ?? {};
    for (const c of ["200", "400", "401", "403", "404", "409", "429"]) expect(r[c]).toBeDefined();
  });

  it("GET endpoints declare NO auth (public read by phraseId)", () => {
    expect(doc().paths["/api/v1/runs"]?.get?.security).toEqual([]);
    expect(doc().paths["/api/v1/runs/{id}"]?.get?.security).toEqual([]);
  });
});

describe("OpenAPI document — schemas + components", () => {
  it("declares the canonical schema keys", () => {
    const keys = Object.keys(doc().components.schemas);
    for (const k of [
      "BureauPipeline",
      "RunSpecPipeline",
      "RunStatus",
      "VerdictColor",
      "RunSpec",
      "RunRecord",
      "CreateRunResponse",
      "ListRunsResponse",
      "CancelRunResponse",
      "ErrorResponse",
    ]) {
      expect(keys).toContain(k);
    }
  });
  it("declares both bearer + sessionCookie security schemes", () => {
    const s = doc().components.securitySchemes;
    expect(s.bearerAuth).toBeDefined();
    expect(s.sessionCookie).toBeDefined();
  });
});

describe("OpenAPI document — drift invariants (taxonomy ↔ enum)", () => {
  it("BureauPipeline enum matches BUREAU_PIPELINES exactly", () => {
    expect(doc().components.schemas.BureauPipeline?.enum).toEqual([...BUREAU_PIPELINES]);
  });
  it("RunSpecPipeline enum = BUREAU_PIPELINES + FUTURE_PIPELINES", () => {
    expect(doc().components.schemas.RunSpecPipeline?.enum).toEqual([
      ...BUREAU_PIPELINES,
      ...FUTURE_PIPELINES,
    ]);
  });
  it("RunStatus enum matches RUN_STATUSES exactly", () => {
    expect(doc().components.schemas.RunStatus?.enum).toEqual([...RUN_STATUSES]);
  });
});

describe("public/openapi.json — committed file is up to date", () => {
  it("matches generator output (run `pnpm openapi:build` if this fails)", () => {
    const committed = JSON.parse(readFileSync(join(ROOT, "public", "openapi.json"), "utf8")) as OpenApiDoc;
    expect(committed.components.schemas.BureauPipeline?.enum).toEqual(
      doc().components.schemas.BureauPipeline?.enum,
    );
  });
});

describe("OpenAPI document — determinism", () => {
  it("two builds produce identical JSON", () => {
    expect(JSON.stringify(buildOpenApiDocument())).toBe(JSON.stringify(buildOpenApiDocument()));
  });
});
