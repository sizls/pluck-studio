import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

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

function buildRequest(opts: { body?: unknown }): Request {
  return new Request("http://localhost:3030/api/bureau/bounty/run", {
    method: "POST",
    headers: HEADERS,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
}

function validBody(overrides: Record<string, unknown> = {}): unknown {
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
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/bureau/bounty/run — validation", () => {
  it("rejects missing source uuid", async () => {
    const res = await POST(buildRequest({ body: validBody({ sourceRekorUuid: "" }) }));
    expect(res.status).toBe(400);
  });

  it("rejects malformed source uuid", async () => {
    const res = await POST(buildRequest({ body: validBody({ sourceRekorUuid: "not-hex" }) }));
    expect(res.status).toBe(400);
  });

  it("rejects unknown target", async () => {
    const res = await POST(buildRequest({ body: validBody({ target: "intigriti" }) }));
    expect(res.status).toBe(400);
  });

  it("rejects program with dots", async () => {
    const res = await POST(buildRequest({ body: validBody({ program: "openai.com" }) }));
    expect(res.status).toBe(400);
  });

  it("rejects oversized model slug", async () => {
    const res = await POST(buildRequest({ body: validBody({ model: "a".repeat(65) }) }));
    expect(res.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const res = await POST(buildRequest({ body: validBody({ authorizationAcknowledged: false }) }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/bureau/bounty/run — success", () => {
  it("returns target-scoped phrase ID + filing-pending status", async () => {
    const res = await POST(buildRequest({ body: validBody() }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.phraseId).toMatch(/^hackerone-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.target).toBe("hackerone");
    expect(body.program).toBe("openai");
    expect(body.vendor).toBe("openai");
    expect(body.model).toBe("gpt-4o");
    expect(body.status).toBe("filing pending");
  });

  it("phrase prefix tracks the target platform", async () => {
    const res = await POST(buildRequest({ body: validBody({ target: "bugcrowd" }) }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as SuccessBody;
    expect(body.phraseId).toMatch(/^bugcrowd-/);
  });

  it("does NOT leak any auth-token-shaped string in the response", async () => {
    const res = await POST(buildRequest({ body: validBody() }));
    const text = await res.text();
    expect(text).not.toMatch(/Bearer/);
    expect(text).not.toMatch(/H1_TOKEN/);
    expect(text).not.toMatch(/BUGCROWD_TOKEN/);
  });
});
