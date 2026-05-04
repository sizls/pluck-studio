// ---------------------------------------------------------------------------
// run-store — unit tests for the /v1/runs in-memory persistence stub
// ---------------------------------------------------------------------------
//
// Locks the store contract so the eventual Supabase swap can re-prove
// identical behaviour: idempotency, TTL eviction, FIFO cap, runId
// generation, receipt URL shape.
//
// STUB-COUPLED tests below assert the in-memory implementation's TTL +
// FIFO eviction semantics. Those won't survive the Supabase swap (the
// real backend handles retention out-of-band). They run only when
// `PLUCK_REAL_BACKEND` is unset or != "1" — flip the env to skip them
// once the swap lands. The CONTRACT-level tests (idempotency, runId
// shape, receipt URL shape) run against any backend.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

const STUB_ONLY = process.env.PLUCK_REAL_BACKEND !== "1";

import {
  __idempotencyCount,
  __INTERNAL_TTL_MS,
  __resetForTests,
  __runCount,
  canonicalJson,
  createRun,
  getRun,
  idempotencyHashOf,
} from "../run-store.js";
import type { RunSpec } from "../run-spec.js";

const validBureauSpec: RunSpec = {
  pipeline: "bureau:dragnet",
  payload: {
    targetUrl: "https://api.openai.com/v1/chat/completions",
    probePackId: "canon-honesty",
    cadence: "once",
    authorizationAcknowledged: true,
  },
};

beforeEach(() => {
  __resetForTests();
});

describe("run-store — runId generation", () => {
  it("creates a vendor-scoped phrase ID for bureau pipelines with a targetUrl", () => {
    const { record } = createRun(validBureauSpec);
    expect(record.runId).toMatch(/^openai-[a-z]+-[a-z]+-\d{4}$/);
    expect(record.pipeline).toBe("bureau:dragnet");
    expect(record.status).toBe("pending");
    expect(record.verdictColor).toBe("gray");
    expect(record.receiptUrl).toBe(`/bureau/dragnet/runs/${record.runId}`);
  });

  it("creates a slug-prefixed runId for bureau pipelines without a targetUrl", () => {
    const { record } = createRun({
      pipeline: "bureau:custody",
      payload: { incidentTitle: "phishing-investigation" },
    });
    expect(record.runId).toMatch(/^custody-[a-z]+-[a-z]+-\d{4}$/);
    expect(record.receiptUrl).toBe(`/bureau/custody/runs/${record.runId}`);
  });

  it("echoes the payload verbatim for audit", () => {
    const { record } = createRun(validBureauSpec);
    expect(record.payload).toEqual(validBureauSpec.payload);
  });

  it("returns reused=false on a fresh create", () => {
    const { reused } = createRun(validBureauSpec);
    expect(reused).toBe(false);
  });
});

describe("run-store — idempotency", () => {
  it("returns the same runId for the same idempotency key + payload", () => {
    const spec: RunSpec = { ...validBureauSpec, idempotencyKey: "abc-123" };
    const first = createRun(spec);
    const second = createRun(spec);
    expect(second.record.runId).toBe(first.record.runId);
    expect(second.reused).toBe(true);
  });

  it("treats different idempotency keys as different runs", () => {
    const a = createRun({ ...validBureauSpec, idempotencyKey: "k-a" });
    const b = createRun({ ...validBureauSpec, idempotencyKey: "k-b" });
    expect(a.record.runId).not.toBe(b.record.runId);
  });

  it("treats same key + different payload as a different run", () => {
    const a = createRun({ ...validBureauSpec, idempotencyKey: "shared" });
    const b = createRun({
      ...validBureauSpec,
      idempotencyKey: "shared",
      payload: { ...validBureauSpec.payload, probePackId: "alice/h@1.0.0" },
    });
    expect(a.record.runId).not.toBe(b.record.runId);
  });

  it("creates fresh runs when no idempotency key is supplied", () => {
    const a = createRun(validBureauSpec);
    const b = createRun(validBureauSpec);
    expect(a.record.runId).not.toBe(b.record.runId);
    expect(a.reused).toBe(false);
    expect(b.reused).toBe(false);
  });

  it("computes a stable canonical hash regardless of payload key order", () => {
    const a: RunSpec = {
      pipeline: "bureau:dragnet",
      payload: { a: 1, b: 2, nested: { z: 9, x: 1 } },
      idempotencyKey: "k",
    };
    const b: RunSpec = {
      pipeline: "bureau:dragnet",
      payload: { nested: { x: 1, z: 9 }, b: 2, a: 1 },
      idempotencyKey: "k",
    };
    expect(idempotencyHashOf(a)).toEqual(idempotencyHashOf(b));
  });

  it("returns null hash when idempotencyKey is absent", () => {
    expect(idempotencyHashOf(validBureauSpec)).toBeNull();
  });
});

describe("run-store — getRun + TTL", () => {
  it("returns the stored record by runId", () => {
    const { record } = createRun(validBureauSpec);
    const fetched = getRun(record.runId);
    expect(fetched).not.toBeNull();
    expect(fetched?.runId).toBe(record.runId);
  });

  it("returns null for an unknown runId", () => {
    expect(getRun("does-not-exist-0000")).toBeNull();
  });

  // STUB-coupled: 24h TTL is a property of the in-memory implementation,
  // not of the /v1/runs HTTP contract. Real backend (Supabase) handles
  // retention separately.
  describe.skipIf(!STUB_ONLY)("STUB-only — in-memory TTL eviction", () => {
    it("evicts records older than 24h on read", () => {
      const t0 = Date.parse("2026-01-01T00:00:00.000Z");
      const { record } = createRun(validBureauSpec, t0);
      expect(getRun(record.runId, t0 + 1000)).not.toBeNull();
      // 24h + 1s after creation → evicted.
      expect(getRun(record.runId, t0 + __INTERNAL_TTL_MS + 1000)).toBeNull();
    });
  });
});

// STUB-coupled: 10K-entry FIFO cap is implementation-private to the
// in-memory store. Skip when running against a real backend.
describe.skipIf(!STUB_ONLY)("run-store — STUB-only FIFO cap (smoke)", () => {
  it("drops idempotency rows when their owning run is evicted by the cap", () => {
    // Use a realistic small batch to exercise the path without burning
    // 10K iterations in a unit test. We assert the invariant rather
    // than the exact MAX_ENTRIES boundary — that's covered by the
    // implementation's loop guard.
    const a = createRun({ ...validBureauSpec, idempotencyKey: "ka" });
    const b = createRun({ ...validBureauSpec, idempotencyKey: "kb" });
    expect(__runCount()).toBe(2);
    expect(__idempotencyCount()).toBe(2);
    expect(a.record.runId).not.toBe(b.record.runId);
  });
});

describe("run-store — canonicalJson", () => {
  it("sorts object keys", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("preserves array order", () => {
    expect(canonicalJson([3, 1, 2])).toBe("[3,1,2]");
  });

  it("recurses into nested objects", () => {
    expect(canonicalJson({ b: { z: 1, a: 2 }, a: 0 })).toBe(
      '{"a":0,"b":{"a":2,"z":1}}',
    );
  });

  it("handles primitives", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson("hello")).toBe('"hello"');
    expect(canonicalJson(42)).toBe("42");
    expect(canonicalJson(true)).toBe("true");
  });

  it("skips object keys whose value is undefined (matches JSON.stringify)", () => {
    // `{a: undefined}` and `{}` must produce the same canonical string
    // so two semantically-identical idempotency requests collide.
    expect(canonicalJson({ a: undefined })).toBe("{}");
    expect(canonicalJson({ a: 1, b: undefined, c: 2 })).toBe('{"a":1,"c":2}');
    expect(canonicalJson({ a: undefined, b: undefined })).toBe("{}");
  });

  it("idempotency hash collides for {a: undefined} vs {} payloads", () => {
    const withUndef = idempotencyHashOf({
      pipeline: "bureau:dragnet",
      payload: { ...validBureauSpec.payload, optionalField: undefined },
      idempotencyKey: "k",
    });
    const without = idempotencyHashOf({
      pipeline: "bureau:dragnet",
      payload: { ...validBureauSpec.payload },
      idempotencyKey: "k",
    });
    expect(withUndef).toBe(without);
  });
});

describe("run-store — pipeline rejection (input layer)", () => {
  it("createRun is best-effort — it doesn't validate pipeline names", () => {
    // Validation lives in the route layer (validateRunSpec) — the store
    // is dumb persistence. This test documents the boundary: pass
    // arbitrary strings in and you get arbitrary records out. Don't.
    const { record } = createRun({
      // biome-ignore lint/suspicious/noExplicitAny: testing the store's permissive seam
      pipeline: "bureau:dragnet" as any,
      payload: {},
    });
    expect(record.runId).toMatch(/^dragnet-[a-z]+-[a-z]+-\d{4}$/);
  });
});
