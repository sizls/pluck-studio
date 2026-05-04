import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../../lib/rate-limit.js";
import { POST } from "../route.js";

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

  it("rejects when ack missing", async () => {
    const r = await POST(buildRequest(valid({ authorizationAcknowledged: false })));
    expect(r.status).toBe(400);
  });
});

describe("POST /api/bureau/tripwire/run — success", () => {
  it("returns machine-scoped phrase ID + configuration-pending status", async () => {
    const r = await POST(buildRequest(valid()));
    expect(r.status).toBe(200);
    const b = (await r.json()) as SuccessBody;
    expect(b.runId).toMatch(/^[0-9a-f-]{36}$/);
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
