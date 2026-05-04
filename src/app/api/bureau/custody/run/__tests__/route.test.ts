import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  bundleUrl: string;
  expectedVendor: string | null;
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
  return new Request("http://localhost:3030/api/bureau/custody/run", {
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
    bundleUrl: "https://example.com/bundle.intoto.jsonl",
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

describe("POST /api/bureau/custody/run — guards", () => {
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
    expect(body.signInUrl).toContain("/bureau/custody/run");
  });
});

describe("POST /api/bureau/custody/run — bundleUrl validation", () => {
  it("rejects missing bundleUrl", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: { authorizationAcknowledged: true },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects http:// (HTTPS-only per CUSTODY spec)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "http://example.com/bundle.json" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/https:\/\//);
  });

  it("rejects localhost bundleUrl", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "https://localhost/bundle.json" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects RFC1918 bundleUrl host", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "https://10.0.0.1/bundle.json" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects link-local bundleUrl host", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "https://169.254.169.254/" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects malformed URL", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "not-a-url" }),
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
  });
});

describe("POST /api/bureau/custody/run — expectedVendor validation", () => {
  it("accepts a valid public hostname", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ expectedVendor: "openai.com" }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.expectedVendor).toBe("openai.com");
  });

  it("rejects expectedVendor with scheme", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ expectedVendor: "https://openai.com" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects expectedVendor that is localhost", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ expectedVendor: "localhost" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns null expectedVendor when omitted", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.expectedVendor).toBeNull();
  });
});

describe("POST /api/bureau/custody/run — success path", () => {
  it("returns vendor-scoped phrase ID + verification-pending status", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          bundleUrl: "https://chat.openai.com/bundle.json",
          expectedVendor: "openai.com",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
    // expectedVendor wins as the phrase prefix when provided.
    expect(body.phraseId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.status).toBe("verification pending");
  });

  it("falls back to bundleUrl hostname for phrase prefix when no expectedVendor", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          bundleUrl: "https://example.com/bundle.json",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.phraseId).toMatch(/^example-[a-z]+-[a-z]+-\d{4}$/);
  });
});

describe("POST /api/bureau/custody/run — rate-limit shared bucket", () => {
  it("CUSTODY shares the global per-IP+session bucket", async () => {
    const headers = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.51",
    };
    for (let i = 0; i < 10; i++) {
      const res = await POST(buildRequest({ headers, body: validBody() }));
      expect(res.status).toBe(200);
    }
    const overflow = await POST(buildRequest({ headers, body: validBody() }));
    expect(overflow.status).toBe(429);
  });
});
