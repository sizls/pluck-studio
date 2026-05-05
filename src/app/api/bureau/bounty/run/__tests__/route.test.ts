// ---------------------------------------------------------------------------
// POST /api/bureau/bounty/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-3 migration: the legacy route now delegates to the shared
// `validateBountyPayload` and dual-writes into the v1 store. These tests
// lock the new contract:
//   - runId === phraseId, target-platform-scoped phrase
//   - PRIVACY INVARIANT: auth-token-shaped keys are REJECTED on the wire;
//     response NEVER carries Bearer / *_TOKEN strings
//   - RFC 8594 Deprecation/Sunset/Link headers
//   - Idempotency dedupe within the minute bucket
//   - Cross-route convergence with /v1/runs
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { __resetForTests } from "../../../../../../lib/v1/run-store.js";
import { POST } from "../route.js";
import { POST as POST_V1 } from "../../../../v1/runs/route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  target: string;
  program: string;
  vendor: string;
  model: string;
  sourceRekorUuid: string;
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/bounty/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    sourceRekorUuid: "a".repeat(64),
    target: "hackerone",
    program: "openai",
    vendor: "openai",
    model: "gpt-4o",
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

describe("POST /api/bureau/bounty/run — validation", () => {
  it("rejects missing source uuid", async () => {
    const r = await POST(buildRequest(valid({ sourceRekorUuid: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects malformed source uuid", async () => {
    const r = await POST(buildRequest(valid({ sourceRekorUuid: "not-hex" })));
    expect(r.status).toBe(400);
  });

  it("rejects unknown target", async () => {
    const r = await POST(buildRequest(valid({ target: "intigriti" })));
    expect(r.status).toBe(400);
  });

  it("rejects program with dots", async () => {
    const r = await POST(buildRequest(valid({ program: "openai.com" })));
    expect(r.status).toBe(400);
  });

  it("rejects oversized model slug", async () => {
    const r = await POST(buildRequest(valid({ model: "a".repeat(65) })));
    expect(r.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/bounty/run — privacy invariant (auth tokens REJECTED)", () => {
  it("rejects payload carrying a Bearer-shaped key (defense-in-depth)", async () => {
    const r = await POST(buildRequest(valid({ Bearer: "tok_abc123" })));
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: string };
    expect(body.error).toMatch(/auth-token-shaped/i);
  });

  it("rejects payload carrying a *_TOKEN key (defense-in-depth)", async () => {
    const r = await POST(buildRequest(valid({ H1_TOKEN: "tok_secret" })));
    expect(r.status).toBe(400);
  });

  it("rejects payload carrying a BUGCROWD_TOKEN", async () => {
    const r = await POST(buildRequest(valid({ BUGCROWD_TOKEN: "tok_secret" })));
    expect(r.status).toBe(400);
  });

  it("rejects payload carrying a generic *_API_KEY", async () => {
    const r = await POST(buildRequest(valid({ API_KEY: "tok_secret" })));
    expect(r.status).toBe(400);
  });

  it("does NOT leak any auth-token-shaped string in the response", async () => {
    const r = await POST(buildRequest(valid()));
    const text = await r.text();
    expect(text).not.toMatch(/Bearer/);
    expect(text).not.toMatch(/H1_TOKEN/);
    expect(text).not.toMatch(/BUGCROWD_TOKEN/);
  });
});

describe("POST /api/bureau/bounty/run — success", () => {
  it("returns target-scoped phrase ID; runId === phraseId post-migration", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const body = (await r.json()) as SuccessBody;
    expect(body.runId).toBe(body.phraseId);
    expect(body.phraseId).toMatch(/^hackerone-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.target).toBe("hackerone");
    expect(body.program).toBe("openai");
    expect(body.vendor).toBe("openai");
    expect(body.model).toBe("gpt-4o");
    expect(body.status).toBe("filing pending");
  });

  it("phrase prefix tracks the target platform", async () => {
    const r = await POST(buildRequest(valid({ target: "bugcrowd" })));
    expect(r.status).toBe(200);
    const body = (await r.json()) as SuccessBody;
    expect(body.phraseId).toMatch(/^bugcrowd-[a-z]+-[a-z]+-\d{4}$/);
  });
});

describe("POST /api/bureau/bounty/run — RFC 8594 deprecation signaling", () => {
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

describe("POST /api/bureau/bounty/run — idempotency dedupe", () => {
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
        pipeline: "bureau:bounty",
        payload: {
          sourceRekorUuid: "a".repeat(64),
          target: "hackerone",
          program: "openai",
          vendor: "openai",
          model: "gpt-4o",
          authorizationAcknowledged: true,
        },
        idempotencyKey: `bounty:hackerone:openai:${"a".repeat(64)}:${minuteBucket}`,
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
