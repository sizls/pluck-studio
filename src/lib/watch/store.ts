// ---------------------------------------------------------------------------
// /v1/watches — in-memory store (STUB)
// ---------------------------------------------------------------------------
//
// !! STUB !!
//
// Week-1 persistence for /v1/watches. Replaced in Week-2 by Supabase + a
// long-running Node worker (pluck-watch-worker) that owns the canonical
// Directive runtime system. The PUBLIC API of this module (createWatch,
// getWatch, listWatches, pauseWatch, resumeWatch, archiveWatch,
// triggerWatch, subscribeToWatch, recordObservation) is what the rest of
// Studio binds against — keep that signature stable across the swap.
//
// Properties of this stub the real backend MUST preserve:
//   - Idempotency: same canonical (url, intent, cron, idempotencyKey)
//     returns the same watchId on retried POSTs.
//   - Receipt URL: receiptUrl == /watch/<watchId>, one-to-one.
//   - Pub/sub: subscribeToWatch fires on every state transition or new
//     observation. Maps to Supabase Realtime channels in Week-2.
//
// What this stub does NOT do:
//   - Schedule. No cron tick loop. Watches sit at status=active until
//     manually triggered via /api/v1/watches/[id]/trigger. The Worker
//     owns the ticker.
//   - Run an agent. triggerWatch() does a one-shot fetch() against the
//     URL and emits a MOCK observation so the UI loop is end-to-end
//     testable before the agent ships.
//   - Persist across restart. Module-scoped Map, globalThis-pinned for
//     Next.js HMR survivability — same pattern as run-store.ts.
//
// DIFFERENCES vs run-store.ts:
//   - No TTL: watches persist until archived. (Runs auto-evict at 24h.)
//   - FIFO cap is on watch COUNT (default 10K), not age. Eviction is
//     archive-status-aware: oldest archived first, then oldest active.
//   - Observations live in a sibling Map keyed by observationId, with
//     per-watch reverse index for history queries.
// ---------------------------------------------------------------------------

import { createHash, randomBytes, randomUUID } from "node:crypto";

import { generateScopedPhraseId } from "../phrase-id";
import {
  type AlertChannels,
  type Observation,
  type ObservationKind,
  type ObservationRecord,
  WATCH_DEFAULTS,
  type WatchRecord,
  type WatchSpec,
  type WatchStatus,
  type WatchUpdate,
} from "../v1/watch-spec";

// ---------------------------------------------------------------------------
// Storage — globalThis-pinned Maps for HMR survivability
// ---------------------------------------------------------------------------

const MAX_WATCHES = 10_000;
const MAX_OBSERVATIONS = 50_000;

declare global {
  // eslint-disable-next-line no-var
  var __pluckStudioV1WatchStore: Map<string, WatchRecord> | undefined;
  // eslint-disable-next-line no-var
  var __pluckStudioV1WatchIdempotency: Map<string, string> | undefined;
  // eslint-disable-next-line no-var
  var __pluckStudioV1WatchObservations:
    | Map<string, ObservationRecord>
    | undefined;
  // eslint-disable-next-line no-var
  var __pluckStudioV1WatchObservationIndex:
    | Map<string, string[]>
    | undefined;
  // eslint-disable-next-line no-var
  var __pluckStudioV1WatchSubscribers:
    | Map<string, Set<WatchSubscriber>>
    | undefined;
}

const watches: Map<string, WatchRecord> =
  (globalThis.__pluckStudioV1WatchStore ??= new Map<string, WatchRecord>());
const idempotency: Map<string, string> =
  (globalThis.__pluckStudioV1WatchIdempotency ??= new Map<string, string>());
const observations: Map<string, ObservationRecord> =
  (globalThis.__pluckStudioV1WatchObservations ??= new Map<
    string,
    ObservationRecord
  >());
/** watchId -> [observationId in reverse chronological order]. */
const observationIndex: Map<string, string[]> =
  (globalThis.__pluckStudioV1WatchObservationIndex ??= new Map<
    string,
    string[]
  >());

// ---------------------------------------------------------------------------
// Pub/sub — drives the SSE endpoint at GET /api/v1/watches/[id]/events
// ---------------------------------------------------------------------------

export type WatchEvent =
  | { kind: "state"; record: WatchRecord }
  | { kind: "observation"; record: ObservationRecord }
  | { kind: "alert"; observationId: string; channel: string; status: string };

export type WatchSubscriber = (event: WatchEvent) => void;

const SUBSCRIBERS_PER_WATCH_CAP = 100;

const subscribers: Map<string, Set<WatchSubscriber>> =
  (globalThis.__pluckStudioV1WatchSubscribers ??= new Map<
    string,
    Set<WatchSubscriber>
  >());

export function subscribeToWatch(
  watchId: string,
  cb: WatchSubscriber,
): () => void {
  let set = subscribers.get(watchId);
  if (set === undefined) {
    set = new Set();
    subscribers.set(watchId, set);
  }
  if (set.size >= SUBSCRIBERS_PER_WATCH_CAP) {
    throw new Error(
      `[watch-store] subscriber cap (${SUBSCRIBERS_PER_WATCH_CAP}) reached for watchId=${watchId}`,
    );
  }
  set.add(cb);

  return () => {
    const live = subscribers.get(watchId);
    if (live === undefined) {
      return;
    }
    live.delete(cb);
    if (live.size === 0) {
      subscribers.delete(watchId);
    }
  };
}

function publish(watchId: string, event: WatchEvent): void {
  const set = subscribers.get(watchId);
  if (set === undefined || set.size === 0) {
    return;
  }
  const snapshot = Array.from(set);
  for (const cb of snapshot) {
    try {
      cb(event);
    } catch (err) {
      set.delete(cb);
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[watch-store] subscriber threw, removing:", err);
      }
    }
  }
  if (set.size === 0) {
    subscribers.delete(watchId);
  }
}

// ---------------------------------------------------------------------------
// Idempotency
// ---------------------------------------------------------------------------

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const parts = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`,
  );

  return `{${parts.join(",")}}`;
}

function idempotencyHashOf(spec: WatchSpec): string | null {
  if (spec.idempotencyKey === undefined) {
    return null;
  }
  // Hash a stable subset of the spec — fields the operator might
  // legitimately tweak post-create (cron, channels, thresholds) are
  // excluded so a retry with the same key still collapses. `name` is
  // included so two watches against the same URL with different labels
  // do not collide (and tests that share a minute-bucket idempotency
  // key with distinct names stay separate, matching operator intuition).
  const canonical = canonicalJson({
    name: spec.name,
    url: spec.url,
    intent: spec.intent,
    fetcherKind: spec.fetcherKind,
    idempotencyKey: spec.idempotencyKey,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

// ---------------------------------------------------------------------------
// Phrase ID generation
// ---------------------------------------------------------------------------

/**
 * Watch IDs reuse the scoped phrase-id helper so the receipt URL self-
 * discloses the vendor. Symmetric with Bureau program runIds.
 */
function uniqueWatchId(url: string): string {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateScopedPhraseId(url);
    if (!watches.has(candidate)) {
      return candidate;
    }
  }
  const tail = randomBytes(4).toString("hex");

  return `${generateScopedPhraseId(url)}-${tail}`;
}

/**
 * Observation phrase-id format:
 *   pluck/watch/<watchId>/<YYYY-MM-DD>/observation-<NN>
 *
 * Deterministic per-day sequence so two observations on the same day
 * sort lexicographically. NN is zero-padded by current daily count.
 */
function generateObservationPhraseId(watchId: string, now: Date): string {
  const ymd = now.toISOString().slice(0, 10);
  const dayPrefix = `pluck/watch/${watchId}/${ymd}/observation-`;
  const ids = observationIndex.get(watchId) ?? [];
  let seq = 1;
  for (const obsId of ids) {
    const obs = observations.get(obsId);
    if (obs !== undefined && obs.phraseId.startsWith(dayPrefix)) {
      seq += 1;
    }
  }
  const padded = String(seq).padStart(2, "0");

  return `${dayPrefix}${padded}`;
}

// ---------------------------------------------------------------------------
// FIFO cap enforcement
// ---------------------------------------------------------------------------

function enforceWatchCap(): void {
  if (watches.size < MAX_WATCHES) {
    return;
  }
  // Evict archived first, then any other status. Map iteration order is
  // insertion order so "oldest first" falls out for free.
  const archivedKeys: string[] = [];
  const otherKeys: string[] = [];
  for (const [id, record] of watches) {
    if (record.status === "archived") {
      archivedKeys.push(id);
    } else {
      otherKeys.push(id);
    }
  }
  const eviction = archivedKeys.length > 0 ? archivedKeys[0] : otherKeys[0];
  if (eviction === undefined) {
    return;
  }
  watches.delete(eviction);
  // Drop idempotency rows pointing at the evicted watch.
  for (const [hash, watchId] of idempotency) {
    if (watchId === eviction) {
      idempotency.delete(hash);
    }
  }
  // Drop observation history.
  const obsIds = observationIndex.get(eviction) ?? [];
  for (const obsId of obsIds) {
    observations.delete(obsId);
  }
  observationIndex.delete(eviction);
}

function enforceObservationCap(): void {
  while (observations.size > MAX_OBSERVATIONS) {
    const oldest = observations.keys().next().value;
    if (oldest === undefined) {
      return;
    }
    const obs = observations.get(oldest);
    observations.delete(oldest);
    if (obs !== undefined) {
      const idx = observationIndex.get(obs.watchId);
      if (idx !== undefined) {
        const filtered = idx.filter((id) => id !== oldest);
        if (filtered.length === 0) {
          observationIndex.delete(obs.watchId);
        } else {
          observationIndex.set(obs.watchId, filtered);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// createWatch
// ---------------------------------------------------------------------------

export interface CreateWatchResult {
  readonly record: WatchRecord;
  /** True on idempotency replay. */
  readonly reused: boolean;
}

function nowIso(now: number): string {
  return new Date(now).toISOString();
}

function normalizeChannels(c: AlertChannels): AlertChannels {
  return {
    dashboard: c.dashboard,
    email: [...c.email],
    webhook: [...c.webhook],
    slack: [...c.slack],
    phraseId: c.phraseId,
  };
}

export function createWatch(
  spec: WatchSpec,
  now: number = Date.now(),
): CreateWatchResult {
  const idHash = idempotencyHashOf(spec);
  if (idHash !== null) {
    const existingId = idempotency.get(idHash);
    if (existingId !== undefined) {
      const existing = watches.get(existingId);
      if (existing !== undefined && existing.status !== "archived") {
        return { record: existing, reused: true };
      }
      idempotency.delete(idHash);
    }
  }

  enforceWatchCap();

  const watchId = uniqueWatchId(spec.url);
  const iso = nowIso(now);
  const record: WatchRecord = {
    watchId,
    name: spec.name,
    url: spec.url,
    cron: spec.cron,
    intent: spec.intent,
    fetcherKind: spec.fetcherKind,
    autonomyMode: spec.autonomyMode,
    alertChannels: normalizeChannels(spec.alertChannels),
    status: "active",
    confidenceThreshold:
      spec.confidenceThreshold ?? WATCH_DEFAULTS.confidenceThreshold,
    diffThreshold: spec.diffThreshold ?? WATCH_DEFAULTS.diffThreshold,
    ignoreSelectors: spec.ignoreSelectors ? [...spec.ignoreSelectors] : [],
    useVisionDefault:
      spec.useVisionDefault ?? WATCH_DEFAULTS.useVisionDefault,
    dailyBudgetUsd: spec.dailyBudgetUsd ?? WATCH_DEFAULTS.dailyBudgetUsd,
    agentTokensSpentTotal: 0,
    agentCostUsdTotal: 0,
    lastObservationId: null,
    lastFiredAt: null,
    receiptUrl: `/watch/${watchId}`,
    createdAt: iso,
    updatedAt: iso,
  };

  watches.set(watchId, record);
  if (idHash !== null) {
    idempotency.set(idHash, watchId);
  }
  publish(watchId, { kind: "state", record });

  return { record, reused: false };
}

// ---------------------------------------------------------------------------
// Read APIs
// ---------------------------------------------------------------------------

export function getWatch(watchId: string): WatchRecord | null {
  return watches.get(watchId) ?? null;
}

export interface ListWatchesFilter {
  readonly status?: WatchStatus | ReadonlyArray<WatchStatus>;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ListWatchesResult {
  readonly watches: ReadonlyArray<WatchRecord>;
  readonly nextCursor: string | null;
  readonly totalCount: number;
}

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return DEFAULT_LIST_LIMIT;
  }
  const n = Math.floor(raw);
  if (n < 1) {
    return 1;
  }
  if (n > MAX_LIST_LIMIT) {
    return MAX_LIST_LIMIT;
  }

  return n;
}

export function listWatches(
  filter: ListWatchesFilter = {},
): ListWatchesResult {
  const limit = clampLimit(filter.limit);
  const statusSet =
    filter.status === undefined
      ? null
      : new Set(Array.isArray(filter.status) ? filter.status : [filter.status]);

  const matched: WatchRecord[] = [];
  for (const record of watches.values()) {
    if (statusSet !== null && !statusSet.has(record.status)) {
      continue;
    }
    // Hide archived from default list — operators opt-in explicitly.
    if (statusSet === null && record.status === "archived") {
      continue;
    }
    matched.push(record);
  }

  matched.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    if (a.watchId === b.watchId) {
      return 0;
    }

    return a.watchId < b.watchId ? 1 : -1;
  });

  const totalCount = matched.length;
  let startIndex = 0;
  if (filter.cursor !== undefined && filter.cursor.length > 0) {
    const idx = matched.findIndex((w) => w.watchId === filter.cursor);
    if (idx >= 0) {
      startIndex = idx + 1;
    }
  }
  const page = matched.slice(startIndex, startIndex + limit);
  const last = page.length > 0 ? page[page.length - 1] : undefined;
  const nextCursor =
    last !== undefined && startIndex + limit < matched.length
      ? last.watchId
      : null;

  return { watches: page, nextCursor, totalCount };
}

// ---------------------------------------------------------------------------
// Update APIs
// ---------------------------------------------------------------------------

export type UpdateResult =
  | { kind: "ok"; record: WatchRecord }
  | { kind: "not-found" }
  | { kind: "archived" };

export function updateWatch(
  watchId: string,
  update: WatchUpdate,
  now: number = Date.now(),
): UpdateResult {
  const existing = watches.get(watchId);
  if (existing === undefined) {
    return { kind: "not-found" };
  }
  if (existing.status === "archived") {
    return { kind: "archived" };
  }

  const next: WatchRecord = {
    ...existing,
    ...(update.name !== undefined ? { name: update.name } : {}),
    ...(update.cron !== undefined ? { cron: update.cron } : {}),
    ...(update.autonomyMode !== undefined
      ? { autonomyMode: update.autonomyMode }
      : {}),
    ...(update.alertChannels !== undefined
      ? { alertChannels: normalizeChannels(update.alertChannels) }
      : {}),
    ...(update.status !== undefined ? { status: update.status } : {}),
    ...(update.confidenceThreshold !== undefined
      ? { confidenceThreshold: update.confidenceThreshold }
      : {}),
    ...(update.diffThreshold !== undefined
      ? { diffThreshold: update.diffThreshold }
      : {}),
    ...(update.ignoreSelectors !== undefined
      ? { ignoreSelectors: [...update.ignoreSelectors] }
      : {}),
    ...(update.useVisionDefault !== undefined
      ? { useVisionDefault: update.useVisionDefault }
      : {}),
    ...(update.dailyBudgetUsd !== undefined
      ? { dailyBudgetUsd: update.dailyBudgetUsd }
      : {}),
    updatedAt: nowIso(now),
  };
  watches.set(watchId, next);
  publish(watchId, { kind: "state", record: next });

  return { kind: "ok", record: next };
}

export function pauseWatch(watchId: string, now?: number): UpdateResult {
  return updateWatch(watchId, { status: "paused" }, now);
}

export function resumeWatch(watchId: string, now?: number): UpdateResult {
  return updateWatch(watchId, { status: "active" }, now);
}

export function archiveWatch(watchId: string, now?: number): UpdateResult {
  return updateWatch(watchId, { status: "archived" }, now);
}

// ---------------------------------------------------------------------------
// Observations
// ---------------------------------------------------------------------------

export interface RecordObservationInput {
  readonly watchId: string;
  readonly kind: ObservationKind;
  readonly observation: Observation | null;
  readonly errorMessage?: string | null;
  readonly agentTokensUsed?: number;
  readonly agentCostUsd?: number;
  readonly modelUsed?: string | null;
}

export function recordObservation(
  input: RecordObservationInput,
  now: number = Date.now(),
): ObservationRecord | null {
  const watch = watches.get(input.watchId);
  if (watch === undefined) {
    return null;
  }
  const nowDate = new Date(now);
  const observationId = randomUUID();
  const phraseId = generateObservationPhraseId(input.watchId, nowDate);

  const idx = observationIndex.get(input.watchId) ?? [];
  const prevObservationId = idx.length > 0 ? (idx[0] ?? null) : null;

  const record: ObservationRecord = {
    observationId,
    phraseId,
    watchId: input.watchId,
    kind: input.kind,
    prevObservationId,
    observation: input.observation,
    errorMessage: input.errorMessage ?? null,
    agentTokensUsed: input.agentTokensUsed ?? 0,
    agentCostUsd: input.agentCostUsd ?? 0,
    modelUsed: input.modelUsed ?? null,
    fetchedAt: nowIso(now),
    createdAt: nowIso(now),
  };

  observations.set(observationId, record);
  observationIndex.set(input.watchId, [observationId, ...idx]);
  enforceObservationCap();

  const updatedWatch: WatchRecord = {
    ...watch,
    lastFiredAt: now,
    lastObservationId: input.kind === "error" ? watch.lastObservationId : observationId,
    agentTokensSpentTotal:
      watch.agentTokensSpentTotal + (input.agentTokensUsed ?? 0),
    agentCostUsdTotal:
      watch.agentCostUsdTotal + (input.agentCostUsd ?? 0),
    updatedAt: nowIso(now),
  };
  watches.set(input.watchId, updatedWatch);
  publish(input.watchId, { kind: "observation", record });
  publish(input.watchId, { kind: "state", record: updatedWatch });

  return record;
}

export interface ListObservationsResult {
  readonly observations: ReadonlyArray<ObservationRecord>;
  readonly totalCount: number;
}

export function listObservations(
  watchId: string,
  limit = 20,
): ListObservationsResult {
  const idx = observationIndex.get(watchId) ?? [];
  const ids = idx.slice(0, limit);
  const page: ObservationRecord[] = [];
  for (const id of ids) {
    const o = observations.get(id);
    if (o !== undefined) {
      page.push(o);
    }
  }

  return { observations: page, totalCount: idx.length };
}

export function getObservation(observationId: string): ObservationRecord | null {
  return observations.get(observationId) ?? null;
}

// ---------------------------------------------------------------------------
// Mock trigger — Week-1 only
// ---------------------------------------------------------------------------
//
// Does a one-shot fetch() and writes a MOCK observation. Replaced in Week-2
// by Worker `POST /v1/watches/:id/trigger`. The public signature stays:
// the caller (the trigger route) doesn't need to know which backend is live.

export type TriggerResult =
  | { kind: "ok"; observation: ObservationRecord }
  | { kind: "not-found" }
  | { kind: "not-active"; status: WatchStatus };

const MOCK_FETCH_TIMEOUT_MS = 15_000;

export async function triggerWatch(
  watchId: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<TriggerResult> {
  const watch = watches.get(watchId);
  if (watch === undefined) {
    return { kind: "not-found" };
  }
  if (watch.status !== "active" && watch.status !== "failed") {
    return { kind: "not-active", status: watch.status };
  }

  // Mark running so the UI can show a spinner.
  const running: WatchRecord = {
    ...watch,
    status: "running",
    updatedAt: nowIso(now),
  };
  watches.set(watchId, running);
  publish(watchId, { kind: "state", record: running });

  let bodyText: string | null = null;
  let fetchError: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), MOCK_FETCH_TIMEOUT_MS);
    try {
      const res = await fetchImpl(watch.url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
      });
      if (!res.ok) {
        fetchError = `HTTP ${res.status}`;
      } else {
        bodyText = await res.text();
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.message.slice(0, 200)
        : "fetch failed";
  }

  // Restore status to active (or failed if the fetch died).
  const postStatus: WatchStatus = fetchError === null ? "active" : "failed";
  const postWatch: WatchRecord = {
    ...running,
    status: postStatus,
    lastFiredAt: now,
    updatedAt: nowIso(now),
  };
  watches.set(watchId, postWatch);

  if (fetchError !== null) {
    const obs = recordObservation(
      {
        watchId,
        kind: "error",
        observation: null,
        errorMessage: fetchError,
      },
      now,
    );
    if (obs === null) {
      return { kind: "not-found" };
    }

    return { kind: "ok", observation: obs };
  }

  // Mock observation — no agent involved. Hash the body for next-run diffing.
  const hash =
    bodyText !== null
      ? createHash("sha256").update(bodyText).digest("hex").slice(0, 16)
      : "empty";
  const obs = recordObservation(
    {
      watchId,
      kind: "baseline",
      observation: {
        naturalLanguageSummary: `Fetched ${watch.url} (${bodyText?.length ?? 0} bytes). Mock observation — Week-1 stub, no agent yet.`,
        reasoning:
          "Week-1 stub: a fetch landed, no semantic analysis has been performed. " +
          "The Worker + agent ship in Week-2 and will replace this mock with real " +
          "structured output (classification, confidence, evidence quote, causal explanation).",
        evidenceQuote: null,
        causalExplanation: null,
        extractedFields: { contentHash: hash, bytes: bodyText?.length ?? 0 },
        classification: "unchanged",
        confidence: 0,
        alertWorthy: false,
        suggestedNextCheckMs: null,
      },
      modelUsed: null,
    },
    now,
  );
  if (obs === null) {
    return { kind: "not-found" };
  }

  return { kind: "ok", observation: obs };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** @internal */
export function __resetForTests(): void {
  watches.clear();
  idempotency.clear();
  observations.clear();
  observationIndex.clear();
  subscribers.clear();
}

/** @internal */
export function __watchCount(): number {
  return watches.size;
}

/** @internal */
export function __observationCount(): number {
  return observations.size;
}

/** @internal */
export function __subscriberCount(watchId: string): number {
  return subscribers.get(watchId)?.size ?? 0;
}

/** @internal */
export const __INTERNAL_MAX_WATCHES = MAX_WATCHES;
/** @internal */
export const __INTERNAL_SUBSCRIBERS_PER_WATCH_CAP = SUBSCRIBERS_PER_WATCH_CAP;
