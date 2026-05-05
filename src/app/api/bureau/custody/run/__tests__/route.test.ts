// ---------------------------------------------------------------------------
// POST /api/bureau/custody/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-2 migration: the legacy route now delegates to the shared
// `validateCustodyPayload` and dual-writes into the v1 store. These
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
  __resetForTests();
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
  it("returns vendor-scoped phrase ID; runId === phraseId post-migration", async () => {
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
    // Post-migration: runId === phraseId (mirrors DRAGNET M5).
    expect(body.runId).toBe(body.phraseId);
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

describe("POST /api/bureau/custody/run — RFC 8594 deprecation signaling", () => {
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

describe("POST /api/bureau/custody/run — idempotency dedupe", () => {
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
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:30.000Z"));
    try {
      const legacy = (await (
        await POST(
          buildRequest({
            headers: SAME_SITE_AUTHED_HEADERS,
            body: validBody({ expectedVendor: "openai.com" }),
          }),
        )
      ).json()) as SuccessBody;

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const v1Body = {
        pipeline: "bureau:custody",
        payload: {
          bundleUrl: "https://example.com/bundle.intoto.jsonl",
          vendorDomain: "openai.com",
          expectedVendor: "openai.com",
          authorizationAcknowledged: true,
        },
        idempotencyKey: `custody:openai.com:https://example.com/bundle.intoto.jsonl:${minuteBucket}`,
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

describe("POST /api/bureau/custody/run — rate-limit shared bucket", () => {
  it("CUSTODY shares the global per-IP+session bucket", async () => {
    const headers = {
      ...SAME_SITE_AUTHED_HEADERS,
      "x-forwarded-for": "203.0.113.51",
    };
    for (let i = 0; i < 10; i++) {
      const res = await POST(
        buildRequest({
          headers,
          body: validBody({ bundleUrl: `https://example.com/bundle-${i}.json` }),
        }),
      );
      expect(res.status).toBe(200);
    }
    const overflow = await POST(
      buildRequest({
        headers,
        body: validBody({ bundleUrl: "https://example.com/bundle-overflow.json" }),
      }),
    );
    expect(overflow.status).toBe(429);
  });
});
