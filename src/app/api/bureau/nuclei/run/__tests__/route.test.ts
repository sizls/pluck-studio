import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  author: string;
  packName: string;
  sbomRekorUuid: string;
  vendorScope: string[];
  license: string;
  recommendedInterval: string;
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/nuclei/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    author: "alice",
    packName: "canon-honesty@0.1",
    sbomRekorUuid: "a".repeat(64),
    vendorScope: "openai/gpt-4o,anthropic/claude-3-5-sonnet",
    license: "MIT",
    recommendedInterval: "0 */4 * * *",
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

describe("POST /api/bureau/nuclei/run — TOFU enforcement", () => {
  it("rejects missing sbomRekorUuid (TOFU violation)", async () => {
    const r = await POST(buildRequest(valid({ sbomRekorUuid: "" })));
    expect(r.status).toBe(400);
    const b = (await r.json()) as { error: string };
    expect(b.error).toMatch(/SBOM-AI cross-reference/i);
  });

  it("rejects malformed sbomRekorUuid", async () => {
    const r = await POST(buildRequest(valid({ sbomRekorUuid: "not-hex" })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/nuclei/run — validation", () => {
  it("rejects unversioned packName", async () => {
    const r = await POST(buildRequest(valid({ packName: "canon-honesty" })));
    expect(r.status).toBe(400);
  });

  it("rejects empty vendorScope", async () => {
    const r = await POST(buildRequest(valid({ vendorScope: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects vendorScope with invalid entries", async () => {
    const r = await POST(buildRequest(valid({ vendorScope: "openai/gpt-4o,foo" })));
    expect(r.status).toBe(400);
    const b = (await r.json()) as { error: string };
    expect(b.error).toMatch(/foo/);
  });

  it("rejects non-allowed license", async () => {
    const r = await POST(buildRequest(valid({ license: "WTFPL" })));
    expect(r.status).toBe(400);
  });

  it("rejects empty recommendedInterval", async () => {
    const r = await POST(buildRequest(valid({ recommendedInterval: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects oversized recommendedInterval", async () => {
    const r = await POST(buildRequest(valid({ recommendedInterval: "x".repeat(65) })));
    expect(r.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/nuclei/run — success", () => {
  it("returns author-scoped phrase ID + parsed vendorScope array", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.phraseId).toMatch(/^alice-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.author).toBe("alice");
    expect(b.packName).toBe("canon-honesty@0.1");
    expect(b.vendorScope).toEqual([
      "openai/gpt-4o",
      "anthropic/claude-3-5-sonnet",
    ]);
    expect(b.status).toBe("publish pending");
  });

  it("lowercases vendor/model pairs", async () => {
    const r = await POST(buildRequest(valid({ vendorScope: "OpenAI/GPT-4o" })));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.vendorScope).toEqual(["openai/gpt-4o"]);
  });
});
