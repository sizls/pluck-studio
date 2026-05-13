// ---------------------------------------------------------------------------
// watch-store — unit tests for the in-memory stub
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WatchSpec } from "../../v1/watch-spec.js";
import {
  __resetForTests,
  __watchCount,
  archiveWatch,
  createWatch,
  getObservation,
  getWatch,
  listObservations,
  listWatches,
  pauseWatch,
  recordObservation,
  resumeWatch,
  subscribeToWatch,
  triggerWatch,
  updateWatch,
  type WatchEvent,
} from "../store.js";

beforeEach(() => {
  __resetForTests();
});
afterEach(() => {
  __resetForTests();
});

const baseSpec: WatchSpec = {
  name: "OpenAI pricing watch",
  url: "https://openai.com/pricing",
  cron: "@daily",
  intent:
    "Alert when GPT-4 input token price changes from its current value.",
  fetcherKind: "playwright",
  autonomyMode: "diff-gated",
  alertChannels: {
    dashboard: true,
    email: [],
    webhook: [],
    slack: [],
    phraseId: true,
  },
};

describe("createWatch", () => {
  it("creates a watch with defaults applied", () => {
    const { record, reused } = createWatch(baseSpec);
    expect(reused).toBe(false);
    expect(record.status).toBe("active");
    expect(record.confidenceThreshold).toBe(0.75);
    expect(record.diffThreshold).toBe(0.02);
    expect(record.dailyBudgetUsd).toBe(2.0);
    expect(record.receiptUrl).toBe(`/watch/${record.watchId}`);
    expect(record.watchId).toMatch(/openai/);
  });

  it("idempotency: same key + canonical spec returns same watchId", () => {
    const a = createWatch({ ...baseSpec, idempotencyKey: "k1" });
    const b = createWatch({ ...baseSpec, idempotencyKey: "k1" });
    expect(b.reused).toBe(true);
    expect(b.record.watchId).toBe(a.record.watchId);
    expect(__watchCount()).toBe(1);
  });

  it("idempotency: different key creates a fresh watch", () => {
    const a = createWatch({ ...baseSpec, idempotencyKey: "k1" });
    const b = createWatch({ ...baseSpec, idempotencyKey: "k2" });
    expect(b.reused).toBe(false);
    expect(b.record.watchId).not.toBe(a.record.watchId);
    expect(__watchCount()).toBe(2);
  });
});

describe("listWatches / getWatch", () => {
  it("returns empty list when no watches exist", () => {
    expect(listWatches().watches).toHaveLength(0);
  });

  it("hides archived watches by default", () => {
    const a = createWatch({ ...baseSpec, idempotencyKey: "a" }).record;
    createWatch({ ...baseSpec, idempotencyKey: "b" });
    archiveWatch(a.watchId);
    const list = listWatches();
    expect(list.watches).toHaveLength(1);
  });

  it("surfaces archived watches when explicitly filtered", () => {
    const a = createWatch({ ...baseSpec, idempotencyKey: "a" }).record;
    archiveWatch(a.watchId);
    const list = listWatches({ status: "archived" });
    expect(list.watches).toHaveLength(1);
    expect(list.watches[0]?.watchId).toBe(a.watchId);
  });

  it("getWatch returns null for missing IDs", () => {
    expect(getWatch("does-not-exist")).toBeNull();
  });
});

describe("updateWatch / pauseWatch / resumeWatch / archiveWatch", () => {
  it("pause flips status to paused", () => {
    const { record } = createWatch(baseSpec);
    const r = pauseWatch(record.watchId);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.record.status).toBe("paused");
    }
  });

  it("resume flips status back to active", () => {
    const { record } = createWatch(baseSpec);
    pauseWatch(record.watchId);
    const r = resumeWatch(record.watchId);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.record.status).toBe("active");
    }
  });

  it("archive rejects further updates", () => {
    const { record } = createWatch(baseSpec);
    archiveWatch(record.watchId);
    const r = updateWatch(record.watchId, { cron: "@hourly" });
    expect(r.kind).toBe("archived");
  });

  it("not-found update returns not-found", () => {
    const r = updateWatch("does-not-exist", { status: "paused" });
    expect(r.kind).toBe("not-found");
  });
});

describe("observations", () => {
  it("recordObservation appends to history and updates lastObservationId", () => {
    const { record } = createWatch(baseSpec);
    const obs = recordObservation({
      watchId: record.watchId,
      kind: "baseline",
      observation: {
        naturalLanguageSummary: "Initial state",
        reasoning: "First fetch",
        evidenceQuote: null,
        causalExplanation: null,
        extractedFields: {},
        classification: "unchanged",
        confidence: 0.5,
        alertWorthy: false,
        suggestedNextCheckMs: null,
      },
    });
    expect(obs).not.toBeNull();
    expect(obs?.phraseId).toMatch(/^pluck\/watch\//);

    const updated = getWatch(record.watchId);
    expect(updated?.lastObservationId).toBe(obs?.observationId);
    expect(updated?.lastFiredAt).not.toBeNull();
  });

  it("error observations do NOT advance lastObservationId", () => {
    const { record } = createWatch(baseSpec);
    const ok = recordObservation({
      watchId: record.watchId,
      kind: "baseline",
      observation: {
        naturalLanguageSummary: "Initial",
        reasoning: "Initial",
        evidenceQuote: null,
        causalExplanation: null,
        extractedFields: {},
        classification: "unchanged",
        confidence: 0.5,
        alertWorthy: false,
        suggestedNextCheckMs: null,
      },
    });
    recordObservation({
      watchId: record.watchId,
      kind: "error",
      observation: null,
      errorMessage: "timeout",
    });
    const updated = getWatch(record.watchId);
    expect(updated?.lastObservationId).toBe(ok?.observationId);
  });

  it("listObservations returns history newest-first", () => {
    const { record } = createWatch(baseSpec);
    const a = recordObservation({
      watchId: record.watchId,
      kind: "baseline",
      observation: null,
    });
    const b = recordObservation({
      watchId: record.watchId,
      kind: "observation",
      observation: null,
    });
    const { observations, totalCount } = listObservations(record.watchId);
    expect(totalCount).toBe(2);
    expect(observations[0]?.observationId).toBe(b?.observationId);
    expect(observations[1]?.observationId).toBe(a?.observationId);
  });

  it("getObservation returns the canonical record", () => {
    const { record } = createWatch(baseSpec);
    const obs = recordObservation({
      watchId: record.watchId,
      kind: "baseline",
      observation: null,
    });
    expect(getObservation(obs!.observationId)).toEqual(obs);
  });
});

describe("subscribeToWatch", () => {
  it("fires on state transitions", () => {
    const { record } = createWatch(baseSpec);
    const events: WatchEvent[] = [];
    const unsub = subscribeToWatch(record.watchId, (e) => events.push(e));
    expect(unsub).not.toBeNull();
    pauseWatch(record.watchId);
    resumeWatch(record.watchId);
    unsub!();
    expect(events.length).toBeGreaterThanOrEqual(2);
    const states = events.filter((e) => e.kind === "state");
    expect(states[states.length - 1]).toMatchObject({
      kind: "state",
      record: { status: "active" },
    });
  });

  it("fires on observation push", () => {
    const { record } = createWatch(baseSpec);
    const events: WatchEvent[] = [];
    subscribeToWatch(record.watchId, (e) => events.push(e));
    recordObservation({
      watchId: record.watchId,
      kind: "baseline",
      observation: null,
    });
    const obsEvents = events.filter((e) => e.kind === "observation");
    expect(obsEvents).toHaveLength(1);
  });

  it("unsubscribe stops future events", () => {
    const { record } = createWatch(baseSpec);
    let count = 0;
    const unsub = subscribeToWatch(record.watchId, () => {
      count += 1;
    });
    expect(unsub).not.toBeNull();
    pauseWatch(record.watchId);
    expect(count).toBeGreaterThan(0);
    const seen = count;
    unsub!();
    resumeWatch(record.watchId);
    expect(count).toBe(seen);
  });
});

describe("triggerWatch (Week-1 mock)", () => {
  it("does a one-shot fetch and writes a baseline observation", async () => {
    const { record } = createWatch(baseSpec);
    const mockFetch = vi.fn(async () =>
      new Response("hello world", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );
    const r = await triggerWatch(record.watchId, mockFetch as typeof fetch);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.observation.kind).toBe("baseline");
      expect(r.observation.observation?.extractedFields.bytes).toBe(11);
    }
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("emits an error observation on fetch failure", async () => {
    const { record } = createWatch(baseSpec);
    const mockFetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const r = await triggerWatch(record.watchId, mockFetch as typeof fetch);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.observation.kind).toBe("error");
      expect(r.observation.errorMessage).toMatch(/network down/);
    }
    const after = getWatch(record.watchId);
    expect(after?.status).toBe("failed");
  });

  it("rejects trigger on paused watches", async () => {
    const { record } = createWatch(baseSpec);
    pauseWatch(record.watchId);
    const r = await triggerWatch(record.watchId);
    expect(r.kind).toBe("not-active");
  });

  it("returns not-found for unknown watchId", async () => {
    const r = await triggerWatch("does-not-exist");
    expect(r.kind).toBe("not-found");
  });

  it("enforces per-watch cooldown after a successful trigger", async () => {
    const { record } = createWatch(baseSpec);
    const mockFetch = vi.fn(async () => new Response("ok", { status: 200 }));
    const t0 = 1_000_000;
    const ok = await triggerWatch(record.watchId, mockFetch as typeof fetch, t0);
    expect(ok.kind).toBe("ok");
    // Within cooldown window → cooldown.
    const blocked = await triggerWatch(
      record.watchId,
      mockFetch as typeof fetch,
      t0 + 1_000,
    );
    expect(blocked.kind).toBe("cooldown");
    if (blocked.kind === "cooldown") {
      expect(blocked.waitMs).toBeGreaterThan(0);
    }
    // After the window → succeeds.
    const after = await triggerWatch(
      record.watchId,
      mockFetch as typeof fetch,
      t0 + 30_000,
    );
    expect(after.kind).toBe("ok");
  });

  it("blocks a redirect to a private IP (SSRF defense)", async () => {
    const { record } = createWatch(baseSpec);
    const mockFetch = vi.fn(async () =>
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      }),
    );
    const r = await triggerWatch(record.watchId, mockFetch as typeof fetch);
    expect(r.kind).toBe("ok"); // emits error observation, not not-found
    if (r.kind === "ok") {
      expect(r.observation.kind).toBe("error");
      expect(r.observation.errorMessage).toMatch(/redirect blocked/);
    }
  });

  it("follows safe redirects up to the cap", async () => {
    const { record } = createWatch(baseSpec);
    let hop = 0;
    const mockFetch = vi.fn(async () => {
      hop += 1;
      if (hop === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://example.org/redirected" },
        });
      }
      return new Response("final content", { status: 200 });
    });
    const r = await triggerWatch(record.watchId, mockFetch as typeof fetch);
    expect(r.kind).toBe("ok");
    if (r.kind === "ok") {
      expect(r.observation.kind).toBe("baseline");
    }
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("recordObservation — per-watch FIFO", () => {
  it("evicts a noisy watch's own oldest, not a quiet watch's baseline", () => {
    const a = createWatch({ ...baseSpec, idempotencyKey: "a", name: "A" }).record;
    const b = createWatch({ ...baseSpec, idempotencyKey: "b", name: "B" }).record;
    const aBaseline = recordObservation({
      watchId: a.watchId,
      kind: "baseline",
      observation: null,
    });
    expect(aBaseline).not.toBeNull();
    for (let i = 0; i < 250; i += 1) {
      recordObservation({
        watchId: b.watchId,
        kind: "observation",
        observation: null,
      });
    }
    const aHistory = listObservations(a.watchId, 5);
    expect(aHistory.observations).toHaveLength(1);
    expect(aHistory.observations[0]?.observationId).toBe(aBaseline!.observationId);
  });
});

describe("recordObservation — error observations have null prevObservationId", () => {
  it("error observations do not chain to the prior successful run", () => {
    const { record } = createWatch(baseSpec);
    const ok = recordObservation({
      watchId: record.watchId,
      kind: "baseline",
      observation: null,
    });
    const err = recordObservation({
      watchId: record.watchId,
      kind: "error",
      observation: null,
      errorMessage: "timeout",
    });
    expect(ok?.prevObservationId).toBeNull();
    expect(err?.prevObservationId).toBeNull();
  });
});
