// ---------------------------------------------------------------------------
// build-manifest — unit + invariant tests
// ---------------------------------------------------------------------------
//
// The MCP manifest is a public contract — once `pluck://program/<slug>`
// URIs ship, every external MCP client binds to them. These tests lock:
//
//   - Determinism: same opts → byte-identical manifest (snapshot).
//   - Coverage: every ACTIVE_PROGRAMS entry has a matching resource.
//   - Tools: pluck.search, pluck.diff, pluck.run all present.
//   - Tools: the pluck.run pipeline enum tracks BUREAU_PIPELINES.
//   - Auth: non-empty (operators MUST know how to authenticate).
//
// Adding a new Bureau program means the snapshot rebases; the
// per-slug invariant catches drift even if you forget to rebase.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { ACTIVE_PROGRAMS } from "../../programs/registry";
import { BUREAU_PIPELINES } from "../../v1/run-spec";
import { buildManifest } from "../build-manifest";

const OPTS = {
  baseUrl: "https://studio.pluck.run",
  version: "0.1.1",
} as const;

describe("buildManifest", () => {
  it("is deterministic — same opts produce byte-identical output", () => {
    const a = buildManifest(OPTS);
    const b = buildManifest(OPTS);

    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("matches the manifest snapshot", () => {
    expect(buildManifest(OPTS)).toMatchSnapshot();
  });

  it("declares the MCP $schema URL", () => {
    const m = buildManifest(OPTS);

    expect(m.$schema).toBe(
      "https://modelcontextprotocol.io/schemas/manifest/v0.1.json",
    );
    expect(m.name).toBe("pluck-studio");
    expect(m.version).toBe("0.1.1");
  });

  it("homepage + openapi URLs derive from baseUrl", () => {
    const m = buildManifest(OPTS);

    expect(m.homepage).toBe("https://studio.pluck.run");
    expect(m.openapi).toBe("https://studio.pluck.run/openapi.json");
  });
});

describe("buildManifest — resources", () => {
  it("includes the four well-known cross-program URIs", () => {
    const m = buildManifest(OPTS);
    const uris = m.resources.map((r) => r.uri);

    expect(uris).toContain("pluck://run/{id}");
    expect(uris).toContain("pluck://runs/recent");
    expect(uris).toContain("pluck://vendor/{slug}");
    expect(uris).toContain("pluck://today");
  });

  it("includes a pluck://program/<slug> resource for every ACTIVE_PROGRAMS entry", () => {
    const m = buildManifest(OPTS);
    const uris = new Set(m.resources.map((r) => r.uri));

    for (const program of ACTIVE_PROGRAMS) {
      expect(uris.has(`pluck://program/${program.slug}`)).toBe(true);
    }
  });

  it("DSSE-mime is used for the signed-receipt resource", () => {
    const m = buildManifest(OPTS);
    const run = m.resources.find((r) => r.uri === "pluck://run/{id}");

    expect(run).toBeDefined();
    expect(run?.mimeType).toBe("application/vnd.in-toto+dsse+json");
  });

  it("every resource carries a non-empty name + description + mimeType", () => {
    const m = buildManifest(OPTS);

    for (const r of m.resources) {
      expect(r.uri.startsWith("pluck://")).toBe(true);
      expect(r.name.length).toBeGreaterThan(0);
      expect(r.description.length).toBeGreaterThan(0);
      expect(r.mimeType.length).toBeGreaterThan(0);
    }
  });
});

describe("buildManifest — tools", () => {
  it("declares pluck.search, pluck.diff, pluck.run", () => {
    const m = buildManifest(OPTS);
    const names = m.tools.map((t) => t.name);

    expect(names).toContain("pluck.search");
    expect(names).toContain("pluck.diff");
    expect(names).toContain("pluck.run");
  });

  it("pluck.run input-schema enum matches BUREAU_PIPELINES exactly", () => {
    const m = buildManifest(OPTS);
    const run = m.tools.find((t) => t.name === "pluck.run");
    const props = run?.inputSchema.properties as
      | Record<string, { enum?: unknown[] }>
      | undefined;
    const pipelineEnum = props?.pipeline?.enum;

    expect(Array.isArray(pipelineEnum)).toBe(true);
    expect(pipelineEnum).toEqual([...BUREAU_PIPELINES]);
  });

  it("every tool has a JSON-Schema input shape with required[]", () => {
    const m = buildManifest(OPTS);

    for (const tool of m.tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(Array.isArray(tool.inputSchema.required)).toBe(true);
      expect((tool.inputSchema.required as unknown[]).length).toBeGreaterThan(0);
    }
  });
});

describe("buildManifest — prompts + auth", () => {
  it("declares the canonical prompt names", () => {
    const m = buildManifest(OPTS);
    const names = m.prompts.map((p) => p.name);

    expect(names).toContain("pluck.investigate-vendor");
    expect(names).toContain("pluck.verify-claim");
  });

  it("auth section is non-empty and names the bearer env + cookie", () => {
    const m = buildManifest(OPTS);

    expect(m.auth.type.length).toBeGreaterThan(0);
    expect(m.auth.bearerEnv).toBe("PLUCK_STUDIO_TOKEN");
    expect(m.auth.cookieName.length).toBeGreaterThan(0);
    expect(m.auth.note.length).toBeGreaterThan(0);
  });
});
