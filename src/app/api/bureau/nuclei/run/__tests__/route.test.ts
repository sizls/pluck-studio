import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { __resetForTests } from "../../../../../../lib/v1/run-store.js";
import { POST } from "../route.js";
import { POST as POST_V1 } from "../../../../v1/runs/route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  author: string;
  packName: string;
  sbomRekorUuid: string;
  vendorScope: string[];
  license: string;
  recommendedInterval: string;
  status: string;
  pendingVerdict?: "published" | "published-ingested-only";
  pendingTrustTier?: "verified" | "ingested";
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/nuclei/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    author: "alice",
    packName: "canon-honesty@0.1",
    sbomRekorUuid: "a".repeat(64),
    vendorScope: "openai/gpt-4o,anthropic/claude-3-5-sonnet",
    license: "MIT",
    recommendedInterval: "0 */4 * * *",
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

describe("POST /api/bureau/nuclei/run — TOFU enforcement", () => {
  it("rejects missing sbomRekorUuid (TOFU violation)", async () => {
    const r = await POST(buildRequest(valid({ sbomRekorUuid: "" })));
    expect(r.status).toBe(400);
    const b = (await r.json()) as { error: string };
    expect(b.error).toMatch(/SBOM-AI cross-reference/i);
  });

  it("rejects malformed sbomRekorUuid", async () => {
    const r = await POST(buildRequest(valid({ sbomRekorUuid: "not-hex" })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/nuclei/run — validation", () => {
  it("rejects unversioned packName", async () => {
    const r = await POST(buildRequest(valid({ packName: "canon-honesty" })));
    expect(r.status).toBe(400);
  });

  it("rejects empty vendorScope", async () => {
    const r = await POST(buildRequest(valid({ vendorScope: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects vendorScope with invalid entries", async () => {
    const r = await POST(buildRequest(valid({ vendorScope: "openai/gpt-4o,foo" })));
    expect(r.status).toBe(400);
    const b = (await r.json()) as { error: string };
    expect(b.error).toMatch(/foo/);
  });

  it("rejects non-allowed license", async () => {
    const r = await POST(buildRequest(valid({ license: "WTFPL" })));
    expect(r.status).toBe(400);
  });

  it("rejects empty recommendedInterval", async () => {
    const r = await POST(buildRequest(valid({ recommendedInterval: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects oversized recommendedInterval", async () => {
    const r = await POST(buildRequest(valid({ recommendedInterval: "x".repeat(65) })));
    expect(r.status).toBe(400);
  });

  it("rejects malformed recommendedInterval (cron grammar)", async () => {
    const r = await POST(buildRequest(valid({ recommendedInterval: "not cron" })));
    expect(r.status).toBe(400);
    const b = (await r.json()) as { error: string };
    expect(b.error).toMatch(/cron/i);
  });

  it("rejects out-of-range recommendedInterval ('0 25 * * *')", async () => {
    const r = await POST(buildRequest(valid({ recommendedInterval: "0 25 * * *" })));
    expect(r.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/nuclei/run — author handle squat (AE R1 S1)", () => {
  // Codifies the known stub-era gap: until pluck-api binds NUCLEI
  // authors to authenticated user IDs, two different authenticated
  // operators can both submit author=bob and BOTH succeed. This test
  // pins current behavior so the gap can't silently change before
  // the public-registry launch fix lands. See route.ts SECURITY block.
  it("accepts the same author=bob from two consecutive submissions (squat is reproducible)", async () => {
    const r1 = await POST(buildRequest(valid({ author: "bob" })));
    expect(r1.status).toBe(200);
    const b1 = (await r1.json()) as SuccessBody;
    expect(b1.author).toBe("bob");
    expect(b1.phraseId).toMatch(/^bob-[a-z]+-[a-z]+-\d{4}$/);

    const r2 = await POST(buildRequest(valid({ author: "bob" })));
    expect(r2.status).toBe(200);
    const b2 = (await r2.json()) as SuccessBody;
    expect(b2.author).toBe("bob");
    expect(b2.phraseId).toMatch(/^bob-[a-z]+-[a-z]+-\d{4}$/);
  });
});

describe("POST /api/bureau/nuclei/run — success", () => {
  it("returns author-scoped phrase ID + parsed vendorScope array", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    // Post-migration: runId === phraseId (mirrors DRAGNET M5 unification).
    // Both are the canonical author-scoped phrase-id-shaped primitive.
    expect(b.runId).toBe(b.phraseId);
    expect(b.runId).toMatch(/^alice-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.phraseId).toMatch(/^alice-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.author).toBe("alice");
    expect(b.packName).toBe("canon-honesty@0.1");
    expect(b.vendorScope).toEqual([
      "openai/gpt-4o",
      "anthropic/claude-3-5-sonnet",
    ]);
    expect(b.status).toBe("publish pending");
  });

  it("lowercases vendor/model pairs", async () => {
    const r = await POST(buildRequest(valid({ vendorScope: "OpenAI/GPT-4o" })));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.vendorScope).toEqual(["openai/gpt-4o"]);
  });

  it("response shape carries pendingVerdict + pendingTrustTier", async () => {
    // Distinct verdict members ('published' vs 'published-ingested-only')
    // are exposed on the success response so subscribers don't have to
    // do a 2-field (verdict + trustTier) join. Phase-stub: all
    // pre-validated submissions land at 'published' until the real
    // TOFU step (against pluck-api Rekor) downgrades to ingested-only.
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.pendingVerdict).toBe("published");
    expect(b.pendingTrustTier).toBe("verified");
  });
});

describe("POST /api/bureau/nuclei/run — RFC 8594 deprecation signaling", () => {
  it("emits Deprecation, Sunset, and Link successor-version headers", async () => {
    const res = await POST(buildRequest(valid()));
    expect(res.status).toBe(200);
    expect(res.headers.get("Deprecation")).toBe("true");
    const sunset = res.headers.get("Sunset");
    expect(sunset).not.toBeNull();
    expect(Number.isFinite(Date.parse(sunset ?? ""))).toBe(true);
    expect(res.headers.get("Link")).toMatch(
      /<\/api\/v1\/runs>;\s*rel="successor-version"/,
    );
  });

  it("includes deprecated: true + replacement in the response body", async () => {
    const res = await POST(buildRequest(valid()));
    const b = (await res.json()) as SuccessBody & {
      deprecated?: boolean;
      replacement?: string;
    };
    expect(b.deprecated).toBe(true);
    expect(b.replacement).toBe("/api/v1/runs");
  });
});

describe("POST /api/bureau/nuclei/run — idempotency dedupe", () => {
  it("two same-payload posts within the minute bucket return the SAME phraseId (no ghost runs)", async () => {
    const r1 = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;
    const r2 = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;
    expect(r2.phraseId).toBe(r1.phraseId);
  });

  it("legacy callers + /v1/runs callers with the same payload converge on the SAME phraseId", async () => {
    // Cross-route dedupe — proves the synthesized key matches what the
    // RunForm sends to /v1/runs.
    const legacy = (await (
      await POST(buildRequest(valid()))
    ).json()) as SuccessBody;

    const minuteBucket = Math.floor(Date.now() / 60_000);
    const v1Body = {
      pipeline: "bureau:nuclei",
      payload: valid(),
      idempotencyKey: `nuclei:alice:canon-honesty@0.1:${"a".repeat(64)}:${minuteBucket}`,
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
  });
});
