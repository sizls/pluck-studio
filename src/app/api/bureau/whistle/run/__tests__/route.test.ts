// ---------------------------------------------------------------------------
// POST /api/bureau/whistle/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-3 migration: the legacy route now delegates to the shared
// `validateWhistlePayload` and dual-writes into the v1 store. Privacy
// invariant: source-identifying material is REJECTED on the wire AND
// the response NEVER echoes bundleUrl back (anonymity-by-default).
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { __resetForTests } from "../../../../../../lib/v1/run-store.js";
import { POST } from "../route.js";
import { POST as POST_V1 } from "../../../../v1/runs/route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  category: string;
  routingPartner: string;
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
  return new Request("http://localhost:3030/api/bureau/whistle/run", {
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
    bundleUrl: "https://example.com/tip.json",
    category: "training-data",
    routingPartner: "propublica",
    anonymityCaveatAcknowledged: true,
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

describe("POST /api/bureau/whistle/run — guards", () => {
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

  it("returns 401 when no auth", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/bureau/whistle/run — body validation", () => {
  it("rejects missing bundleUrl", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects http:// scheme", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "http://example.com/tip.json" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects localhost bundleUrl", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ bundleUrl: "https://localhost/tip.json" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown category", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ category: "made-up" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects unknown routing partner", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ routingPartner: "rando-news" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects oversized manual redact phrase", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ manualRedactPhrase: "x".repeat(257) }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects when anonymity caveat not acknowledged", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ anonymityCaveatAcknowledged: false }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/anonymity/);
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

describe("POST /api/bureau/whistle/run — privacy invariant", () => {
  it("rejects payload carrying sourceName (defense-in-depth)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ sourceName: "Jane Doe" }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/source-identifying/i);
  });

  it("rejects payload carrying sourceEmail", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ sourceEmail: "jane@example.com" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects payload carrying sourceIp", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ sourceIp: "203.0.113.5" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects payload carrying source_handle", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({ source_handle: "@jane" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("response NEVER echoes bundleUrl (anonymity-by-default)", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          bundleUrl: "https://anonymous-tip-host.example/secret-bundle.json",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toMatch(/anonymous-tip-host/);
    expect(text).not.toMatch(/secret-bundle/);
    expect(text).not.toMatch(/bundleUrl/);
  });
});

describe("POST /api/bureau/whistle/run — success path", () => {
  it("returns partner-scoped phrase ID; runId === phraseId post-migration", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.runId).toBe(body.phraseId);
    expect(body.phraseId).toMatch(/^propublica-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.category).toBe("training-data");
    expect(body.routingPartner).toBe("propublica");
    expect(body.status).toBe("submission pending");
  });

  it("phrase prefix follows the routing partner not the bundle URL", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody({
          bundleUrl: "https://anonymous.tip-source.example/bundle.json",
          routingPartner: "bellingcat",
        }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.phraseId).toMatch(/^bellingcat-/);
  });

  it("accepts each canonical category", async () => {
    for (const category of [
      "training-data",
      "policy-violation",
      "safety-incident",
    ]) {
      __resetForTests();
      resetRateLimit();
      const res = await POST(
        buildRequest({
          headers: SAME_SITE_AUTHED_HEADERS,
          body: validBody({ category }),
        }),
      );
      expect(res.status).toBe(200);
    }
  });
});

describe("POST /api/bureau/whistle/run — RFC 8594 deprecation signaling", () => {
  it("emits Deprecation/Sunset/Link headers + body flags", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
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

describe("POST /api/bureau/whistle/run — idempotency dedupe", () => {
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
            body: validBody(),
          }),
        )
      ).json()) as SuccessBody;

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const v1Body = {
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://example.com/tip.json",
          category: "training-data",
          routingPartner: "propublica",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
        idempotencyKey: `whistle:propublica:training-data:https://example.com/tip.json:${minuteBucket}`,
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
