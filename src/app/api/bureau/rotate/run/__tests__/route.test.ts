import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

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
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/bureau/rotate/run", () => {
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

  it("returns reason-scoped phrase ID + rotation-pending status", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toMatch(/^[0-9a-f-]{36}$/);
    expect(b.phraseId).toMatch(/^compromised-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.reason).toBe("compromised");
    expect(b.status).toBe("rotation pending");
  });

  it("phrase prefix tracks the reason for routine + lost rotations", async () => {
    for (const reason of ["routine", "lost"]) {
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
