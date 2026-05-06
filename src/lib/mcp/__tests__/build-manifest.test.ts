// ---------------------------------------------------------------------------
// build-manifest — unit + invariant tests
// ---------------------------------------------------------------------------
//
// The Studio MCP discovery document is a public contract — once
// `pluck://program/<slug>` URIs ship, every external MCP client binds
// to them. These tests lock:
//
//   - Determinism: same opts → byte-identical manifest (snapshot).
//   - Coverage: every ACTIVE_PROGRAMS entry has a matching resource.
//   - Tools: pluck.search, pluck.diff, pluck.run all present.
//   - Tools: the pluck.run pipeline enum tracks BUREAU_PIPELINES.
//   - Tools: every inputSchema compiles under a real JSON-Schema
//     validator (ajv) and accepts the SHAPES it's meant to. Catches
//     typos that would otherwise slip past visual review.
//   - Auth: non-empty (operators MUST know how to authenticate).
//
// Adding a new Bureau program means the snapshot rebases; the
// per-slug invariant catches drift even if you forget to rebase.
// ---------------------------------------------------------------------------

import Ajv from "ajv";
import { describe, expect, it } from "vitest";

import { ACTIVE_PROGRAMS } from "../../programs/registry";
import { BUREAU_PIPELINES, RUN_STATUSES } from "../../v1/run-spec";
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

  it("declares specReference (MCP homepage, NOT a schema URL)", () => {
    const m = buildManifest(OPTS);

    // NOT https://modelcontextprotocol.io/schemas/... — that path
    // doesn't resolve. MCP is a JSON-RPC runtime protocol; it
    // doesn't ship a static manifest schema. We link the homepage
    // so consumers can find the bridge docs.
    expect(m.specReference).toBe("https://modelcontextprotocol.io");
    expect(m).not.toHaveProperty("$schema");
    expect(m.name).toBe("pluck-studio");
    expect(m.version).toBe("0.1.1");
  });

  it("description frames the document as Studio-invented discovery, not MCP-spec", () => {
    const m = buildManifest(OPTS);

    expect(m.description).toMatch(/Studio MCP discovery document/);
    expect(m.description).toMatch(/@sizls\/pluck-mcp/);
    expect(m.description).toMatch(/JSON-RPC runtime protocol/);
  });

  it("homepage + openapi URLs derive from baseUrl", () => {
    const m = buildManifest(OPTS);

    expect(m.homepage).toBe("https://studio.pluck.run");
    expect(m.openapi).toBe("https://studio.pluck.run/openapi.json");
  });

  it("baseUrl is honoured when overridden (local dev / preview)", () => {
    const local = buildManifest({
      baseUrl: "http://localhost:3030",
      version: "0.1.1",
    });

    expect(local.homepage).toBe("http://localhost:3030");
    expect(local.openapi).toBe("http://localhost:3030/openapi.json");
  });
});

describe("buildManifest — resources", () => {
  it("includes the well-known cross-program URIs", () => {
    const m = buildManifest(OPTS);
    const uris = m.resources.map((r) => r.uri);

    expect(uris).toContain("pluck://run/{id}");
    expect(uris).toContain("pluck://runs/recent");
    expect(uris).toContain("pluck://vendor/{slug}");
    expect(uris).toContain("pluck://today");
    expect(uris).toContain("pluck://phrase/{id}");
    expect(uris).toContain("pluck://diff/{base}/{target}");
  });

  it("resource count = N(cross-program) + N(programs)", () => {
    const m = buildManifest(OPTS);

    // 6 cross-program URIs (run, runs/recent, vendor, today, phrase, diff)
    // + 1 per ACTIVE_PROGRAMS entry.
    const expected = 6 + ACTIVE_PROGRAMS.length;
    expect(m.resources.length).toBe(expected);
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
  it("declares the five canonical pluck.* tools", () => {
    const m = buildManifest(OPTS);
    const names = m.tools.map((t) => t.name);

    expect(names).toContain("pluck.search");
    expect(names).toContain("pluck.diff");
    expect(names).toContain("pluck.run");
    expect(names).toContain("pluck.list");
    expect(names).toContain("pluck.get");
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

  it("pluck.list input-schema status enum matches RUN_STATUSES exactly", () => {
    const m = buildManifest(OPTS);
    const list = m.tools.find((t) => t.name === "pluck.list");
    const props = list?.inputSchema.properties as
      | Record<string, { enum?: unknown[] }>
      | undefined;

    expect(props?.pipeline?.enum).toEqual([...BUREAU_PIPELINES]);
    expect(props?.status?.enum).toEqual([...RUN_STATUSES]);
  });

  it("every tool's inputSchema is a JSON-Schema object with additionalProperties:false", () => {
    const m = buildManifest(OPTS);

    for (const tool of m.tools) {
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.additionalProperties).toBe(false);
      // `required` is optional (pluck.list has no required fields), but
      // when present must be a non-empty array.
      if ("required" in tool.inputSchema) {
        expect(Array.isArray(tool.inputSchema.required)).toBe(true);
        expect(
          (tool.inputSchema.required as unknown[]).length,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("buildManifest — tools/inputSchema (ajv compile + accept)", () => {
  // `strict: false` lets ajv tolerate JSON-Schema-draft-2020-12 quirks
  // we don't need to police here (the goal is catching typos, not
  // enforcing a particular dialect).
  const ajv = new Ajv({ strict: false, allErrors: true });

  it("compiles every tool's inputSchema cleanly", () => {
    const m = buildManifest(OPTS);

    for (const tool of m.tools) {
      // Throwing here means the schema has a structural typo.
      expect(() => ajv.compile(tool.inputSchema)).not.toThrow();
    }
  });

  it("pluck.search accepts a phraseId-only payload + rejects unknown keys", () => {
    const m = buildManifest(OPTS);
    const search = m.tools.find((t) => t.name === "pluck.search");
    expect(search).toBeDefined();
    const validate = ajv.compile(search!.inputSchema);

    expect(validate({ phraseId: "openai-swift-falcon-3742" })).toBe(true);
    expect(validate({ phraseId: "openai-swift-falcon-3742", limit: 10 })).toBe(
      true,
    );
    expect(validate({})).toBe(false); // missing required phraseId
    expect(validate({ phraseId: "x", unknownField: 1 })).toBe(false);
    expect(validate({ phraseId: "x", limit: 0 })).toBe(false); // < minimum
    expect(validate({ phraseId: "x", limit: 1000 })).toBe(false); // > maximum
  });

  it("pluck.diff accepts both phrase IDs + rejects partial payloads", () => {
    const m = buildManifest(OPTS);
    const diff = m.tools.find((t) => t.name === "pluck.diff");
    expect(diff).toBeDefined();
    const validate = ajv.compile(diff!.inputSchema);

    expect(
      validate({
        basePhraseId: "openai-swift-falcon-3742",
        sincePhraseId: "openai-swift-falcon-9999",
      }),
    ).toBe(true);
    expect(validate({ basePhraseId: "x" })).toBe(false); // missing sincePhraseId
    expect(validate({ sincePhraseId: "x" })).toBe(false); // missing basePhraseId
    expect(validate({})).toBe(false);
  });

  it("pluck.run enum matches BUREAU_PIPELINES and accepts every pipeline", () => {
    const m = buildManifest(OPTS);
    const run = m.tools.find((t) => t.name === "pluck.run");
    expect(run).toBeDefined();
    const validate = ajv.compile(run!.inputSchema);

    // Every BUREAU_PIPELINES value MUST be acceptable to the schema —
    // proves the enum literal in the manifest matches the runtime
    // taxonomy used by the pipeline validators.
    for (const pipeline of BUREAU_PIPELINES) {
      expect(validate({ pipeline, payload: {} })).toBe(true);
    }

    expect(validate({ pipeline: "bureau:not-a-real-program", payload: {} })).toBe(
      false,
    );
    expect(validate({ pipeline: "bureau:dragnet" })).toBe(false); // missing payload
    expect(validate({ payload: {} })).toBe(false); // missing pipeline
    expect(
      validate({
        pipeline: "bureau:dragnet",
        payload: {},
        idempotencyKey: "abc",
      }),
    ).toBe(true);
  });

  it("pluck.list accepts an empty payload + every filter combination", () => {
    const m = buildManifest(OPTS);
    const list = m.tools.find((t) => t.name === "pluck.list");
    expect(list).toBeDefined();
    const validate = ajv.compile(list!.inputSchema);

    // No filters — fetches the most recent runs across all programs.
    expect(validate({})).toBe(true);

    // Each filter independently.
    expect(validate({ pipeline: "bureau:dragnet" })).toBe(true);
    expect(validate({ since: "2026-05-04T00:00:00Z" })).toBe(true);
    expect(validate({ limit: 25 })).toBe(true);
    expect(validate({ cursor: "opaque-cursor-abc" })).toBe(true);
    expect(validate({ status: "anchored" })).toBe(true);

    // All filters at once.
    expect(
      validate({
        pipeline: "bureau:oath",
        since: "2026-01-01T00:00:00Z",
        limit: 10,
        cursor: "abc",
        status: "running",
      }),
    ).toBe(true);

    // Every RUN_STATUSES value MUST be acceptable.
    for (const status of RUN_STATUSES) {
      expect(validate({ status })).toBe(true);
    }

    // Every BUREAU_PIPELINES value MUST be acceptable.
    for (const pipeline of BUREAU_PIPELINES) {
      expect(validate({ pipeline })).toBe(true);
    }

    // Reject bogus inputs.
    expect(validate({ unknownField: 1 })).toBe(false);
    expect(validate({ pipeline: "bureau:not-a-real-program" })).toBe(false);
    expect(validate({ status: "not-a-status" })).toBe(false);
    expect(validate({ limit: 0 })).toBe(false); // < minimum
    expect(validate({ limit: 1000 })).toBe(false); // > maximum
    expect(validate({ limit: 1.5 })).toBe(false); // non-integer
  });

  it("pluck.get requires phraseId and rejects everything else", () => {
    const m = buildManifest(OPTS);
    const get = m.tools.find((t) => t.name === "pluck.get");
    expect(get).toBeDefined();
    const validate = ajv.compile(get!.inputSchema);

    expect(validate({ phraseId: "openai-swift-falcon-3742" })).toBe(true);
    expect(validate({})).toBe(false); // missing required phraseId
    expect(validate({ phraseId: "" })).toBe(false); // < minLength
    expect(validate({ phraseId: "x".repeat(129) })).toBe(false); // > maxLength
    expect(validate({ phraseId: "x", unknownField: 1 })).toBe(false);
    expect(validate({ phraseId: 42 })).toBe(false); // wrong type
  });
});

describe("buildManifest — prompts + auth", () => {
  it("declares the canonical prompt names", () => {
    const m = buildManifest(OPTS);
    const names = m.prompts.map((p) => p.name);

    expect(names).toContain("pluck.investigate-vendor");
    expect(names).toContain("pluck.verify-claim");
    expect(names).toContain("pluck.compare-cycles");
  });

  it("auth section is non-empty and names the bearer env", () => {
    const m = buildManifest(OPTS);

    expect(m.auth.type.length).toBeGreaterThan(0);
    expect(m.auth.bearerEnv).toBe("PLUCK_STUDIO_TOKEN");
    expect(m.auth.note.length).toBeGreaterThan(0);
    expect((m.auth as { cookieName?: string }).cookieName).toBeUndefined();
  });
});
