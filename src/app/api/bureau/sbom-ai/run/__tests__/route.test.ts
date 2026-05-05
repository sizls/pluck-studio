// ---------------------------------------------------------------------------
// POST /api/bureau/sbom-ai/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-3 migration: the legacy route now delegates to the shared
// `validateSbomAiPayload` and dual-writes into the v1 store.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { __resetForTests } from "../../../../../../lib/v1/run-store.js";
import { POST } from "../route.js";
import { POST as POST_V1 } from "../../../../v1/runs/route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  artifactKind: string;
  artifactUrl: string;
  expectedSha256: string | null;
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/sbom-ai/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    artifactUrl: "https://example.com/pack.json",
    artifactKind: "probe-pack",
    authorizationAcknowledged: true,
    ...overrides,
  };
}

beforeEach(() => {
  resetRateLimit();
  __resetForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/bureau/sbom-ai/run — validation", () => {
  it("rejects missing artifactUrl", async () => {
    const r = await POST(buildRequest(valid({ artifactUrl: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects http://", async () => {
    const r = await POST(
      buildRequest(valid({ artifactUrl: "http://example.com/x" })),
    );
    expect(r.status).toBe(400);
  });

  it("rejects localhost host", async () => {
    const r = await POST(
      buildRequest(valid({ artifactUrl: "https://localhost/x" })),
    );
    expect(r.status).toBe(400);
  });

  it("rejects link-local host", async () => {
    const r = await POST(
      buildRequest(valid({ artifactUrl: "https://169.254.169.254/x" })),
    );
    expect(r.status).toBe(400);
  });

  it("rejects unknown artifactKind", async () => {
    const r = await POST(buildRequest(valid({ artifactKind: "made-up" })));
    expect(r.status).toBe(400);
  });

  it("rejects malformed expectedSha256", async () => {
    const r = await POST(buildRequest(valid({ expectedSha256: "not-hex" })));
    expect(r.status).toBe(400);
  });

  it("accepts well-formed expectedSha256", async () => {
    const r = await POST(buildRequest(valid({ expectedSha256: "a".repeat(64) })));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.expectedSha256).toBe("a".repeat(64));
  });

  it("returns null expectedSha256 when omitted", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.expectedSha256).toBeNull();
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/sbom-ai/run — success", () => {
  it("returns artifact-kind-scoped phrase ID; runId === phraseId post-migration", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toBe(b.phraseId);
    expect(b.phraseId).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.status).toBe("publish pending");
  });

  it("phrase prefix tracks the artifact kind", async () => {
    for (const kind of ["probe-pack", "model-card", "mcp-server"]) {
      __resetForTests();
      resetRateLimit();
      const r = await POST(buildRequest(valid({ artifactKind: kind })));
      expect(r.status).toBe(200);
      const b = (await r.json()) as SuccessBody;
      expect(b.phraseId).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{4}$/);
      expect(b.artifactKind).toBe(kind);
    }
  });
});

describe("POST /api/bureau/sbom-ai/run — RFC 8594 deprecation signaling", () => {
  it("emits Deprecation/Sunset/Link headers + body flags", async () => {
    const res = await POST(buildRequest(valid()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Deprecation")).toBe("true");
    expect(res.headers.get("Link")).toMatch(
      /<\/api\/v1\/runs>;\s*rel="successor-version"/,
    );
    const b = (await res.json()) as SuccessBody & {
      deprecated?: boolean;
      replacement?: string;
    };
    expect(b.deprecated).toBe(true);
    expect(b.replacement).toBe("/api/v1/runs");
  });
});

describe("POST /api/bureau/sbom-ai/run — idempotency dedupe", () => {
  it("two same-payload posts within the minute bucket return the SAME phraseId", async () => {
    const r1 = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;
    const r2 = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;
    expect(r2.phraseId).toBe(r1.phraseId);
  });

  it("legacy callers + /v1/runs callers with the same payload converge on the SAME phraseId", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:30.000Z"));
    try {
      const legacy = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const v1Body = {
        pipeline: "bureau:sbom-ai",
        payload: {
          artifactUrl: "https://example.com/pack.json",
          artifactKind: "probe-pack",
          authorizationAcknowledged: true,
        },
        idempotencyKey: `sbom-ai:probe-pack:https://example.com/pack.json:none:${minuteBucket}`,
      };
      const v1 = (await (
        await POST_V1(
          new Request("http://localhost:3030/api/v1/runs", {
            method: "POST",
            headers: HEADERS,
            body: JSON.stringify(v1Body),
          }),
        )
      ).json()) as { runId: string; reused: boolean };

      expect(v1.runId).toBe(legacy.phraseId);
      expect(v1.reused).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
