// ---------------------------------------------------------------------------
// POST /api/bureau/mole/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-2 migration: the legacy route now delegates to the shared
// `validateMolePayload` and dual-writes into the v1 store. These tests
// lock the new contract:
//   - runId === phraseId, canary-id-scoped (mirrors DRAGNET M5)
//   - PRIVACY INVARIANT: canaryBody / canaryContent are REJECTED on the
//     wire; response NEVER carries those fields
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
  __resetForTests();
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

describe("POST /api/bureau/mole/run — privacy invariant (canaryBody REJECTED on wire)", () => {
  it("response NEVER contains a canaryBody / canaryContent field", async () => {
    const r = await POST(buildRequest(valid()));
    const text = await r.text();
    expect(text).not.toMatch(/canaryBody/);
    expect(text).not.toMatch(/canaryContent/);
  });

  it("rejects payloads that supply canaryBody (defense-in-depth)", async () => {
    const r = await POST(
      buildRequest(valid({ canaryBody: "the secret canary text" })),
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: string };
    expect(body.error).toMatch(/never accepts canary body content/i);
  });

  it("rejects payloads that supply canaryContent (defense-in-depth)", async () => {
    const r = await POST(
      buildRequest(valid({ canaryContent: "alternative leak channel" })),
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: string };
    expect(body.error).toMatch(/never accepts canary body content/i);
  });
});

describe("POST /api/bureau/mole/run — success", () => {
  it("returns canary-id-scoped phrase ID; runId === phraseId post-migration", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    // Post-migration: runId === phraseId (mirrors DRAGNET M5).
    expect(b.runId).toBe(b.phraseId);
    // Phrase prefix is the canaryId with hyphens stripped per slug
    // normalization (nyt-2024-01-15 → nyt20240115).
    expect(b.phraseId).toMatch(/^nyt20240115-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.canaryId).toBe("nyt-2024-01-15");
    expect(b.fingerprintPhrases).toHaveLength(2);
    expect(b.status).toBe("seal pending");
  });
});

describe("POST /api/bureau/mole/run — RFC 8594 deprecation signaling", () => {
  it("emits Deprecation, Sunset, and Link successor-version headers", async () => {
    const res = await POST(buildRequest(valid()));
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
    const res = await POST(buildRequest(valid()));
    const b = (await res.json()) as SuccessBody & {
      deprecated?: boolean;
      replacement?: string;
    };
    expect(b.deprecated).toBe(true);
    expect(b.replacement).toBe("/api/v1/runs");
  });
});

describe("POST /api/bureau/mole/run — idempotency dedupe", () => {
  it("two same-payload posts within the minute bucket return the SAME phraseId", async () => {
    const r1 = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;
    const r2 = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;
    expect(r2.phraseId).toBe(r1.phraseId);
  });

  it("legacy callers + /v1/runs callers with the same payload converge on the SAME phraseId", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-04T12:00:30.000Z"));
    try {
      const legacy = (await (await POST(buildRequest(valid()))).json()) as SuccessBody;

      const minuteBucket = Math.floor(Date.now() / 60_000);
      const v1Body = {
        pipeline: "bureau:mole",
        payload: {
          canaryId: "nyt-2024-01-15",
          canaryUrl: "https://example.com/canary.txt",
          fingerprintPhrases:
            "first unique-enough fingerprint phrase, second unique-enough phrase",
          authorizationAcknowledged: true,
        },
        idempotencyKey: `mole:nyt-2024-01-15:https://example.com/canary.txt:${minuteBucket}`,
      };
      const v1 = (await (
        await POST_V1(
          new Request("http://localhost:3030/api/v1/runs", {
            method: "POST",
            headers: HEADERS,
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
