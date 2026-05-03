// ---------------------------------------------------------------------------
// POST /api/bureau/dragnet/run — contract tests
// ---------------------------------------------------------------------------
//
// Locks the day-1 contract:
//   - 403 on cross-site requests (CSRF defence)
//   - 429 when rate limit exceeded
//   - 401 when no Supabase session cookie or Bearer token present
//     (Bearer is dev-only; production rejects bare "Bearer X")
//   - 400 on invalid JSON / missing fields / malformed URL / private IPs /
//     unknown pack ID / missing authorization acknowledgement
//   - 200 + { runId, phraseId, cadence, status: "cycle pending" } on success
//
// These are the bedrock the v1 activation flow rests on. When pluck-api
// /v1/runs lands and this handler proxies real RunSpec creation, the
// contract above must still hold — these tests stay green throughout.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  cadence: string;
  status: string;
}

const SAME_SITE_HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
};

const SAME_SITE_AUTHED_HEADERS = {
  ...SAME_SITE_HEADERS,
  authorization: "Bearer dev-test-jwt",
};

function buildRequest(opts: {
  headers?: Record<string, string>;
  body?: unknown;
}): Request {
  return new Request("http://localhost:3030/api/bureau/dragnet/run", {
    method: "POST",
    headers: opts.headers ?? {},
    body:
      opts.body === undefined
        ? undefined
        : typeof opts.body === "string"
          ? opts.body
          : JSON.stringify(opts.body),
  });
}

function validBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    targetUrl: "https://api.openai.com/v1/chat/completions",
    probePackId: "canon-honesty",
    cadence: "once",
    authorizationAcknowledged: true,
    ...overrides,
  };
}

beforeEach(() => {
  resetRateLimit();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/bureau/dragnet/run — CSRF defence", () => {
  it("returns 403 when sec-fetch-site is cross-site", async () => {
    const res = await POST(
      buildRequest({
        headers: {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
          authorization: "Bearer dev",
        },
        body: validBody(),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 403 when no sec-fetch-site and no allowed origin/referer", async () => {
    const res = await POST(
      buildRequest({
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example.com",
          authorization: "Bearer dev",
        },
        body: validBody(),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("accepts when sec-fetch-site is same-origin", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts when origin matches studio.pluck.run as fallback", async () => {
    const res = await POST(
      buildRequest({
        headers: {
          "content-type": "application/json",
          origin: "https://studio.pluck.run",
          authorization: "Bearer dev",
        },
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
  });
});

describe("POST /api/bureau/dragnet/run — auth", () => {
  it("returns 401 with signInUrl when no auth credentials", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { signInUrl: string; error: string };
    expect(body.error).toBe("authentication required");
    expect(body.signInUrl).toContain("/sign-in");
  });

  it("accepts a Supabase auth cookie", async () => {
    const res = await POST(
      buildRequest({
        headers: {
          ...SAME_SITE_HEADERS,
          cookie: "sb-abcdef-auth-token=eyJhbGciOiJIUzI1NiJ9.test.sig",
        },
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(body.phraseId).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
    expect(body.status).toBe("cycle pending");
  });

  it("accepts chunked Supabase cookie (sb-*-auth-token.0)", async () => {
    const res = await POST(
      buildRequest({
        headers: {
          ...SAME_SITE_HEADERS,
          cookie: "sb-abcdef-auth-token.0=chunk-zero-content; other=x",
        },
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts Bearer in dev (NODE_ENV !== production)", async () => {
    // Vitest defaults NODE_ENV to "test", so Bearer is allowed.
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects Bearer in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await POST(
        buildRequest({
          headers: SAME_SITE_AUTHED_HEADERS,
          body: validBody(),
        }),
      );
      expect(res.status).toBe(401);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("does not match arbitrary cookies that look similar", async () => {
    const res = await POST(
      buildRequest({
        headers: {
          ...SAME_SITE_HEADERS,
          cookie: "sbsomething=value; auth-token=value",
        },
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/bureau/dragnet/run — body validation", () => {
  it("rejects malformed JSON with 400", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: "{not json",
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/invalid JSON/);
  });

  it("rejects missing fields with 400 + human labels", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: { targetUrl: "" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Target endpoint and Probe-pack ID/);
  });

  it("rejects malformed targetUrl with 400", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "not-a-url" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/valid URL/);
  });

  it("rejects javascript: scheme", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "javascript:alert(1)" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/http:\/\/ or https:\/\//);
  });

  it("rejects file: scheme", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "file:///etc/passwd" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects http://localhost target", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "http://localhost:8080/" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/localhost.*private.*link-local/);
  });

  it("rejects RFC1918 10.0.0.0/8 target", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "http://10.0.0.1/" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects RFC1918 192.168.x.x target", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "http://192.168.1.1/" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects link-local 169.254.x.x target (AWS IMDS feeder)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ targetUrl: "http://169.254.169.254/latest/meta-data/" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown probe-pack ID", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ probePackId: "canon-honestly" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Unknown probe-pack/);
  });

  it("accepts the bundled canon-honesty pack", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ probePackId: "canon-honesty" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("accepts a NUCLEI-qualified probe-pack ID", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ probePackId: "alice/honest-llm@1.0.0" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects continuous cadence (coming-soon stub)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ cadence: "continuous" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Continuous monitoring is coming soon/);
  });

  it("rejects unknown cadence value", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ cadence: "weekly" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects when authorizationAcknowledged is missing", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ authorizationAcknowledged: undefined }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authorized to probe/);
  });

  it("rejects when authorizationAcknowledged is false", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ authorizationAcknowledged: false }),
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bureau/dragnet/run — output shape", () => {
  it("returns a fresh runId + phraseId on each call", async () => {
    const r1 = (await (
      await POST(
        buildRequest({
          headers: SAME_SITE_AUTHED_HEADERS,
          body: validBody(),
        }),
      )
    ).json()) as SuccessBody;
    const r2 = (await (
      await POST(
        buildRequest({
          headers: SAME_SITE_AUTHED_HEADERS,
          body: validBody(),
        }),
      )
    ).json()) as SuccessBody;
    expect(r1.runId).not.toEqual(r2.runId);
    // Phrase IDs draw from a 64M space; near-certain to be unique on 2 draws.
    expect(r1.phraseId).not.toEqual(r2.phraseId);
  });
});

describe("POST /api/bureau/dragnet/run — rate limit", () => {
  it("returns 429 after the per-window threshold is exceeded", async () => {
    const headers = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.42",
    };

    // 10 successful, 11th rejected.
    for (let i = 0; i < 10; i++) {
      const res = await POST(buildRequest({ headers, body: validBody() }));
      expect(res.status).toBe(200);
    }
    const overflow = await POST(buildRequest({ headers, body: validBody() }));
    expect(overflow.status).toBe(429);
  });

  it("buckets unauthed and authed traffic separately", async () => {
    const authed = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.99",
      cookie: "sb-x-auth-token=jwt",
    };
    const unauthed = {
      ...SAME_SITE_HEADERS,
      "x-forwarded-for": "203.0.113.99",
    };

    // Burn through the unauthed bucket.
    for (let i = 0; i < 10; i++) {
      await POST(buildRequest({ headers: unauthed, body: validBody() }));
    }
    // Authed traffic from the same IP should still succeed.
    const res = await POST(
      buildRequest({ headers: authed, body: validBody() }),
    );
    expect(res.status).toBe(200);
  });
});
