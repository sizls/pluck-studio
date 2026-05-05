// ---------------------------------------------------------------------------
// /api/v1/runs — contract tests
// ---------------------------------------------------------------------------
//
// Locks the unified-pipeline-activation contract:
//   - 403 on cross-site POSTs and GETs
//   - 401 on POST without a Supabase session cookie or Bearer token
//     (GET is public read by phraseId — same-site + rate-limit only)
//   - 400 on missing/invalid pipeline, missing payload, malformed JSON
//   - 400 with "documented but not yet implemented" on extract/sense/act/fleet
//   - 200 + { runId, receiptUrl, status, reused } on POST success
//   - 200 + RunRecord shape on GET by id (no auth required — the phraseId
//     in the URL IS the share credential)
//   - 404 on GET for unknown id
//   - Idempotency end-to-end: same idempotencyKey returns reused=true
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetRateLimit } from "../../../../../lib/rate-limit.js";
import type { RunRecord } from "../../../../../lib/v1/run-spec.js";
import { __resetForTests } from "../../../../../lib/v1/run-store.js";
import { GET } from "../[id]/route.js";
import { POST } from "../route.js";

interface PostSuccessBody {
  runId: string;
  receiptUrl: string;
  status: string;
  reused: boolean;
}

const SAME_SITE = {
  "content-type": "application/json",
  "sec-fetch-site": "same-origin",
};

const SAME_SITE_AUTHED = {
  ...SAME_SITE,
  authorization: "Bearer dev-test-jwt",
};

function postReq(body: unknown, headers: Record<string, string> = SAME_SITE_AUTHED): Request {
  return new Request("http://localhost:3030/api/v1/runs", {
    method: "POST",
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

function getReq(headers: Record<string, string> = SAME_SITE_AUTHED): Request {
  return new Request("http://localhost:3030/api/v1/runs/x", {
    method: "GET",
    headers,
  });
}

function validBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    pipeline: "bureau:dragnet",
    payload: {
      targetUrl: "https://api.openai.com/v1/chat/completions",
      probePackId: "canon-honesty",
      cadence: "once",
      authorizationAcknowledged: true,
    },
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

describe("POST /api/v1/runs — auth + same-site", () => {
  it("rejects cross-site POSTs with 403", async () => {
    const res = await POST(
      postReq(validBody(), {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer dev",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated POSTs with 401", async () => {
    const res = await POST(postReq(validBody(), SAME_SITE));
    expect(res.status).toBe(401);
  });

  it("401 carries a pipeline-aware signInUrl when the body names a bureau pipeline", async () => {
    const res = await POST(postReq(validBody(), SAME_SITE));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { signInUrl: string };
    expect(body.signInUrl).toBe("/sign-in?redirect=/bureau/dragnet/run");
  });

  it("401 falls back to /bureau when the body doesn't name a known bureau pipeline", async () => {
    const res = await POST(postReq({ pipeline: "extract", payload: {} }, SAME_SITE));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { signInUrl: string };
    expect(body.signInUrl).toBe("/sign-in?redirect=/bureau");
  });

  it("accepts same-site authed POST", async () => {
    const res = await POST(postReq(validBody()));
    expect(res.status).toBe(200);
  });
});

describe("POST /api/v1/runs — body shape", () => {
  it("400 on malformed JSON", async () => {
    const res = await POST(postReq("{not json"));
    expect(res.status).toBe(400);
  });

  it("400 on missing pipeline", async () => {
    const res = await POST(postReq({ payload: {} }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/pipeline/);
  });

  it("400 on unknown pipeline", async () => {
    const res = await POST(
      postReq({ pipeline: "bureau:made-up", payload: {} }),
    );
    expect(res.status).toBe(400);
  });

  it("400 on missing payload", async () => {
    const res = await POST(postReq({ pipeline: "bureau:dragnet" }));
    expect(res.status).toBe(400);
  });

  it("400 on payload that is an array, not an object", async () => {
    const res = await POST(
      postReq({ pipeline: "bureau:dragnet", payload: [] }),
    );
    expect(res.status).toBe(400);
  });

  it("400 with documented-but-future message on extract pipeline", async () => {
    const res = await POST(postReq({ pipeline: "extract", payload: {} }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/documented but not yet implemented/);
  });

  it("400 with documented-but-future message on sense", async () => {
    const res = await POST(postReq({ pipeline: "sense", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("400 with documented-but-future message on act", async () => {
    const res = await POST(postReq({ pipeline: "act", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("400 with documented-but-future message on fleet", async () => {
    const res = await POST(postReq({ pipeline: "fleet", payload: {} }));
    expect(res.status).toBe(400);
  });

  it("400 on idempotencyKey that's not a string", async () => {
    const res = await POST(postReq(validBody({ idempotencyKey: 12 })));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/runs — success shape", () => {
  it("returns runId, receiptUrl, status=pending, reused=false", async () => {
    const res = await POST(postReq(validBody()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/dragnet/runs/${body.runId}`);
    expect(body.status).toBe("pending");
    expect(body.reused).toBe(false);
  });
});

describe("POST /api/v1/runs — idempotency end-to-end", () => {
  it("same idempotencyKey returns the same runId with reused=true", async () => {
    const r1 = (await (await POST(postReq(validBody({ idempotencyKey: "k1" })))).json()) as PostSuccessBody;
    const r2 = (await (await POST(postReq(validBody({ idempotencyKey: "k1" })))).json()) as PostSuccessBody;
    expect(r2.runId).toBe(r1.runId);
    expect(r2.reused).toBe(true);
  });

  it("different idempotencyKey produces different runId", async () => {
    const r1 = (await (await POST(postReq(validBody({ idempotencyKey: "k1" })))).json()) as PostSuccessBody;
    const r2 = (await (await POST(postReq(validBody({ idempotencyKey: "k2" })))).json()) as PostSuccessBody;
    expect(r1.runId).not.toBe(r2.runId);
  });
});

describe("GET /api/v1/runs/[id]", () => {
  async function postAndGetId(): Promise<string> {
    const r = (await (await POST(postReq(validBody()))).json()) as PostSuccessBody;
    return r.runId;
  }

  it("404s on unknown id", async () => {
    const res = await GET(getReq(), {
      params: Promise.resolve({ id: "nope-nope-nope-0000" }),
    });
    expect(res.status).toBe(404);
  });

  it("200s on a valid id and echoes the full RunRecord", async () => {
    const id = await postAndGetId();
    const res = await GET(getReq(), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunRecord;
    expect(body.runId).toBe(id);
    expect(body.pipeline).toBe("bureau:dragnet");
    expect(body.status).toBe("pending");
    expect(body.payload.targetUrl).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("403s cross-site GETs", async () => {
    const id = await postAndGetId();
    const res = await GET(
      getReq({
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
        authorization: "Bearer dev",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(res.status).toBe(403);
  });

  it("200s unauthed GETs — receipts are public reads keyed by phraseId", async () => {
    const id = await postAndGetId();
    const res = await GET(getReq(SAME_SITE), {
      params: Promise.resolve({ id }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunRecord;
    expect(body.runId).toBe(id);
  });

  it("400 on absurdly long id", async () => {
    const res = await GET(getReq(), {
      params: Promise.resolve({ id: "x".repeat(200) }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/runs — per-pipeline payload validation (M1 fix)", () => {
  it("rejects DRAGNET payload pointing at localhost (private IP block)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "http://localhost:8080/",
          probePackId: "canon-honesty",
          cadence: "once",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/localhost.*private.*link-local/);
  });

  it("rejects DRAGNET payload with a javascript: scheme", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "javascript:alert(1)",
          probePackId: "canon-honesty",
          cadence: "once",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/http:\/\/ or https:\/\//);
  });

  it("rejects DRAGNET payload with an unknown probe-pack id", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "https://api.openai.com/v1/chat/completions",
          probePackId: "canon-honestly",
          cadence: "once",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Unknown probe-pack/);
  });

  it("rejects DRAGNET payload missing authorizationAcknowledged", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:dragnet",
        payload: {
          targetUrl: "https://api.openai.com/v1/chat/completions",
          probePackId: "canon-honesty",
          cadence: "once",
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authorized to probe/);
  });

  it("rejects unknown top-level keys in the envelope", async () => {
    const res = await POST(postReq(validBody({ surprise: "extra" })));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/unexpected top-level key: surprise/);
  });

  it("rejects NUCLEI payload with malformed cron (no longer a stub)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:nuclei",
        payload: {
          author: "alice",
          packName: "canon-honesty@0.1",
          sbomRekorUuid: "a".repeat(64),
          vendorScope: "openai/gpt-4o",
          license: "MIT",
          recommendedInterval: "not cron",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/cron/i);
  });

  it("rejects NUCLEI payload with out-of-range cron ('0 25 * * *')", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:nuclei",
        payload: {
          author: "alice",
          packName: "canon-honesty@0.1",
          sbomRekorUuid: "a".repeat(64),
          vendorScope: "openai/gpt-4o",
          license: "MIT",
          recommendedInterval: "0 25 * * *",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects NUCLEI payload with a non-allowed license", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:nuclei",
        payload: {
          author: "alice",
          packName: "canon-honesty@0.1",
          sbomRekorUuid: "a".repeat(64),
          vendorScope: "openai/gpt-4o",
          license: "WTFPL",
          recommendedInterval: "0 */4 * * *",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a fully-formed OATH payload (real validator)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:oath",
        payload: {
          vendorDomain: "openai.com",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    // Vendor-scoped phrase ID — OATH carries `vendorDomain`, so the
    // run-store derives `generateScopedPhraseId("https://openai.com")`.
    expect(body.runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/oath/runs/${body.runId}`);
  });

  it("rejects OATH payload missing vendorDomain", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:oath",
        payload: { authorizationAcknowledged: true },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Vendor domain is required/);
  });

  it("rejects OATH payload pointing at localhost (private-IP block)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:oath",
        payload: {
          vendorDomain: "localhost",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects OATH payload missing authorizationAcknowledged", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:oath",
        payload: { vendorDomain: "openai.com" },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/authorized to fetch/);
  });

  it("rejects OATH payload with http:// hostingOrigin", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:oath",
        payload: {
          vendorDomain: "openai.com",
          hostingOrigin: "http://openai.com",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("accepts a fully-formed NUCLEI payload (real validator) — author-scoped phrase ID", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:nuclei",
        payload: {
          author: "alice",
          packName: "canon-honesty@0.1",
          sbomRekorUuid: "a".repeat(64),
          vendorScope: "openai/gpt-4o",
          license: "MIT",
          recommendedInterval: "0 */4 * * *",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    // Author-scoped phrase ID — the run-store derives
    // `generateScopedPhraseId("https://alice.example")` for NUCLEI.
    expect(body.runId).toMatch(/^alice-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/nuclei/runs/${body.runId}`);
  });
});

describe("POST /api/v1/runs — Wave-3 migrated pipelines (BOUNTY/SBOM-AI/ROTATE/TRIPWIRE/WHISTLE)", () => {
  it("BOUNTY — accepts a fully-formed payload + assigns target-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:bounty",
        payload: {
          sourceRekorUuid: "a".repeat(64),
          target: "hackerone",
          program: "openai",
          vendor: "openai",
          model: "gpt-4o",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^hackerone-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/bounty/runs/${body.runId}`);
  });

  it("BOUNTY — PRIVACY INVARIANT: rejects payloads carrying Bearer token", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:bounty",
        payload: {
          sourceRekorUuid: "a".repeat(64),
          target: "hackerone",
          program: "openai",
          vendor: "openai",
          model: "gpt-4o",
          Bearer: "tok_abc",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/auth-token-shaped/i);
  });

  it("SBOM-AI — accepts a fully-formed payload + assigns kind-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:sbom-ai",
        payload: {
          artifactUrl: "https://example.com/pack.json",
          artifactKind: "probe-pack",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    // probe-pack → "probepack" via vendorSlugFromUrl normalization (slug
    // strips non-alphanum). Three-segment match guards against a future
    // slug-shape change.
    expect(body.runId).toMatch(/^[a-z]+-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/sbom-ai/runs/${body.runId}`);
  });

  it("SBOM-AI — rejects http:// artifactUrl", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:sbom-ai",
        payload: {
          artifactUrl: "http://example.com/pack.json",
          artifactKind: "probe-pack",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("ROTATE — accepts a fully-formed payload + assigns reason-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:rotate",
        payload: {
          oldKeyFingerprint: "a".repeat(64),
          newKeyFingerprint: "b".repeat(64),
          reason: "compromised",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^compromised-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/rotate/runs/${body.runId}`);
  });

  it("ROTATE — PRIVACY INVARIANT: rejects payloads carrying privateKey", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:rotate",
        payload: {
          oldKeyFingerprint: "a".repeat(64),
          newKeyFingerprint: "b".repeat(64),
          reason: "compromised",
          privateKey: "-----BEGIN PRIVATE KEY-----...",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/never accepts private-key material/i);
  });

  it("TRIPWIRE — accepts a fully-formed payload + assigns machine-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:tripwire",
        payload: {
          machineId: "alice-mbp",
          policySource: "default",
          notarize: false,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^alicembp-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/tripwire/runs/${body.runId}`);
  });

  it("TRIPWIRE — rejects custom policySource without customPolicyUrl", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:tripwire",
        payload: {
          machineId: "alice-mbp",
          policySource: "custom",
          notarize: false,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("WHISTLE — accepts a fully-formed payload + assigns partner-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://example.com/tip.json",
          category: "training-data",
          routingPartner: "propublica",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^propublica-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/whistle/runs/${body.runId}`);
  });

  it("WHISTLE — PRIVACY INVARIANT: rejects payloads carrying sourceName", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://example.com/tip.json",
          category: "training-data",
          routingPartner: "propublica",
          sourceName: "Jane Doe",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/source-identifying/i);
  });

  it("WHISTLE — phrase prefix is the routing partner not the bundle host", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://anonymous-source-host.example/bundle.json",
          category: "policy-violation",
          routingPartner: "bellingcat",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^bellingcat-[a-z]+-[a-z]+-\d{4}$/);
  });
});

describe("POST /api/v1/runs — Wave-2 migrated pipelines (FINGERPRINT/CUSTODY/MOLE)", () => {
  it("FINGERPRINT — accepts a fully-formed payload + assigns vendor-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:fingerprint",
        payload: {
          vendor: "openai",
          model: "gpt-4o",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/fingerprint/runs/${body.runId}`);
  });

  it("FINGERPRINT — rejects unsupported vendor slug", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:fingerprint",
        payload: {
          vendor: "acme",
          model: "gpt-4o",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/not yet supported/);
  });

  it("CUSTODY — accepts a fully-formed payload with expectedVendor (vendor-scoped runId)", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:custody",
        payload: {
          bundleUrl: "https://chat.openai.com/bundle.json",
          vendorDomain: "openai.com",
          expectedVendor: "openai.com",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    // expectedVendor is promoted to vendorDomain so the run-store
    // assigns a vendor-scoped phrase rather than the bundle hostname.
    expect(body.runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/custody/runs/${body.runId}`);
  });

  it("CUSTODY — falls back to bundleUrl hostname when no expectedVendor", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:custody",
        payload: {
          bundleUrl: "https://example.com/bundle.json",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    expect(body.runId).toMatch(/^example-[a-z]+-[a-z]+-\d{4}$/);
  });

  it("CUSTODY — rejects http:// bundleUrl", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:custody",
        payload: {
          bundleUrl: "http://example.com/bundle.json",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("MOLE — accepts a fully-formed payload + assigns canary-id-scoped runId", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:mole",
        payload: {
          canaryId: "nyt-2024-01-15",
          canaryUrl: "https://example.com/canary.txt",
          fingerprintPhrases:
            "first unique-enough fingerprint phrase, second unique-enough phrase",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as PostSuccessBody;
    // Phrase prefix is the canaryId with hyphens stripped per slug
    // normalization (nyt-2024-01-15 → nyt20240115).
    expect(body.runId).toMatch(/^nyt20240115-[a-z]+-[a-z]+-\d{4}$/);
    expect(body.receiptUrl).toBe(`/bureau/mole/runs/${body.runId}`);
  });

  it("MOLE — PRIVACY INVARIANT: rejects payloads with canaryBody", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:mole",
        payload: {
          canaryId: "nyt-2024-01-15",
          canaryUrl: "https://example.com/canary.txt",
          canaryBody: "the secret canary text",
          fingerprintPhrases: "first unique-enough fingerprint phrase",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/never accepts canary body content/i);
  });

  it("MOLE — PRIVACY INVARIANT: rejects payloads with canaryContent", async () => {
    const res = await POST(
      postReq({
        pipeline: "bureau:mole",
        payload: {
          canaryId: "nyt-2024-01-15",
          canaryUrl: "https://example.com/canary.txt",
          canaryContent: "alternative leak channel",
          fingerprintPhrases: "first unique-enough fingerprint phrase",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/v1/runs — rate limit", () => {
  it("429s after the per-window threshold", async () => {
    const headers = {
      ...SAME_SITE_AUTHED,
      "x-forwarded-for": "203.0.113.77",
    };
    for (let i = 0; i < 10; i++) {
      const res = await POST(postReq(validBody(), headers));
      expect(res.status).toBe(200);
    }
    const overflow = await POST(postReq(validBody(), headers));
    expect(overflow.status).toBe(429);
  });
});
