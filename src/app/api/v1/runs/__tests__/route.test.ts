// ---------------------------------------------------------------------------
// /api/v1/runs — contract tests
// ---------------------------------------------------------------------------
//
// Locks the unified-pipeline-activation contract:
//   - 403 on cross-site POSTs and GETs
//   - 401 on POST without a Supabase session cookie or Bearer token
//     (GET is public read by phraseId — same-site + rate-limit only)
//   - 400 on missing/invalid pipeline, missing payload, malformed JSON
//   - 400 with "documented but not yet implemented" on extract/sense/act/fleet
//   - 200 + { runId, receiptUrl, status, reused } on POST success
//   - 200 + RunRecord shape on GET by id (no auth required — the phraseId
//     in the URL IS the share credential)
//   - 404 on GET for unknown id
//   - Idempotency end-to-end: same idempotencyKey returns reused=true
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../lib/rate-limit.js";
import type { RunRecord } from "../../../../../lib/v1/run-spec.js";
import { __resetForTests } from "../../../../../lib/v1/run-store.js";
import { GET } from "../[id]/route.js";
import { POST } from "../route.js";

interface PostSuccessBody {
  runId: string;
  receiptUrl: string;
  status: string;
  reused: boolean;
}

const SAME_SITE = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
};

const SAME_SITE_AUTHED = {
  ...SAME_SITE,
  authorization: "Bearer dev-test-jwt",
};

function postReq(body: unknown, headers: Record<string, string> = SAME_SITE_AUTHED): Request {
  return new Request("http://localhost:3030/api/v1/runs", {
    method: "POST",
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

function getReq(headers: Record<string, string> = SAME_SITE_AUTHED): Request {
  return new Request("http://localhost:3030/api/v1/runs/x", {
    method: "GET",
    headers,
  });
}

function validBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    pipeline: "bureau:dragnet",
    payload: {
      targetUrl: "https://api.openai.com/v1/chat/completions",
      probePackId: "canon-honesty",
      cadence: "once",
      authorizationAcknowledged: true,
    },
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

describe("POST /api/v1/runs — auth + same-site", () => {
  it("rejects cross-site POSTs with 403", async () => {
    const res = await POST(
      postReq(validBody(), {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer dev",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated POSTs with 401", async () => {
    const res = await POST(postReq(validBody(), SAME_SITE));
    expect(res.status).toBe(401);
  });

  it("401 carries a pipeline-aware signInUrl when the body names a bureau pipeline", async () => {
    const res = await POST(postReq(validBody(), SAME_SITE));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { signInUrl: string };
    expect(body.signInUrl).toBe("/sign-in?redirect=/bureau/dragnet/run");
  });

  it("401 falls back to /bureau when the body doesn't name a known bureau pipeline", async () => {
    const res = await POST(postReq({ pipeline: "extract", payload: {} }, SAME_SITE));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { signInUrl: string };
    expect(body.signInUrl).toBe("/sign-in?redirect=/bureau");
  });

  it("accepts same-site authed POST", async () => {
    const res = await POST(postReq(validBody()));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v1/runs — body shape", () => {
  it("400 on malformed JSON", async () => {
    const res = await POST(postReq("{not json"));
    expect(res.status).toBe(400);
  });

  it("400 on missing pipeline", async () => {
    const res = await POST(postReq({ payload: {} }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/pipeline/);
  });

  it("400 on unknown pipeline", async () => {
    const res = await POST(
      postReq({ pipeline: "bureau:made-up", payload: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("400 on missing payload", async () => {
    const res = await POST(postReq({ pipeline: "bureau:dragnet" }));
    expect(res.status).toBe(400);
  });

  it("400 on payload that is an array, not an object", async () => {
    const res = await POST(
      postReq({ pipeline: "bureau:dragnet", payload: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("400 with documented-but-future message on extract pipeline", async () => {
    const res = await POST(postReq({ pipeline: "extract", payload: {} }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/documented but not yet implemented/);
  });

  it("400 with documented-but-future message on sense", async () => {
    const res = await POST(postReq({ pipeline: "sense", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("400 with documented-but-future message on act", async () => {
    const res = await POST(postReq({ pipeline: "act", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("400 with documented-but-future message on fleet", async () => {
    const res = await POST(postReq({ pipeline: "fleet", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("400 on idempotencyKey that's not a string", async () => {
    const res = await POST(postReq(validBody({ idempotencyKey: 12 })));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/runs — success shape", () => {
  it("returns runId, receiptUrl, status=pending, reused=false", async () => {
    const res = await POST(postReq(validBody()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/dragnet/runs/${body.runId}`);
    expect(body.status).toBe("pending");
    expect(body.reused).toBe(false);
  });
});

describe("POST /api/v1/runs — idempotency end-to-end", () => {
  it("same idempotencyKey returns the same runId with reused=true", async () => {
    const r1 = (await (await POST(postReq(validBody({ idempotencyKey: "k1" })))).json()) as PostSuccessBody;
    const r2 = (await (await POST(postReq(validBody({ idempotencyKey: "k1" })))).json()) as PostSuccessBody;
    expect(r2.runId).toBe(r1.runId);
    expect(r2.reused).toBe(true);
  });

  it("different idempotencyKey produces different runId", async () => {
    const r1 = (await (await POST(postReq(validBody({ idempotencyKey: "k1" })))).json()) as PostSuccessBody;
    const r2 = (await (await POST(postReq(validBody({ idempotencyKey: "k2" })))).json()) as PostSuccessBody;
    expect(r1.runId).not.toBe(r2.runId);
  });
});

describe("GET /api/v1/runs/[id]", () => {
  async function postAndGetId(): Promise<string> {
    const r = (await (await POST(postReq(validBody()))).json()) as PostSuccessBody;
    return r.runId;
  }

  it("404s on unknown id", async () => {
    const res = await GET(getReq(), {
      params: Promise.resolve({ id: "nope-nope-nope-0000" }),
    });
    expect(res.status).toBe(404);
  });

  it("200s on a valid id and echoes the full RunRecord", async () => {
    const id = await postAndGetId();
    const res = await GET(getReq(), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunRecord;
    expect(body.runId).toBe(id);
    expect(body.pipeline).toBe("bureau:dragnet");
    expect(body.status).toBe("pending");
    expect(body.payload.targetUrl).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("403s cross-site GETs", async () => {
    const id = await postAndGetId();
    const res = await GET(
      getReq({
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer dev",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(403);
  });

  it("200s unauthed GETs — receipts are public reads keyed by phraseId", async () => {
    const id = await postAndGetId();
    const res = await GET(getReq(SAME_SITE), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunRecord;
    expect(body.runId).toBe(id);
  });

  it("400 on absurdly long id", async () => {
    const res = await GET(getReq(), {
      params: Promise.resolve({ id: "x".repeat(200) }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/runs — per-pipeline payload validation (M1 fix)", () => {
  it("rejects DRAGNET payload pointing at localhost (private IP block)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "http://localhost:8080/",
          probePackId: "canon-honesty",
          cadence: "once",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/localhost.*private.*link-local/);
  });

  it("rejects DRAGNET payload with a javascript: scheme", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "javascript:alert(1)",
          probePackId: "canon-honesty",
          cadence: "once",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/http:\/\/ or https:\/\//);
  });

  it("rejects DRAGNET payload with an unknown probe-pack id", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "https://api.openai.com/v1/chat/completions",
          probePackId: "canon-honestly",
          cadence: "once",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Unknown probe-pack/);
  });

  it("rejects DRAGNET payload missing authorizationAcknowledged", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "https://api.openai.com/v1/chat/completions",
          probePackId: "canon-honesty",
          cadence: "once",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authorized to probe/);
  });

  it("rejects unknown top-level keys in the envelope", async () => {
    const res = await POST(postReq(validBody({ surprise: "extra" })));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unexpected top-level key: surprise/);
  });
});

describe("POST /api/v1/runs — bureau pipelines without targetUrl", () => {
  it("accepts bureau:custody with an empty payload (slug-prefixed runId)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:custody",
        payload: { incidentTitle: "test-incident" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^custody-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/custody/runs/${body.runId}`);
  });
});

describe("POST /api/v1/runs — rate limit", () => {
  it("429s after the per-window threshold", async () => {
    const headers = {
      ...SAME_SITE_AUTHED,
      "x-forwarded-for": "203.0.113.77",
    };
    for (let i = 0; i < 10; i++) {
      const res = await POST(postReq(validBody(), headers));
      expect(res.status).toBe(200);
    }
    const overflow = await POST(postReq(validBody(), headers));
    expect(overflow.status).toBe(429);
  });
});
