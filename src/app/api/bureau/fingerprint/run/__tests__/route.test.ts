// ---------------------------------------------------------------------------
// POST /api/bureau/fingerprint/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-2 migration: the legacy route now delegates to the shared
// `validateFingerprintPayload` and dual-writes into the v1 store. These
// tests lock the new contract:
//   - runId === phraseId (single primitive, mirrors DRAGNET M5)
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
  __resetForTests();
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

  it("rejects unsupported vendor slugs and echoes supportedVendors", async () => {
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
  it("returns vendor-scoped phrase ID; runId === phraseId post-migration", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    // Post-migration: runId === phraseId — the canonical vendor-scoped
    // phrase-id-shaped primitive (mirrors DRAGNET M5 unification).
    expect(body.runId).toBe(body.phraseId);
    expect(body.runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.phraseId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.vendor).toBe("openai");
    expect(body.model).toBe("gpt-4o");
    expect(body.status).toBe("scan pending");
  });
});

describe("POST /api/bureau/fingerprint/run — RFC 8594 deprecation signaling", () => {
  it("emits Deprecation, Sunset, and Link successor-version headers", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
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
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    const b = (await res.json()) as SuccessBody & {
      deprecated?: boolean;
      replacement?: string;
    };
    expect(b.deprecated).toBe(true);
    expect(b.replacement).toBe("/api/v1/runs");
  });
});

describe("POST /api/bureau/fingerprint/run — idempotency dedupe", () => {
  it("two same-payload posts within the minute bucket return the SAME phraseId", async () => {
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
    expect(r2.phraseId).toBe(r1.phraseId);
  });

  it("legacy callers + /v1/runs callers with the same payload converge on the SAME phraseId", async () => {
    // Cross-route dedupe — proves the synthesized key matches what the
    // RunForm sends to /v1/runs. Pin the clock so the legacy route's
    // internal Date.now() and our minute-bucket calculation cannot
    // straddle a minute boundary.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:30.000Z"));
    try {
      const legacy = (await (
        await POST(
          buildRequest({
            headers: SAME_SITE_AUTHED_HEADERS,
            body: validBody(),
          }),
        )
      ).json()) as SuccessBody;

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const v1Body = {
        pipeline: "bureau:fingerprint",
        payload: {
          vendor: "openai",
          model: "gpt-4o",
          authorizationAcknowledged: true,
        },
        idempotencyKey: `fingerprint:openai:gpt-4o:${minuteBucket}`,
      };
      const v1 = (await (
        await POST_V1(
          new Request("http://localhost:3030/api/v1/runs", {
            method: "POST",
            headers: SAME_SITE_AUTHED_HEADERS,
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

describe("POST /api/bureau/fingerprint/run — rate-limit shared bucket", () => {
  it("FINGERPRINT shares the global per-IP+session bucket", async () => {
    const headers = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.99",
    };
    for (let i = 0; i < 10; i++) {
      // Vary minute-bucket per request via vendor/model rotation so
      // idempotency dedupe doesn't return reused records inside a
      // single bucket. The rate limit fires on the network attempt
      // independently of dedupe.
      const res = await POST(
        buildRequest({
          headers,
          body: validBody({ model: `gpt-4o-${i}` }),
        }),
      );
      expect(res.status).toBe(200);
    }
    const overflow = await POST(
      buildRequest({ headers, body: validBody({ model: "gpt-4o-overflow" }) }),
    );
    expect(overflow.status).toBe(429);
  });
});
