import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

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

describe("POST /api/bureau/whistle/run — success path", () => {
  it("returns partner-scoped phrase ID + submission-pending status", async () => {
    const res = await POST(
      buildRequest({
        headers: SAME_SITE_AUTHED_HEADERS,
        body: validBody(),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
    // Phrase prefix is the routing partner — NOT the bundle source.
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
