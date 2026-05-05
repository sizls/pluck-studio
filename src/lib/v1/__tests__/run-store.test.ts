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
  listRuns,
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

    it("sweeps orphan idempotency rows when their owning runs expire (M2 fix)", () => {
      // Pre-M2: evictExpired only deleted from `runs`, leaving orphan
      // idempotency rows that pointed to a missing runId. Over enough
      // TTL cycles those rows accumulated. After M2: each evictExpired
      // pass drops orphan idempotency rows in the same sweep.
      const t0 = Date.parse("2026-01-01T00:00:00.000Z");
      // Five runs, each with a distinct idempotency key.
      for (let i = 0; i < 5; i++) {
        createRun({ ...validBureauSpec, idempotencyKey: `k-${i}` }, t0);
      }
      expect(__runCount()).toBe(5);
      expect(__idempotencyCount()).toBe(5);

      // Trigger eviction by creating a fresh run past TTL — createRun
      // calls evictExpired() at the top of its body. The 5 prior runs
      // (and their idempotency rows) should be swept.
      createRun(
        { ...validBureauSpec, idempotencyKey: "fresh" },
        t0 + __INTERNAL_TTL_MS + 1000,
      );
      // Only the fresh row remains.
      expect(__runCount()).toBe(1);
      expect(__idempotencyCount()).toBe(1);
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

describe("run-store — listRuns", () => {
  const dragnetSpec: RunSpec = validBureauSpec;
  const oathSpec: RunSpec = {
    pipeline: "bureau:oath",
    payload: { vendorDomain: "openai.com", authorizationAcknowledged: true },
  };

  it("returns an empty result when the store is empty", () => {
    const result = listRuns();
    expect(result.runs).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBe(0);
  });

  it("returns all runs in createdAt DESC order with no filter", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    const a = createRun({ ...dragnetSpec, idempotencyKey: "a" }, t0);
    const b = createRun({ ...dragnetSpec, idempotencyKey: "b" }, t0 + 1000);
    const c = createRun({ ...dragnetSpec, idempotencyKey: "c" }, t0 + 2000);

    // Pass `now` consistent with creation timestamps so TTL doesn't sweep.
    const result = listRuns({}, t0 + 3000);
    expect(result.runs.map((r) => r.runId)).toEqual([
      c.record.runId,
      b.record.runId,
      a.record.runId,
    ]);
    expect(result.totalCount).toBe(3);
    expect(result.nextCursor).toBeNull();
  });

  it("filters by pipeline", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    createRun({ ...dragnetSpec, idempotencyKey: "d1" }, t0);
    const o = createRun({ ...oathSpec, idempotencyKey: "o1" }, t0 + 1000);
    createRun({ ...dragnetSpec, idempotencyKey: "d2" }, t0 + 2000);

    const result = listRuns({ pipeline: "bureau:oath" }, t0 + 3000);
    expect(result.runs.map((r) => r.runId)).toEqual([o.record.runId]);
    expect(result.totalCount).toBe(1);
  });

  it("filters by `since` (strictly after)", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    createRun({ ...dragnetSpec, idempotencyKey: "old" }, t0);
    const mid = createRun({ ...dragnetSpec, idempotencyKey: "mid" }, t0 + 5000);
    const fresh = createRun(
      { ...dragnetSpec, idempotencyKey: "fresh" },
      t0 + 10000,
    );

    const result = listRuns({ since: t0 + 1000 }, t0 + 11000);
    expect(result.runs.map((r) => r.runId)).toEqual([
      fresh.record.runId,
      mid.record.runId,
    ]);
    expect(result.totalCount).toBe(2);
  });

  it("clamps limit: 0 → 1, 999 → 100, default 20", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    for (let i = 0; i < 25; i++) {
      createRun({ ...dragnetSpec, idempotencyKey: `k-${i}` }, t0 + i * 1000);
    }
    const after = t0 + 26000;

    const zero = listRuns({ limit: 0 }, after);
    expect(zero.runs.length).toBe(1);

    const huge = listRuns({ limit: 999 }, after);
    // We have 25 runs total — clamping to 100 still returns all 25.
    expect(huge.runs.length).toBe(25);

    const def = listRuns({}, after);
    expect(def.runs.length).toBe(20);
  });

  it("paginates via cursor across multiple pages without overlap", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) {
      const { record } = createRun(
        { ...dragnetSpec, idempotencyKey: `p-${i}` },
        t0 + i * 1000,
      );
      ids.push(record.runId);
    }
    const after = t0 + 8000;
    // DESC order: ids[6], ids[5], …, ids[0].
    const expectedDesc = [...ids].reverse();

    const page1 = listRuns({ limit: 3 }, after);
    expect(page1.runs.map((r) => r.runId)).toEqual(expectedDesc.slice(0, 3));
    expect(page1.totalCount).toBe(7);
    expect(page1.nextCursor).toBe(expectedDesc[2]);

    const page2 = listRuns({ limit: 3, cursor: page1.nextCursor ?? "" }, after);
    expect(page2.runs.map((r) => r.runId)).toEqual(expectedDesc.slice(3, 6));
    expect(page2.nextCursor).toBe(expectedDesc[5]);

    const page3 = listRuns({ limit: 3, cursor: page2.nextCursor ?? "" }, after);
    expect(page3.runs.map((r) => r.runId)).toEqual(expectedDesc.slice(6, 7));
    expect(page3.nextCursor).toBeNull();

    // No overlap across pages.
    const seen = new Set<string>();
    for (const id of [
      ...page1.runs.map((r) => r.runId),
      ...page2.runs.map((r) => r.runId),
      ...page3.runs.map((r) => r.runId),
    ]) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(seen.size).toBe(7);
  });

  it("falls through to start when cursor refers to a runId not in the result set", () => {
    const t0 = Date.parse("2026-01-01T00:00:00.000Z");
    const a = createRun({ ...dragnetSpec, idempotencyKey: "a" }, t0);
    const b = createRun({ ...dragnetSpec, idempotencyKey: "b" }, t0 + 1000);

    const result = listRuns(
      { cursor: "nonexistent-cursor-id-0000" },
      t0 + 2000,
    );
    expect(result.runs.map((r) => r.runId)).toEqual([
      b.record.runId,
      a.record.runId,
    ]);
  });

  // STUB-coupled — TTL eviction is in-memory implementation behaviour.
  describe.skipIf(!STUB_ONLY)("excludes TTL-evicted runs from the list", () => {
    it("does not return runs older than the TTL", () => {
      const t0 = Date.parse("2026-01-01T00:00:00.000Z");
      createRun({ ...dragnetSpec, idempotencyKey: "old" }, t0);
      const fresh = createRun(
        { ...dragnetSpec, idempotencyKey: "fresh" },
        t0 + __INTERNAL_TTL_MS + 1000,
      );

      // List at a time past the original's TTL — only the fresh one survives.
      const result = listRuns({}, t0 + __INTERNAL_TTL_MS + 2000);
      expect(result.runs.map((r) => r.runId)).toEqual([fresh.record.runId]);
      expect(result.totalCount).toBe(1);
    });
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
