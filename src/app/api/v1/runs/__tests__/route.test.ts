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
import { GET as LIST, POST } from "../route.js";

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

describe("GET /api/v1/runs/[id] — privacy redaction (per-pipeline)", () => {
  it("WHISTLE: bundleUrl is NOT echoed in the GET response payload", async () => {
    const post = await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://leaked-host.example/bundle.json",
          category: "training-data",
          routingPartner: "propublica",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(post.status).toBe(200);
    const { runId } = (await post.json()) as PostSuccessBody;

    const res = await GET(getReq(), { params: Promise.resolve({ id: runId }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as RunRecord;

    // Privacy invariant — phraseId is the share credential; the response
    // must not leak bundleUrl. Also verify the JSON payload byte-for-byte
    // does not contain the URL anywhere (defense-in-depth — covers any
    // future field that might accidentally echo it).
    expect("bundleUrl" in body.payload).toBe(false);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("leaked-host.example");

    // Public-safe fields still present.
    expect(body.payload.routingPartner).toBe("propublica");
    expect(body.payload.category).toBe("training-data");
  });

  it("WHISTLE: manualRedactPhrase is NOT echoed in the GET response payload", async () => {
    const post = await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://example.com/bundle.json",
          category: "policy-violation",
          routingPartner: "bellingcat",
          manualRedactPhrase: "redact-internal-codename-zeus",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(post.status).toBe(200);
    const { runId } = (await post.json()) as PostSuccessBody;

    const res = await GET(getReq(), { params: Promise.resolve({ id: runId }) });
    const body = (await res.json()) as RunRecord;
    expect("manualRedactPhrase" in body.payload).toBe(false);
    expect(JSON.stringify(body)).not.toContain("zeus");
  });

  it("WHISTLE: idempotency replay still works AFTER redaction (canonical hash uses original payload)", async () => {
    const idempotencyKey = "whistle-replay-test-key";
    const r1 = (await (await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://example.com/bundle.json",
          category: "training-data",
          routingPartner: "propublica",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
        idempotencyKey,
      }),
    )).json()) as PostSuccessBody;
    expect(r1.reused).toBe(false);

    // Retry — same idempotencyKey + same canonical (pipeline, payload).
    // The store hashes the ORIGINAL payload (with bundleUrl) so this MUST
    // hit the existing run with reused=true. The redaction lives at the
    // GET boundary and never touches the canonical hash input.
    const r2 = (await (await POST(
      postReq({
        pipeline: "bureau:whistle",
        payload: {
          bundleUrl: "https://example.com/bundle.json",
          category: "training-data",
          routingPartner: "propublica",
          anonymityCaveatAcknowledged: true,
          authorizationAcknowledged: true,
        },
        idempotencyKey,
      }),
    )).json()) as PostSuccessBody;
    expect(r2.reused).toBe(true);
    expect(r2.runId).toBe(r1.runId);

    // GET still redacts.
    const getRes = await GET(getReq(), {
      params: Promise.resolve({ id: r1.runId }),
    });
    const body = (await getRes.json()) as RunRecord;
    expect("bundleUrl" in body.payload).toBe(false);
  });

  it("ROTATE: operatorNote is NOT echoed in the GET response payload", async () => {
    const post = await POST(
      postReq({
        pipeline: "bureau:rotate",
        payload: {
          oldKeyFingerprint: "a".repeat(64),
          newKeyFingerprint: "b".repeat(64),
          reason: "compromised",
          operatorNote: "incident #42 — internal investigation IOCs follow",
          authorizationAcknowledged: true,
        },
      }),
    );
    expect(post.status).toBe(200);
    const { runId } = (await post.json()) as PostSuccessBody;

    const res = await GET(getReq(), { params: Promise.resolve({ id: runId }) });
    const body = (await res.json()) as RunRecord;
    expect("operatorNote" in body.payload).toBe(false);
    expect(JSON.stringify(body)).not.toContain("incident #42");

    // Public-safe fields still present.
    expect(body.payload.oldKeyFingerprint).toBe("a".repeat(64));
    expect(body.payload.newKeyFingerprint).toBe("b".repeat(64));
    expect(body.payload.reason).toBe("compromised");
  });

  it("DRAGNET: pass-through — full payload echoed unchanged", async () => {
    const original = {
      targetUrl: "https://api.openai.com/v1/chat/completions",
      probePackId: "canon-honesty",
      cadence: "once",
      authorizationAcknowledged: true,
    };
    const post = await POST(
      postReq({ pipeline: "bureau:dragnet", payload: original }),
    );
    const { runId } = (await post.json()) as PostSuccessBody;

    const res = await GET(getReq(), { params: Promise.resolve({ id: runId }) });
    const body = (await res.json()) as RunRecord;
    expect(body.payload).toEqual(original);
  });

  it("MOLE: pass-through — canaryUrl is by-design public, echoed unchanged", async () => {
    const original = {
      canaryId: "nyt-2024-01-15",
      canaryUrl: "https://example.com/canary.txt",
      fingerprintPhrases:
        "first unique-enough fingerprint phrase, second unique-enough phrase",
      authorizationAcknowledged: true,
    };
    const post = await POST(
      postReq({ pipeline: "bureau:mole", payload: original }),
    );
    const { runId } = (await post.json()) as PostSuccessBody;

    const res = await GET(getReq(), { params: Promise.resolve({ id: runId }) });
    const body = (await res.json()) as RunRecord;
    expect(body.payload).toEqual(original);
  });
});

describe("GET /api/v1/runs — list endpoint", () => {
  interface ListBody {
    runs: RunRecord[];
    nextCursor: string | null;
    totalCount: number;
  }

  function listReq(
    query: string = "",
    headers: Record<string, string> = SAME_SITE,
  ): Request {
    return new Request(`http://localhost:3030/api/v1/runs${query}`, {
      method: "GET",
      headers,
    });
  }

  async function postBody(body: unknown): Promise<PostSuccessBody> {
    const r = await POST(postReq(body));
    return (await r.json()) as PostSuccessBody;
  }

  it("returns an empty list when the store is empty", async () => {
    const res = await LIST(listReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody;
    expect(body.runs).toEqual([]);
    expect(body.nextCursor).toBeNull();
    expect(body.totalCount).toBe(0);
  });

  it("returns runs in createdAt DESC order", async () => {
    const a = await postBody(validBody({ idempotencyKey: "a" }));
    // Slight pause to push createdAt ms forward — Date.now() granularity
    // is sufficient on Node, but we use distinct idempotency keys to
    // guarantee distinct records regardless.
    await new Promise((r) => setTimeout(r, 5));
    const b = await postBody(validBody({ idempotencyKey: "b" }));
    await new Promise((r) => setTimeout(r, 5));
    const c = await postBody(validBody({ idempotencyKey: "c" }));

    const res = await LIST(listReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody;
    expect(body.totalCount).toBe(3);
    // Newest first.
    expect(body.runs[0]?.runId).toBe(c.runId);
    expect(body.runs[2]?.runId).toBe(a.runId);
    expect(body.runs[1]?.runId).toBe(b.runId);
  });

  it("filters by pipeline=bureau:oath", async () => {
    await postBody(validBody({ idempotencyKey: "d1" }));
    const o = await postBody({
      pipeline: "bureau:oath",
      payload: { vendorDomain: "openai.com", authorizationAcknowledged: true },
      idempotencyKey: "o1",
    });
    await postBody(validBody({ idempotencyKey: "d2" }));

    const res = await LIST(listReq("?pipeline=bureau:oath"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ListBody;
    expect(body.runs.length).toBe(1);
    expect(body.runs[0]?.runId).toBe(o.runId);
    expect(body.totalCount).toBe(1);
  });

  it("rejects an unknown pipeline filter with 400", async () => {
    const res = await LIST(listReq("?pipeline=bureau:made-up"));
    expect(res.status).toBe(400);
  });

  it("rejects an unparseable since with 400", async () => {
    const res = await LIST(listReq("?since=not-a-date"));
    expect(res.status).toBe(400);
  });

  it("filters by since (ISO timestamp)", async () => {
    // First run created — capture an ISO snapshot AFTER it lands so the
    // since filter is strictly newer than this point.
    await postBody(validBody({ idempotencyKey: "old" }));
    await new Promise((r) => setTimeout(r, 10));
    const cutoff = new Date().toISOString();
    await new Promise((r) => setTimeout(r, 10));
    const fresh = await postBody(validBody({ idempotencyKey: "fresh" }));

    const res = await LIST(listReq(`?since=${encodeURIComponent(cutoff)}`));
    const body = (await res.json()) as ListBody;
    expect(body.totalCount).toBe(1);
    expect(body.runs[0]?.runId).toBe(fresh.runId);
  });

  it("clamps limit: ?limit=0 returns 1 item, ?limit=999 caps at 100", async () => {
    // Seed 5 runs.
    for (let i = 0; i < 5; i++) {
      await postBody(validBody({ idempotencyKey: `k-${i}` }));
    }

    const zero = (await (await LIST(listReq("?limit=0"))).json()) as ListBody;
    expect(zero.runs.length).toBe(1);

    const huge = (await (await LIST(listReq("?limit=999"))).json()) as ListBody;
    // 5 < 100; clamping to 100 still yields 5.
    expect(huge.runs.length).toBe(5);
  });

  it("paginates: page 1 cursor → page 2 with no overlap", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await postBody(validBody({ idempotencyKey: `p-${i}` }));
      ids.push(r.runId);
      await new Promise((r) => setTimeout(r, 2));
    }
    // DESC: ids[4], ids[3], …, ids[0].
    const expectedDesc = [...ids].reverse();

    const page1 = (await (await LIST(listReq("?limit=2"))).json()) as ListBody;
    expect(page1.runs.map((r) => r.runId)).toEqual(expectedDesc.slice(0, 2));
    expect(page1.nextCursor).toBe(expectedDesc[1]);

    const page2 = (await (await LIST(
      listReq(`?limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? "")}`),
    )).json()) as ListBody;
    expect(page2.runs.map((r) => r.runId)).toEqual(expectedDesc.slice(2, 4));

    // No overlap.
    const overlap = page2.runs.find((r) =>
      page1.runs.some((p) => p.runId === r.runId),
    );
    expect(overlap).toBeUndefined();
  });

  it("rejects an absurdly long cursor with 400", async () => {
    const res = await LIST(listReq(`?cursor=${"x".repeat(200)}`));
    expect(res.status).toBe(400);
  });

  it("403s on cross-site requests", async () => {
    const res = await LIST(
      listReq("", {
        "content-type": "application/json",
        "sec-fetch-site": "cross-site",
      }),
    );
    expect(res.status).toBe(403);
  });

  it("429s after the per-window threshold", async () => {
    const headers = {
      ...SAME_SITE,
      "x-forwarded-for": "203.0.113.99",
    };
    for (let i = 0; i < 10; i++) {
      const res = await LIST(listReq("", headers));
      expect(res.status).toBe(200);
    }
    const overflow = await LIST(listReq("", headers));
    expect(overflow.status).toBe(429);
  });

  it("PRIVACY: WHISTLE bundleUrl is REDACTED in the list payload", async () => {
    await postBody({
      pipeline: "bureau:whistle",
      payload: {
        bundleUrl: "https://leaked-host.example/bundle.json",
        category: "training-data",
        routingPartner: "propublica",
        anonymityCaveatAcknowledged: true,
        authorizationAcknowledged: true,
      },
    });

    const res = await LIST(listReq("?pipeline=bureau:whistle"));
    const body = (await res.json()) as ListBody;
    expect(body.runs.length).toBe(1);
    const first = body.runs[0]!;
    expect("bundleUrl" in first.payload).toBe(false);
    // Defense-in-depth — the URL must not appear ANYWHERE in the body.
    expect(JSON.stringify(body)).not.toContain("leaked-host.example");
    // Public-safe fields still present.
    expect(first.payload.routingPartner).toBe("propublica");
  });

  it("PRIVACY: WHISTLE manualRedactPhrase is REDACTED in the list payload", async () => {
    await postBody({
      pipeline: "bureau:whistle",
      payload: {
        bundleUrl: "https://example.com/bundle.json",
        category: "policy-violation",
        routingPartner: "bellingcat",
        manualRedactPhrase: "redact-internal-codename-zeus",
        anonymityCaveatAcknowledged: true,
        authorizationAcknowledged: true,
      },
    });

    const res = await LIST(listReq("?pipeline=bureau:whistle"));
    const body = (await res.json()) as ListBody;
    const first = body.runs[0]!;
    expect("manualRedactPhrase" in first.payload).toBe(false);
    expect(JSON.stringify(body)).not.toContain("zeus");
  });

  it("PRIVACY: ROTATE operatorNote is REDACTED in the list payload", async () => {
    await postBody({
      pipeline: "bureau:rotate",
      payload: {
        oldKeyFingerprint: "a".repeat(64),
        newKeyFingerprint: "b".repeat(64),
        reason: "compromised",
        operatorNote: "incident #99 — internal investigation IOCs follow",
        authorizationAcknowledged: true,
      },
    });

    const res = await LIST(listReq("?pipeline=bureau:rotate"));
    const body = (await res.json()) as ListBody;
    expect(body.runs.length).toBe(1);
    const first = body.runs[0]!;
    expect("operatorNote" in first.payload).toBe(false);
    expect(JSON.stringify(body)).not.toContain("incident #99");
    // Public-safe fields still present.
    expect(first.payload.reason).toBe("compromised");
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
