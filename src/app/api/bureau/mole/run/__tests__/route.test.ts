import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  canaryId: string;
  canaryUrl: string;
  fingerprintPhrases: string[];
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/mole/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    canaryId: "nyt-2024-01-15",
    canaryUrl: "https://example.com/canary.txt",
    fingerprintPhrases:
      "first unique-enough fingerprint phrase, second unique-enough phrase",
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

describe("POST /api/bureau/mole/run — validation", () => {
  it("rejects malformed canaryId", async () => {
    const r = await POST(buildRequest(valid({ canaryId: "NYT 2024" })));
    expect(r.status).toBe(400);
  });

  it("rejects missing canaryUrl", async () => {
    const r = await POST(buildRequest(valid({ canaryUrl: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects http:// canaryUrl", async () => {
    const r = await POST(
      buildRequest(valid({ canaryUrl: "http://example.com/canary.txt" })),
    );
    expect(r.status).toBe(400);
  });

  it("rejects localhost canaryUrl", async () => {
    const r = await POST(
      buildRequest(valid({ canaryUrl: "https://localhost/canary.txt" })),
    );
    expect(r.status).toBe(400);
  });

  it("rejects empty fingerprint phrases", async () => {
    const r = await POST(buildRequest(valid({ fingerprintPhrases: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects out-of-bounds (too short) phrases", async () => {
    const r = await POST(buildRequest(valid({ fingerprintPhrases: "short" })));
    expect(r.status).toBe(400);
  });

  it("rejects > 7 phrases", async () => {
    const tooMany = Array(8)
      .fill("a unique-enough fingerprint phrase")
      .join(",");
    const r = await POST(buildRequest(valid({ fingerprintPhrases: tooMany })));
    expect(r.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/mole/run — privacy posture", () => {
  it("response NEVER contains a canaryBody / canaryContent field", async () => {
    const r = await POST(buildRequest(valid()));
    const text = await r.text();
    expect(text).not.toMatch(/canaryBody/);
    expect(text).not.toMatch(/canaryContent/);
  });
});

describe("POST /api/bureau/mole/run — success", () => {
  it("returns canary-id-scoped phrase ID + parsed phrases array", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toMatch(/^[0-9a-f-]{36}$/);
    // Phrase prefix is the canaryId with hyphens stripped per slug
    // normalization (nyt-2024-01-15 → nyt20240115).
    expect(b.phraseId).toMatch(/^nyt20240115-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.canaryId).toBe("nyt-2024-01-15");
    expect(b.fingerprintPhrases).toHaveLength(2);
    expect(b.status).toBe("seal pending");
  });
});
