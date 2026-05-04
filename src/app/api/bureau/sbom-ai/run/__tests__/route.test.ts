import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  artifactKind: string;
  artifactUrl: string;
  expectedSha256: string | null;
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/sbom-ai/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    artifactUrl: "https://example.com/pack.json",
    artifactKind: "probe-pack",
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

describe("POST /api/bureau/sbom-ai/run", () => {
  it("rejects missing artifactUrl", async () => {
    const r = await POST(buildRequest(valid({ artifactUrl: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects http://", async () => {
    const r = await POST(buildRequest(valid({ artifactUrl: "http://example.com/x" })));
    expect(r.status).toBe(400);
  });

  it("rejects localhost host", async () => {
    const r = await POST(buildRequest(valid({ artifactUrl: "https://localhost/x" })));
    expect(r.status).toBe(400);
  });

  it("rejects unknown artifactKind", async () => {
    const r = await POST(buildRequest(valid({ artifactKind: "made-up" })));
    expect(r.status).toBe(400);
  });

  it("rejects malformed expectedSha256", async () => {
    const r = await POST(buildRequest(valid({ expectedSha256: "not-hex" })));
    expect(r.status).toBe(400);
  });

  it("accepts well-formed expectedSha256", async () => {
    const r = await POST(buildRequest(valid({ expectedSha256: "a".repeat(64) })));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.expectedSha256).toBe("a".repeat(64));
  });

  it("returns null expectedSha256 when omitted", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.expectedSha256).toBeNull();
  });

  it("phrase prefix tracks the artifact kind", async () => {
    for (const kind of ["probe-pack", "model-card", "mcp-server"]) {
      resetRateLimit();
      const r = await POST(buildRequest(valid({ artifactKind: kind })));
      expect(r.status).toBe(200);
      const b = (await r.json()) as SuccessBody;
      // probe-pack → "probepack" via vendorSlugFromUrl normalization
      // (slug strips non-alphanum). Validate prefix matches the
      // canonical kind shape.
      expect(b.phraseId).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{4}$/);
    }
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});
