// ---------------------------------------------------------------------------
// POST /api/bureau/rotate/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-3 migration: the legacy route now delegates to the shared
// `validateRotatePayload` and dual-writes into the v1 store. Privacy
// invariant: private-key material is REJECTED on the wire.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { __resetForTests } from "../../../../../../lib/v1/run-store.js";
import { POST } from "../route.js";
import { POST as POST_V1 } from "../../../../v1/runs/route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  oldKeyFingerprint: string;
  newKeyFingerprint: string;
  reason: string;
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/rotate/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    oldKeyFingerprint: "a".repeat(64),
    newKeyFingerprint: "b".repeat(64),
    reason: "compromised",
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

describe("POST /api/bureau/rotate/run — validation", () => {
  it("rejects missing old key", async () => {
    const r = await POST(buildRequest(valid({ oldKeyFingerprint: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects malformed old key", async () => {
    const r = await POST(buildRequest(valid({ oldKeyFingerprint: "not-hex" })));
    expect(r.status).toBe(400);
  });

  it("rejects when old === new (no-op rotation)", async () => {
    const r = await POST(
      buildRequest(
        valid({
          oldKeyFingerprint: "a".repeat(64),
          newKeyFingerprint: "a".repeat(64),
        }),
      ),
    );
    expect(r.status).toBe(400);
  });

  it("rejects unknown reason", async () => {
    const r = await POST(buildRequest(valid({ reason: "made-up" })));
    expect(r.status).toBe(400);
  });

  it("rejects oversized note", async () => {
    const r = await POST(buildRequest(valid({ operatorNote: "x".repeat(513) })));
    expect(r.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/rotate/run — privacy invariant (private key material REJECTED)", () => {
  it("rejects payload carrying a privateKey field (defense-in-depth)", async () => {
    const r = await POST(
      buildRequest(valid({ privateKey: "-----BEGIN PRIVATE KEY-----..." })),
    );
    expect(r.status).toBe(400);
    const body = (await r.json()) as { error: string };
    expect(body.error).toMatch(/never accepts private-key material/i);
  });

  it("rejects payload carrying a private_key field", async () => {
    const r = await POST(
      buildRequest(valid({ private_key: "secret-pem-data" })),
    );
    expect(r.status).toBe(400);
  });

  it("rejects payload carrying a *secret field", async () => {
    const r = await POST(buildRequest(valid({ keySecret: "secret-data" })));
    expect(r.status).toBe(400);
  });

  it("rejects payload carrying PEM-shaped key", async () => {
    const r = await POST(buildRequest(valid({ pem: "-----BEGIN..." })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/rotate/run — success", () => {
  it("returns reason-scoped phrase ID; runId === phraseId post-migration", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toBe(b.phraseId);
    expect(b.phraseId).toMatch(/^compromised-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.reason).toBe("compromised");
    expect(b.status).toBe("rotation pending");
  });

  it("phrase prefix tracks the reason for routine + lost rotations", async () => {
    for (const reason of ["routine", "lost"]) {
      __resetForTests();
      resetRateLimit();
      const r = await POST(buildRequest(valid({ reason })));
      expect(r.status).toBe(200);
      const b = (await r.json()) as SuccessBody;
      expect(b.phraseId).toMatch(new RegExp(`^${reason}-`));
    }
  });

  it("lowercases fingerprints", async () => {
    const r = await POST(
      buildRequest(
        valid({
          oldKeyFingerprint: "A".repeat(64),
          newKeyFingerprint: "B".repeat(64),
        }),
      ),
    );
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.oldKeyFingerprint).toBe("a".repeat(64));
    expect(b.newKeyFingerprint).toBe("b".repeat(64));
  });
});

describe("POST /api/bureau/rotate/run — RFC 8594 deprecation signaling", () => {
  it("emits Deprecation/Sunset/Link headers + body flags", async () => {
    const res = await POST(buildRequest(valid()));
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

describe("POST /api/bureau/rotate/run — idempotency dedupe", () => {
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
        pipeline: "bureau:rotate",
        payload: {
          oldKeyFingerprint: "a".repeat(64),
          newKeyFingerprint: "b".repeat(64),
          reason: "compromised",
          authorizationAcknowledged: true,
        },
        idempotencyKey: `rotate:compromised:${"a".repeat(64)}:${"b".repeat(64)}:${minuteBucket}`,
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
