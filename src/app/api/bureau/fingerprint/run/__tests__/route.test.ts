// ---------------------------------------------------------------------------
// POST /api/bureau/fingerprint/run — contract tests
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  vendor: string;
  model: string;
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
  return new Request("http://localhost:3030/api/bureau/fingerprint/run", {
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
    vendor: "openai",
    model: "gpt-4o",
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

describe("POST /api/bureau/fingerprint/run — guards", () => {
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
    expect(body.signInUrl).toContain("/bureau/fingerprint/run");
  });
});

describe("POST /api/bureau/fingerprint/run — body validation", () => {
  it("rejects missing vendor + model", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: { authorizationAcknowledged: true },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Vendor and Model are required/);
  });

  it("rejects vendor with dots", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "openai.com" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/short lowercase slug/);
  });

  it("rejects unsupported vendor slugs", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "acme" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      error: string;
      supportedVendors: string[];
    };
    expect(body.error).toMatch(/not yet supported/);
    expect(body.supportedVendors).toContain("openai");
    expect(body.supportedVendors).toContain("anthropic");
  });

  it("rejects vendor with slash", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "openai/foo" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects oversized vendor slug", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "a".repeat(33) }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a multi-component model slug", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "anthropic", model: "claude-3-5-sonnet" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.vendor).toBe("anthropic");
    expect(body.model).toBe("claude-3-5-sonnet");
  });

  it("accepts a model slug with dots (llama-3.1-70b)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "meta", model: "llama-3.1-70b" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects model with spaces", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ model: "gpt 4o" }),
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
    expect(body.error).toMatch(/authorized to scan/);
  });

  it("lowercases vendor + model", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ vendor: "OpenAI", model: "GPT-4O" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.vendor).toBe("openai");
    expect(body.model).toBe("gpt-4o");
  });
});

describe("POST /api/bureau/fingerprint/run — success path", () => {
  it("returns vendor-scoped phrase ID + scan-pending status", async () => {
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
    expect(body.vendor).toBe("openai");
    expect(body.model).toBe("gpt-4o");
    expect(body.status).toBe("scan pending");
  });
});

describe("POST /api/bureau/fingerprint/run — rate-limit shared bucket", () => {
  it("DRAGNET + OATH + FINGERPRINT share the same per-IP bucket", async () => {
    const headers = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.99",
    };
    for (let i = 0; i < 10; i++) {
      const res = await POST(buildRequest({ headers, body: validBody() }));
      expect(res.status).toBe(200);
    }
    const overflow = await POST(buildRequest({ headers, body: validBody() }));
    expect(overflow.status).toBe(429);
  });
});
