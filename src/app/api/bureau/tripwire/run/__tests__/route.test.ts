// ---------------------------------------------------------------------------
// POST /api/bureau/tripwire/run — contract tests (deprecated alias)
// ---------------------------------------------------------------------------
//
// Wave-3 migration: the legacy route now delegates to the shared
// `validateTripwirePayload` and dual-writes into the v1 store.
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { __resetForTests } from "../../../../../../lib/v1/run-store.js";
import { POST } from "../route.js";
import { POST as POST_V1 } from "../../../../v1/runs/route.js";

interface SuccessBody {
  runId: string;
  phraseId: string;
  machineId: string;
  policySource: string;
  notarize: boolean;
  status: string;
}

const HEADERS = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
  authorization: "Bearer dev",
};

function buildRequest(body: unknown): Request {
  return new Request("http://localhost:3030/api/bureau/tripwire/run", {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });
}

function valid(overrides: Record<string, unknown> = {}): unknown {
  return {
    machineId: "alice-mbp",
    policySource: "default",
    notarize: false,
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

describe("POST /api/bureau/tripwire/run — validation", () => {
  it("rejects missing machineId", async () => {
    const r = await POST(buildRequest(valid({ machineId: "" })));
    expect(r.status).toBe(400);
  });

  it("rejects machineId with spaces", async () => {
    const r = await POST(buildRequest(valid({ machineId: "alice mbp" })));
    expect(r.status).toBe(400);
  });

  it("rejects oversized machineId", async () => {
    const r = await POST(buildRequest(valid({ machineId: "a".repeat(49) })));
    expect(r.status).toBe(400);
  });

  it("rejects unknown policySource", async () => {
    const r = await POST(buildRequest(valid({ policySource: "made-up" })));
    expect(r.status).toBe(400);
  });

  it("custom policy without URL is rejected", async () => {
    const r = await POST(
      buildRequest(valid({ policySource: "custom", customPolicyUrl: "" })),
    );
    expect(r.status).toBe(400);
  });

  it("custom policy http:// URL is rejected", async () => {
    const r = await POST(
      buildRequest(
        valid({
          policySource: "custom",
          customPolicyUrl: "http://example.com/policy.json",
        }),
      ),
    );
    expect(r.status).toBe(400);
  });

  it("custom policy localhost is rejected", async () => {
    const r = await POST(
      buildRequest(
        valid({
          policySource: "custom",
          customPolicyUrl: "https://localhost/policy.json",
        }),
      ),
    );
    expect(r.status).toBe(400);
  });

  it("custom policy link-local is rejected", async () => {
    const r = await POST(
      buildRequest(
        valid({
          policySource: "custom",
          customPolicyUrl: "https://169.254.169.254/policy.json",
        }),
      ),
    );
    expect(r.status).toBe(400);
  });

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/tripwire/run — success", () => {
  it("returns machine-scoped phrase ID; runId === phraseId post-migration", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toBe(b.phraseId);
    expect(b.phraseId).toMatch(/^alicembp-[a-z]+-[a-z]+-\d{4}$/);
    expect(b.machineId).toBe("alice-mbp");
    expect(b.policySource).toBe("default");
    expect(b.notarize).toBe(false);
    expect(b.status).toBe("configuration pending");
  });

  it("accepts custom policy with valid URL", async () => {
    const r = await POST(
      buildRequest(
        valid({
          policySource: "custom",
          customPolicyUrl: "https://example.com/policy.json",
        }),
      ),
    );
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.policySource).toBe("custom");
  });

  it("notarize toggle round-trips", async () => {
    const r = await POST(buildRequest(valid({ notarize: true })));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.notarize).toBe(true);
  });
});

describe("POST /api/bureau/tripwire/run — RFC 8594 deprecation signaling", () => {
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

describe("POST /api/bureau/tripwire/run — idempotency dedupe", () => {
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
        pipeline: "bureau:tripwire",
        payload: {
          machineId: "alice-mbp",
          policySource: "default",
          notarize: false,
          authorizationAcknowledged: true,
        },
        idempotencyKey: `tripwire:alice-mbp:default:${minuteBucket}`,
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
