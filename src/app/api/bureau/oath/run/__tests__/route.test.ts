// ---------------------------------------------------------------------------
// POST /api/bureau/oath/run — contract tests
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  vendorDomain: string;
  hostingOrigin: string;
  expectedOrigin: string;
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
  return new Request("http://localhost:3030/api/bureau/oath/run", {
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
    vendorDomain: "openai.com",
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

describe("POST /api/bureau/oath/run — guards", () => {
  it("rejects cross-site requests with 403", async () => {
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

  it("returns 401 with signInUrl when no auth", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { signInUrl: string };
    expect(body.signInUrl).toContain("/bureau/oath/run");
  });

  it("rejects Bearer in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/bureau/oath/run — body validation", () => {
  it("rejects missing vendorDomain", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: { authorizationAcknowledged: true },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Vendor domain is required/);
  });

  it("accepts a full URL by extracting the hostname", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendorDomain: "https://openai.com/v1/chat" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.vendorDomain).toBe("openai.com");
  });

  it("rejects vendorDomain with a path but no scheme", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendorDomain: "openai.com/api" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects vendorDomain that is a bare IP", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendorDomain: "10.0.0.1" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects vendorDomain that is localhost", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendorDomain: "localhost" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects single-label hostname (no TLD)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendorDomain: "openai" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects when authorization not acknowledged", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ authorizationAcknowledged: false }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authorized to fetch/);
  });

  it("rejects http:// hostingOrigin (HTTPS-only per OATH spec)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          vendorDomain: "openai.com",
          hostingOrigin: "http://openai.com",
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/https:\/\//);
  });

  it("rejects malformed hostingOrigin", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          vendorDomain: "openai.com",
          hostingOrigin: "not-a-url",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects localhost hostingOrigin", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          vendorDomain: "openai.com",
          hostingOrigin: "https://localhost",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts the legacy `expectedOrigin` field name (back-compat)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          vendorDomain: "openai.com",
          expectedOrigin: "https://chat.openai.com",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.hostingOrigin).toBe("https://chat.openai.com");
  });
});

describe("POST /api/bureau/oath/run — success path", () => {
  it("returns vendor-scoped phrase ID + verification-pending status", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.phraseId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.vendorDomain).toBe("openai.com");
    expect(body.hostingOrigin).toBe("https://openai.com");
    expect(body.expectedOrigin).toBe("https://openai.com");
    expect(body.status).toBe("verification pending");
  });

  it("respects an explicit hostingOrigin override", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          vendorDomain: "openai.com",
          hostingOrigin: "https://chat.openai.com",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.hostingOrigin).toBe("https://chat.openai.com");
  });

  it("lowercases the vendorDomain", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendorDomain: "OpenAI.COM" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.vendorDomain).toBe("openai.com");
  });
});

describe("POST /api/bureau/oath/run — rate limit shared bucket", () => {
  it("DRAGNET + OATH share the same per-IP bucket", async () => {
    const headers = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.50",
    };
    // 10 OATH requests fill the bucket.
    for (let i = 0; i < 10; i++) {
      const res = await POST(buildRequest({ headers, body: validBody() }));
      expect(res.status).toBe(200);
    }
    // 11th OATH request rejected.
    const overflow = await POST(buildRequest({ headers, body: validBody() }));
    expect(overflow.status).toBe(429);
  });
});
