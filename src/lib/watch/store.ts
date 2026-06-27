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

import { lookup as dnsLookup } from "node:dns/promises";

import { generateScopedPhraseId } from "../phrase-id";
import { validatePublicUrl, validateResolvedIp } from "../security/url-guard";
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
/**
 * Per-watch cap, not global. A noisy watch firing every 15 min cannot
 * evict a quiet watch's baseline — each watch keeps up to N observations
 * before its own oldest rolls off.
 */
const MAX_OBSERVATIONS_PER_WATCH = 200;
/** Per-watch manual trigger cooldown — defeats trigger amplification (SEC-M1). */
const TRIGGER_COOLDOWN_MS = 15_000;
/** Maximum HTTP redirects to follow during a trigger fetch. */
const TRIGGER_MAX_REDIRECTS = 3;

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
  | { kind: "observation"; record: ObservationRecord };
// NOTE: A third `alert` variant existed in Week-1 in anticipation of the
// Week-2 alert dispatcher. R4 DX-4 removed it — keeping a dead union arm
// in a public type misleads consumers into pattern-matching against a
// case that will never arrive. When the dispatcher ships, re-add the
// variant alongside the publisher in the same commit.

export type WatchSubscriber = (event: WatchEvent) => void;

const SUBSCRIBERS_PER_WATCH_CAP = 100;
/** Global cap across all watches — bounds total open SSE connections. */
const SUBSCRIBERS_GLOBAL_CAP = 5_000;

const subscribers: Map<string, Set<WatchSubscriber>> =
  (globalThis.__pluckStudioV1WatchSubscribers ??= new Map<
    string,
    Set<WatchSubscriber>
  >());

function totalSubscriberCount(): number {
  let total = 0;
  for (const set of subscribers.values()) {
    total += set.size;
  }

  return total;
}

/**
 * Subscribe to state transitions on a specific watch. Returns an
 * `unsubscribe` thunk on success, or `null` when either the per-watch or
 * the global subscriber cap is reached (callers — the SSE route — turn
 * that into a `subscriber-cap-reached` event). Earlier revisions threw
 * on cap; throwing on a quota-event is API smell, so the route had to
 * wrap every call in try/catch. Null is the explicit, typed signal.
 */
export function subscribeToWatch(
  watchId: string,
  cb: WatchSubscriber,
): (() => void) | null {
  let set = subscribers.get(watchId);
  if (set === undefined) {
    set = new Set();
    subscribers.set(watchId, set);
  }
  if (set.size >= SUBSCRIBERS_PER_WATCH_CAP) {
    return null;
  }
  if (totalSubscriberCount() >= SUBSCRIBERS_GLOBAL_CAP) {
    return null;
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

/**
 * Owner-scoped idempotency hash.
 *
 * Pre-pluck-api, every Studio user is anonymous (`STUB_OWNER_ID`) — so
 * cross-tenant collisions can already happen, but a single anonymous user
 * retrying a POST still collapses correctly. When pluck-api lands and
 * routes thread the real `session.user.id` through, hashes will key on
 * the real owner. Day-1 fix: include the owner field in the canonical
 * input now so the swap doesn't require a data migration AND so two
 * distinct authed users (whose org Bearer tokens differ in
 * `clientKey(req)`) cannot accidentally land on the same watchId on
 * Bearer-affordance dev environments.
 */
const STUB_OWNER_ID = "anonymous";

function idempotencyHashOf(
  spec: WatchSpec,
  ownerId: string = STUB_OWNER_ID,
): string | null {
  if (spec.idempotencyKey === undefined) {
    return null;
  }
  // Hash a stable subset of the spec — fields the operator might
  // legitimately tweak post-create (cron, channels, thresholds) are
  // excluded so a retry with the same key still collapses. `name` is
  // included so two watches against the same URL with different labels
  // do not collide.
  const canonical = canonicalJson({
    ownerId,
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
 * discloses the vendor. Symmetric with program runIds.
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
 *   pluck:watch:<watchId>:<YYYY-MM-DD>:obs-<NN>-<r4>
 *
 * R2 fixes vs the original `pluck/watch/<id>/<ymd>/observation-NN`:
 *   - `:` separator instead of `/` — URL-path-safe, copies cleanly into
 *     Slack code blocks and email subjects, never collides with Next's
 *     dynamic routing (`/[id]` doesn't try to swallow a slash-laden id).
 *   - 4-char random hex suffix on the per-day counter — defeats trivial
 *     enumeration of observation IDs ("get obs 01..NN for date D");
 *     `NN` still sorts lexicographically within a day for receipt diffs.
 *   - `obs` instead of `observation` — receipt URLs are shorter.
 */
function generateObservationPhraseId(watchId: string, now: Date): string {
  const ymd = now.toISOString().slice(0, 10);
  const dayPrefix = `pluck:watch:${watchId}:${ymd}:obs-`;
  const ids = observationIndex.get(watchId) ?? [];
  let seq = 1;
  for (const obsId of ids) {
    const obs = observations.get(obsId);
    if (obs !== undefined && obs.phraseId.startsWith(dayPrefix)) {
      seq += 1;
    }
  }
  const padded = String(seq).padStart(2, "0");
  const suffix = randomBytes(2).toString("hex"); // 4 hex chars

  return `${dayPrefix}${padded}-${suffix}`;
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

/**
 * Per-watch observation cap. Was global (oldest insertion across ALL watches
 * evicted first), which let a noisy watch silently delete a quiet watch's
 * baseline observation — breaking its diff anchor and orphaning
 * `prevObservationId` chains. Now: each watch keeps at most
 * MAX_OBSERVATIONS_PER_WATCH; eviction stays scoped to the active watch.
 *
 * @param protectedWatchId — the watch whose observation we just recorded.
 *   Eviction will not touch the just-added observation even if its watch
 *   is at exactly the cap.
 */
function enforcePerWatchObservationCap(
  protectedWatchId: string,
  justAddedObservationId: string,
): void {
  const idx = observationIndex.get(protectedWatchId);
  if (idx === undefined) {
    return;
  }
  while (idx.length > MAX_OBSERVATIONS_PER_WATCH) {
    const removed = idx.pop(); // oldest in this watch
    if (removed === undefined || removed === justAddedObservationId) {
      break;
    }
    observations.delete(removed);
  }
  if (idx.length === 0) {
    observationIndex.delete(protectedWatchId);
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
  options: { ownerId?: string | null; now?: number } = {},
): CreateWatchResult {
  const now = options.now ?? Date.now();
  const ownerId = options.ownerId ?? null;
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
    ownerId,
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

  // Phase 1 — derive everything from current state.
  const nowDate = new Date(now);
  const observationId = randomUUID();
  const phraseId = generateObservationPhraseId(input.watchId, nowDate);
  const idx = observationIndex.get(input.watchId) ?? [];
  // `prevObservationId` is null on errors so the receipt page never tries
  // to render a "before/after diff" against an unrelated successful run.
  const prevObservationId =
    input.kind === "error"
      ? null
      : idx.length > 0
        ? (idx[0] ?? null)
        : null;

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

  const updatedWatch: WatchRecord = {
    ...watch,
    // On `error` kind, preserve whatever the caller wrote (triggerWatch
    // rolls `lastFiredAt` back to its pre-claim value on fetch failure
    // so a failed fetch doesn't latch the watch into a cooldown lockout).
    // On any other kind, advance to `now`. R5 SEC-R4-M3 follow-through.
    lastFiredAt: input.kind === "error" ? watch.lastFiredAt : now,
    lastObservationId:
      input.kind === "error" ? watch.lastObservationId : observationId,
    agentTokensSpentTotal:
      watch.agentTokensSpentTotal + (input.agentTokensUsed ?? 0),
    agentCostUsdTotal:
      watch.agentCostUsdTotal + (input.agentCostUsd ?? 0),
    updatedAt: nowIso(now),
  };

  // Phase 2 — commit. All Map mutations happen together so a mid-flight
  // observer never sees observation-without-watch or watch-without-index.
  // Cap enforcement is scoped to THIS watch (per-watch FIFO) so the
  // just-added observation cannot be evicted before publish fires.
  observations.set(observationId, record);
  observationIndex.set(input.watchId, [observationId, ...idx]);
  enforcePerWatchObservationCap(input.watchId, observationId);
  watches.set(input.watchId, updatedWatch);

  // Phase 3 — broadcast. observation event first so subscribers see the
  // new observation before its watch-state side effects.
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
  | { kind: "not-active"; status: WatchStatus }
  | { kind: "cooldown"; waitMs: number };

const MOCK_FETCH_TIMEOUT_MS = 15_000;
/** Cap the response body we slurp from a target so a hostile site can't
 *  stream gigabytes into our process. 1 MiB is well above any real-world
 *  pricing/release/status page; raise post-Week-2 when the worker handles
 *  the fetch with proper streaming + size accounting. */
const MOCK_FETCH_MAX_BYTES = 1_000_000;

/**
 * Manual redirect walker with three defenses:
 *
 *   1. Per-hop URL-guard re-validation — defeats `https://attacker.tld →
 *      302 → http://127.0.0.1` chains.
 *   2. DNS-resolution-time IP check (R2 fix) — `validatePublicUrl` only
 *      sees the textual hostname; we resolve A/AAAA via `dns.lookup`
 *      immediately before each hop and reject the request when ANY
 *      resolved address is private/loopback/link-local. Defeats DNS
 *      rebinding where a TTL=0 record flips between public + RFC1918.
 *   3. No-downgrade rule (R2 fix) — if the operator pinned `https://`,
 *      a redirect Location with `http://` is rejected. Prevents on-path
 *      attackers from forcing a downgrade and tampering with the body.
 *
 * Returns the final successful Response, or throws a redacted error.
 */
/**
 * Function shape for the DNS-resolution-time guard. Injectable so tests
 * can simulate rebind (an A record that flips between public + private)
 * without standing up real DNS. The production binding is `node:dns/promises.lookup`.
 */
export type DnsLookupImpl = (
  hostname: string,
  options: { all: true },
) => Promise<{ address: string; family: number }[]>;

async function safeFetchFollowingRedirects(
  fetchImpl: typeof fetch,
  startUrl: string,
  signal: AbortSignal,
  dnsLookupImpl: DnsLookupImpl = dnsLookup,
): Promise<Response> {
  const startProtocol = (() => {
    try {
      return new URL(startUrl).protocol;
    } catch {
      return "https:";
    }
  })();

  let currentUrl = startUrl;
  for (let hop = 0; hop <= TRIGGER_MAX_REDIRECTS; hop += 1) {
    // DNS-resolution-time IP check (defeats rebinding).
    await assertResolvedHostnameIsPublic(currentUrl, dnsLookupImpl);

    const res = await fetchImpl(currentUrl, {
      method: "GET",
      signal,
      redirect: "manual",
      // R5 SEC-M4 defense: disable transparent decompression. We cap
      // BYTES, not CPU spent decompressing; a 4 KiB gzipped target that
      // unpacks to GB would abort at 1 MiB of decompressed text, but the
      // CPU spent getting there is unmetered. `identity` keeps the body
      // byte-bounded all the way through. Worker (Week-2) will add
      // proper streaming + decompression accounting.
      headers: { "Accept-Encoding": "identity" },
    });
    // 3xx with Location → re-validate, then keep walking.
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (loc === null) {
        throw new Error(`redirect without Location at ${redactUrl(currentUrl)}`);
      }
      // Resolve relative redirects against the current URL.
      const next = new URL(loc, currentUrl).toString();
      const guard = validatePublicUrl(next);
      if (!guard.ok) {
        throw new Error(
          `redirect blocked (${guard.error}) at ${redactUrl(currentUrl)}`,
        );
      }
      // No-downgrade: if the operator pinned https://, the redirect MUST
      // stay https. Bare http://-pinned watches are an explicit operator
      // choice and can downgrade further (or upgrade); the constraint
      // only fires for https-origin chains.
      if (startProtocol === "https:") {
        let nextProto: string;
        try {
          nextProto = new URL(guard.url).protocol;
        } catch {
          nextProto = "";
        }
        if (nextProto !== "https:") {
          throw new Error(
            `redirect blocked (https→${nextProto || "?"} downgrade) at ${redactUrl(currentUrl)}`,
          );
        }
      }
      currentUrl = guard.url;
      continue;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res;
  }
  throw new Error(`too many redirects (>${TRIGGER_MAX_REDIRECTS})`);
}

/**
 * Resolve the URL's hostname and reject the fetch if ANY returned A/AAAA
 * record is private / loopback / link-local. Defeats DNS rebinding: the
 * `validatePublicUrl` text guard runs at POST time against the hostname
 * string; this check runs immediately before each fetch hop. Both must
 * pass.
 *
 * Non-DNS errors (lookup failure) fall through to fetch — fetch's own
 * failure will surface as an `error` observation, so we don't need to
 * preemptively reject on transient DNS hiccups.
 */
async function assertResolvedHostnameIsPublic(
  url: string,
  dnsLookupImpl: DnsLookupImpl,
): Promise<void> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }
  // Strip surrounding brackets from IPv6 literals (URL.hostname keeps them).
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname.length === 0) {
    return;
  }
  // Skip if hostname is already a literal IP — validatePublicUrl handled it.
  // dns.lookup on a literal returns the same literal, which we'd block
  // for private IPs but `validatePublicUrl` already gated on them.
  let resolved: { address: string; family: number }[];
  try {
    resolved = await dnsLookupImpl(hostname, { all: true });
  } catch (err) {
    // R5 SEC-M1 fail-closed: a hostile DNS server can return SERVFAIL on
    // the GUARD lookup (or rate-limit just our resolver) — fetch then
    // re-resolves and gets the rebind. Refuse the fetch rather than fall
    // through. Operators see this as an `error` observation, no different
    // from a real DNS failure on the target.
    throw new Error(
      `dns lookup failed (${err instanceof Error ? err.message : "unknown"}) for ${redactUrl(url)}`,
    );
  }
  if (resolved.length === 0) {
    throw new Error(`dns lookup returned no addresses for ${redactUrl(url)}`);
  }
  for (const r of resolved) {
    const guardErr = validateResolvedIp(r.address);
    if (guardErr !== null) {
      throw new Error(
        `dns rebind blocked (${guardErr}: ${r.address}) for ${redactUrl(url)}`,
      );
    }
  }
}

function redactUrl(u: string): string {
  try {
    const parsed = new URL(u);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return "<malformed-url>";
  }
}

async function readBoundedText(
  res: Response,
  maxBytes: number,
): Promise<string> {
  const reader = res.body?.getReader();
  if (reader === undefined) {
    const text = await res.text();
    return text.length > maxBytes ? text.slice(0, maxBytes) : text;
  }
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      out += decoder.decode(value.subarray(0, maxBytes - (total - value.byteLength)));
      // Fire-and-forget cancel — `await reader.cancel()` blocks until the
      // upstream closes the socket, which a hostile slowloris-style server
      // can stall indefinitely (still within the abort window but holding
      // an FD). The cancel signal is sufficient; we don't need to wait
      // for the FIN to come back. R2 SEC-M3 fix.
      void reader.cancel().catch(() => {});
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();

  return out;
}

export async function triggerWatch(
  watchId: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
  dnsLookupImpl: DnsLookupImpl = dnsLookup,
): Promise<TriggerResult> {
  const watch = watches.get(watchId);
  if (watch === undefined) {
    return { kind: "not-found" };
  }
  if (watch.status !== "active" && watch.status !== "failed") {
    return { kind: "not-active", status: watch.status };
  }
  // Per-watch trigger cooldown — defeats trigger amplification (SEC-M1).
  // R2 SEC-M1 fix: claim the cooldown slot SYNCHRONOUSLY by writing
  // `lastFiredAt = now` and flipping to `running` BEFORE the first await,
  // so two concurrent triggers cannot both pass the gate. JavaScript is
  // single-threaded; the Map mutation completes before the next event-
  // loop tick. The second caller now reads the freshly-claimed lastFiredAt
  // and sees `elapsed < TRIGGER_COOLDOWN_MS` → returns cooldown.
  if (watch.lastFiredAt !== null) {
    const elapsed = now - watch.lastFiredAt;
    if (elapsed < TRIGGER_COOLDOWN_MS) {
      return { kind: "cooldown", waitMs: TRIGGER_COOLDOWN_MS - elapsed };
    }
  }

  // Atomic claim — set running AND advance lastFiredAt in the same tick.
  // Capture the prior `lastFiredAt` so the failure path can roll it back
  // (R5 SEC-M3): without rollback, a failed fetch latches the watch into
  // a 15-second lockout even though no observation was recorded —
  // operators investigating a flaking site rage-click against the gate.
  const prevLastFiredAt = watch.lastFiredAt;
  const running: WatchRecord = {
    ...watch,
    status: "running",
    lastFiredAt: now,
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
      const res = await safeFetchFollowingRedirects(
        fetchImpl,
        watch.url,
        controller.signal,
        dnsLookupImpl,
      );
      bodyText = await readBoundedText(res, MOCK_FETCH_MAX_BYTES);
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    fetchError =
      err instanceof Error
        ? err.message.slice(0, 200)
        : "fetch failed";
  }

  // Restore status to active (or failed if the fetch died). On failure,
  // roll `lastFiredAt` back to its pre-claim value so the cooldown gate
  // does not punish operators for a failed observation. Successful fires
  // keep the new timestamp — the cooldown is only meant to bound
  // _successful_ amplification.
  const postStatus: WatchStatus = fetchError === null ? "active" : "failed";
  const postWatch: WatchRecord = {
    ...running,
    status: postStatus,
    lastFiredAt: fetchError === null ? now : prevLastFiredAt,
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
