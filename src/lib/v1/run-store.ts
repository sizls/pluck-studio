// ---------------------------------------------------------------------------
// /v1/runs — in-memory store (STUB)
// ---------------------------------------------------------------------------
//
// !! STUB !!
//
// This module is the persistence layer for /v1/runs only until the real
// backend lands. Swap to Supabase Postgres + Kite event log + Rekor
// transparency anchoring when /v1/runs goes GA. The public API of this
// module (createRun / getRun / __resetForTests) is what the rest of
// Studio binds against — keep that signature stable across the swap.
//
// Properties of this stub that the real backend MUST preserve:
//   - Idempotency: same canonicalised (pipeline, payload, idempotencyKey)
//     always returns the same runId, even on retried POSTs.
//   - Receipt URLs: receiptUrl maps 1:1 to runId; the runId is the only
//     primitive that needs to round-trip cleanly through a tweet/DM.
//   - 24h TTL: runs older than the TTL are evicted on read so stale runs
//     don't pile up forever in dev. Production replaces this with proper
//     storage; the API contract (GET returns 404 after TTL) stays the
//     same.
//   - 10K-entry FIFO cap: hard-bounded memory footprint. Mirrors the
//     pattern used by lib/rate-limit.ts.
//
// What the stub does NOT do:
//   - Run anything. createRun() returns a record in `pending` status; it
//     does not invoke any actual probe pack, DSP sensor, or browser
//     agent. Status transitions land with the real runner.
//   - Sign anything. The DSSE envelope + Rekor anchor are produced by
//     the real backend.
//   - Persist across process restarts. The Map lives in module scope —
//     a server restart wipes it. Acceptable for stub.
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "node:crypto";

import {
  generatePhraseId,
  generateScopedPhraseId,
} from "../phrase-id";
import {
  type BureauPipeline,
  bureauSlugOf,
  isBureauPipeline,
  type RunRecord,
  type RunSpec,
  type RunSpecPipeline,
  type RunStatus,
} from "./run-spec";

const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_ENTRIES = 10_000;

// Stash the Maps on globalThis so Next.js dev-mode HMR (which tears down
// module-scoped state on file edits) doesn't wipe an in-flight run between
// the POST that creates it and the GET that the receipt page issues a
// few hundred ms later. Production replaces this whole module with a real
// backend; the global-on-dev pattern is the well-known Next.js workaround
// (see prisma's PrismaClient singleton, etc.).
declare global {
  // eslint-disable-next-line no-var
  var __pluckStudioV1RunStore: Map<string, RunRecord> | undefined;
  // eslint-disable-next-line no-var
  var __pluckStudioV1IdempotencyIndex: Map<string, string> | undefined;
}

const runs: Map<string, RunRecord> = (globalThis.__pluckStudioV1RunStore ??=
  new Map<string, RunRecord>());
/** idempotencyHash → runId. Same canonical request returns the same run. */
const idempotency: Map<string, string> =
  (globalThis.__pluckStudioV1IdempotencyIndex ??= new Map<string, string>());

/**
 * Compute the canonical idempotency hash for a RunSpec. We hash a
 * stable JSON serialisation of (pipeline, payload, idempotencyKey) so
 * two semantically-identical requests collide regardless of object key
 * order. The hash is sha256 — deterministic, collision-resistant, and
 * safe to use as a Map key.
 *
 * @internal — implementation detail of the stub. Not part of the public
 * /v1/runs contract; the Supabase swap is free to compute idempotency
 * differently. Tests that import this directly are stub-coupled and
 * gated by the `PLUCK_REAL_BACKEND` env (see __tests__/run-store.test.ts).
 */
export function idempotencyHashOf(spec: RunSpec): string | null {
  if (spec.idempotencyKey === undefined) {
    return null;
  }
  const canonical = canonicalJson({
    pipeline: spec.pipeline,
    payload: spec.payload,
    idempotencyKey: spec.idempotencyKey,
  });

  return createHash("sha256").update(canonical).digest("hex");
}

/**
 * Canonical JSON: sorted object keys, deep-recursive. Arrays preserve
 * order. Used so {a:1,b:2} and {b:2,a:1} hash the same.
 *
 * Object keys whose value is `undefined` are skipped so `{a: undefined}`
 * and `{}` produce the same canonical string. This matches the way
 * `JSON.stringify` itself drops undefined object values, and avoids the
 * gotcha where two semantically-identical requests hash differently
 * just because one client serialised a missing field as `undefined`.
 *
 * @internal — implementation detail; see idempotencyHashOf.
 */
export function canonicalJson(value: unknown): string {
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
  const parts = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);

  return `{${parts.join(",")}}`;
}

function nowIso(now: number): string {
  return new Date(now).toISOString();
}

function evictExpired(now: number): void {
  for (const [id, record] of runs) {
    const created = Date.parse(record.createdAt);
    if (Number.isFinite(created) && now - created > TTL_MS) {
      runs.delete(id);
    }
  }
  // Sweep orphan idempotency rows whose owning run no longer exists. Without
  // this, a run that gets evicted (TTL or by the FIFO cap path that calls
  // evictExpired indirectly) leaves behind its idempotency row forever —
  // every subsequent retry would dereference a missing runId, fall through
  // and create a fresh run, but the orphan row would still occupy space.
  // M2 fix.
  for (const [hash, runId] of idempotency) {
    if (!runs.has(runId)) {
      idempotency.delete(hash);
    }
  }
}

function enforceCap(): void {
  while (runs.size >= MAX_ENTRIES) {
    const oldest = runs.keys().next().value;
    if (oldest === undefined) {
      return;
    }
    runs.delete(oldest);
    // Drop any idempotency rows pointing at the evicted runId. O(N) on
    // overflow only — acceptable since cap-hits are bounded by MAX_ENTRIES.
    for (const [hash, runId] of idempotency) {
      if (runId === oldest) {
        idempotency.delete(hash);
      }
    }
  }
}

/**
 * Generate a runId for the given pipeline. Bureau pipelines reuse the
 * existing vendor-scoped or bare phrase-id helpers so receipt URLs stay
 * consistent with the legacy per-program routes. Future pipelines fall
 * back to a generic `<slug>-<adj>-<noun>-<NNNN>`.
 */
function runIdFor(pipeline: RunSpecPipeline, payload: Record<string, unknown>): string {
  if (isBureauPipeline(pipeline)) {
    return runIdForBureau(pipeline, payload);
  }
  // extract / sense / act / fleet — generic prefix.
  return `${pipeline}-${generatePhraseId()}`;
}

function runIdForBureau(
  pipeline: BureauPipeline,
  payload: Record<string, unknown>,
): string {
  // Bureau programs that probe a URL get a vendor-scoped phrase
  // (`openai-swift-falcon-3742`); the rest get a slug-prefixed one
  // so the program is readable from the URL alone.
  //
  // OATH carries `vendorDomain` (a hostname, not a URL) — same intent as
  // DRAGNET's `targetUrl`: the receipt URL self-discloses the vendor.
  // We promote it to a URL for `generateScopedPhraseId` so the phrase
  // shape matches DRAGNET (e.g. `openai-swift-falcon-3742`).
  const targetUrl =
    typeof payload.targetUrl === "string" && payload.targetUrl.length > 0
      ? payload.targetUrl
      : null;

  if (targetUrl !== null) {
    return generateScopedPhraseId(targetUrl);
  }
  const vendorDomain =
    typeof payload.vendorDomain === "string" && payload.vendorDomain.length > 0
      ? payload.vendorDomain
      : null;

  if (vendorDomain !== null) {
    return generateScopedPhraseId(`https://${vendorDomain}`);
  }
  // MOLE carries `canaryId` — the seal URL self-discloses *which*
  // canary was sealed, never the body. Phrase shape:
  // `<canaryId-slug>-<adj>-<noun>-NNNN`. Resolved BEFORE `vendor` so
  // the canary identity wins over any incidental vendor field.
  const canaryId =
    typeof payload.canaryId === "string" && payload.canaryId.length > 0
      ? payload.canaryId
      : null;

  if (canaryId !== null) {
    return generateScopedPhraseId(`https://${canaryId}.example`);
  }
  // BOUNTY carries `target` ("hackerone" | "bugcrowd") — phrase prefix is
  // the target platform, NOT the source operator or affected vendor.
  // Receipt URL self-discloses *which platform was filed against*; the
  // affected vendor lives in the receipt body. Anchored on the legacy
  // route's intent (see /api/bureau/bounty/run).
  //
  // ORDERING: BOUNTY's payload also carries `vendor` (the affected
  // model's vendor) — we resolve `target` BEFORE `vendor` so BOUNTY
  // scopes to the platform it was filed against, not the affected
  // vendor. FINGERPRINT only carries `vendor`, so its branch still
  // wins for that pipeline.
  const target =
    typeof payload.target === "string" && payload.target.length > 0
      ? payload.target
      : null;

  if (target !== null) {
    return generateScopedPhraseId(`https://${target}.example`);
  }
  // FINGERPRINT carries `vendor` (slug like "openai") — receipt URL
  // self-discloses the scanned vendor. Promote to a URL for
  // generateScopedPhraseId so the phrase shape matches DRAGNET/OATH
  // (`openai-swift-falcon-3742`).
  const vendor =
    typeof payload.vendor === "string" && payload.vendor.length > 0
      ? payload.vendor
      : null;

  if (vendor !== null) {
    return generateScopedPhraseId(`https://${vendor}.example`);
  }
  // SBOM-AI carries `artifactKind` ("probe-pack" | "model-card" |
  // "mcp-server") — phrase prefix surfaces the artifact category in the
  // URL itself.
  const artifactKind =
    typeof payload.artifactKind === "string" && payload.artifactKind.length > 0
      ? payload.artifactKind
      : null;

  if (artifactKind !== null) {
    return generateScopedPhraseId(`https://${artifactKind}.example`);
  }
  // ROTATE carries `reason` ("compromised" | "routine" | "lost") — the
  // phrase prefix surfaces *why* the rotation happened. Social-pressure
  // signal for compromised events.
  const reason =
    typeof payload.reason === "string" && payload.reason.length > 0
      ? payload.reason
      : null;

  if (reason !== null) {
    return generateScopedPhraseId(`https://${reason}.example`);
  }
  // TRIPWIRE carries `machineId` (operator slug like "alice-mbp") — each
  // machine's deployment has its own permanent receipt URL.
  const machineId =
    typeof payload.machineId === "string" && payload.machineId.length > 0
      ? payload.machineId
      : null;

  if (machineId !== null) {
    return generateScopedPhraseId(`https://${machineId}.example`);
  }
  // WHISTLE carries `routingPartner` (newsroom slug). Phrase prefix is
  // the routing partner — NEVER the bundle source. Anonymity-by-default.
  const routingPartner =
    typeof payload.routingPartner === "string" &&
    payload.routingPartner.length > 0
      ? payload.routingPartner
      : null;

  if (routingPartner !== null) {
    return generateScopedPhraseId(`https://${routingPartner}.example`);
  }
  // CUSTODY carries `bundleUrl` (when no expectedVendor is set) — fall
  // back to the bundle hostname for the phrase prefix so the receipt
  // URL still self-discloses the target. Note: CUSTODY's expectedVendor
  // is optional; when provided the validator already promotes it to
  // vendorDomain-shaped scoping above (see CUSTODY field aliasing in
  // the legacy route's dual-write, where expectedVendor populates
  // vendorDomain at the store boundary).
  //
  // WHISTLE also carries `bundleUrl`, but its routingPartner branch
  // above wins — anonymity wants the partner prefix, not the source
  // hostname. Order matters here.
  const bundleUrl =
    typeof payload.bundleUrl === "string" && payload.bundleUrl.length > 0
      ? payload.bundleUrl
      : null;

  if (bundleUrl !== null) {
    return generateScopedPhraseId(bundleUrl);
  }
  // NUCLEI carries `author` — same intent: the receipt URL self-discloses
  // the publishing operator. Phrase shape: `<author>-<adj>-<noun>-NNNN`.
  const author =
    typeof payload.author === "string" && payload.author.length > 0
      ? payload.author
      : null;

  if (author !== null) {
    return generateScopedPhraseId(`https://${author}.example`);
  }
  const slug = bureauSlugOf(pipeline);

  return `${slug}-${generatePhraseId()}`;
}

export interface CreateRunResult {
  record: RunRecord;
  /** True when the POST hit an existing idempotency row (same key replay). */
  reused: boolean;
}

export function createRun(spec: RunSpec, now: number = Date.now()): CreateRunResult {
  evictExpired(now);

  const idHash = idempotencyHashOf(spec);
  if (idHash !== null) {
    const existingId = idempotency.get(idHash);
    if (existingId !== undefined) {
      const existing = runs.get(existingId);
      if (existing !== undefined) {
        return { record: existing, reused: true };
      }
      // Idempotency row outlived the run — drop the stale row + fall through.
      idempotency.delete(idHash);
    }
  }

  enforceCap();

  const runId = uniqueRunId(spec.pipeline, spec.payload);
  const iso = nowIso(now);
  const record: RunRecord = {
    runId,
    pipeline: spec.pipeline,
    status: "pending",
    verdict: null,
    verdictColor: "gray",
    payload: spec.payload,
    response: null,
    createdAt: iso,
    updatedAt: iso,
    receiptUrl: receiptUrlFor(spec.pipeline, runId),
  };

  runs.set(runId, record);
  if (idHash !== null) {
    idempotency.set(idHash, runId);
  }

  return { record, reused: false };
}

function uniqueRunId(
  pipeline: RunSpecPipeline,
  payload: Record<string, unknown>,
): string {
  // Phrase IDs draw from a 64M space — collisions are rare but possible
  // at scale. Retry up to 5 times before falling back to a hex tail.
  for (let i = 0; i < 5; i++) {
    const candidate = runIdFor(pipeline, payload);
    if (!runs.has(candidate)) {
      return candidate;
    }
  }
  // Astronomically unlikely fallback — append 4 hex bytes.
  const tail = randomBytes(4).toString("hex");
  return `${runIdFor(pipeline, payload)}-${tail}`;
}

function receiptUrlFor(pipeline: RunSpecPipeline, runId: string): string {
  if (isBureauPipeline(pipeline)) {
    return `/bureau/${bureauSlugOf(pipeline)}/runs/${runId}`;
  }
  return `/${pipeline}/runs/${runId}`;
}

/**
 * Filter applied to `listRuns`. All fields optional — omit a field to
 * disable that filter. The `cursor` is opaque to callers (it's just the
 * `runId` of the last item from a previous page; the public contract
 * does not expose internal indexing).
 */
export interface ListRunsFilter {
  readonly pipeline?: BureauPipeline;
  /** Unix ms — only runs created strictly AFTER this timestamp are returned. */
  readonly since?: number;
  /** Page size. Clamped to [1, 100]; default 20 when omitted. */
  readonly limit?: number;
  /** runId of the last item from a previous page; pagination starts AFTER it. */
  readonly cursor?: string;
  /**
   * Filter by run status. Single value or array of values.
   * - Omitted: returns runs of any status
   * - String: matches that single status
   * - Array: matches any status in the array
   * - Empty array: matches NO runs (programmatic callers; over-the-wire
   *   empty `?status=` is 400'd at the route)
   *
   * Common shapes:
   *   - `status: "cancelled"`             — only cancelled runs
   *   - `status: ["pending", "running"]`  — exclude cancelled/anchored/failed
   */
  readonly status?: RunStatus | ReadonlyArray<RunStatus>;
}

export interface ListRunsResult {
  readonly runs: ReadonlyArray<RunRecord>;
  /** runId of the last item in this page, or null when there's no next page. */
  readonly nextCursor: string | null;
  /** Total matching the filter (across all pages), AFTER TTL eviction. */
  readonly totalCount: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MIN_LIMIT = 1;

/**
 * List runs in createdAt-DESC order with optional filters and cursor
 * pagination.
 *
 * Semantics:
 *   - TTL eviction runs first (consistent with `getRun`); evicted runs
 *     never appear in the result, totalCount, or cursor traversal.
 *   - Sort is `createdAt` DESC, ties broken by `runId` for stable ordering.
 *   - `cursor` is opaque — pass back the `nextCursor` from a prior call.
 *     If the cursor's runId no longer exists (TTL'd between pages) we
 *     fall through and return from the start.
 *   - `limit` is clamped to [1, 100]; default 20 when omitted/zero/negative.
 *   - `totalCount` reflects the full filtered set (not just this page) so
 *     UIs can render "showing 20 of N" without a separate count query.
 */
export function listRuns(
  filter: ListRunsFilter = {},
  now: number = Date.now(),
): ListRunsResult {
  evictExpired(now);

  const limit = clampLimit(filter.limit);
  // Normalize `status` filter to a Set for O(1) membership; undefined
  // means "all statuses" (default — backward-compat with the original
  // listRuns contract).
  const statusSet = normalizeStatusFilter(filter.status);

  // Build the filtered + sorted candidate list. Iterate the entire Map
  // (bounded by MAX_ENTRIES = 10K — acceptable for the stub; the Supabase
  // swap replaces this with an indexed SELECT).
  const matched: RunRecord[] = [];
  for (const record of runs.values()) {
    if (filter.pipeline !== undefined && record.pipeline !== filter.pipeline) {
      continue;
    }
    if (filter.since !== undefined) {
      const created = Date.parse(record.createdAt);
      if (!Number.isFinite(created) || created <= filter.since) {
        continue;
      }
    }
    if (statusSet !== null && !statusSet.has(record.status)) {
      continue;
    }
    matched.push(record);
  }

  // Sort newest first; tiebreak on runId for deterministic pagination.
  matched.sort((a, b) => {
    if (a.createdAt !== b.createdAt) {
      return a.createdAt < b.createdAt ? 1 : -1;
    }
    if (a.runId === b.runId) {
      return 0;
    }

    return a.runId < b.runId ? 1 : -1;
  });

  const totalCount = matched.length;

  // Apply cursor — skip everything up to and including the cursor's runId.
  // If the cursor isn't found (TTL'd or never existed) we treat it as
  // "start from the top" rather than 400ing; the cursor is opaque and
  // callers shouldn't need to know about TTL boundaries.
  let startIndex = 0;
  if (filter.cursor !== undefined && filter.cursor.length > 0) {
    const idx = matched.findIndex((r) => r.runId === filter.cursor);
    if (idx >= 0) {
      startIndex = idx + 1;
    }
  }

  const page = matched.slice(startIndex, startIndex + limit);
  const last = page.length > 0 ? page[page.length - 1] : undefined;
  const nextCursor =
    last !== undefined && startIndex + limit < matched.length
      ? last.runId
      : null;

  return { runs: page, nextCursor, totalCount };
}

/**
 * Normalize the `status` filter argument into a Set. Returns `null` when
 * no filter is supplied (caller treats as "match all"). Empty arrays
 * become a Set with no members — they match nothing, which is the
 * intuitive read of "I supplied an empty allowlist".
 */
function normalizeStatusFilter(
  raw: RunStatus | ReadonlyArray<RunStatus> | undefined,
): Set<RunStatus> | null {
  if (raw === undefined) {
    return null;
  }
  if (typeof raw === "string") {
    return new Set([raw]);
  }

  return new Set(raw);
}

function clampLimit(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) {
    return DEFAULT_LIMIT;
  }
  const n = Math.floor(raw);
  if (n < MIN_LIMIT) {
    return MIN_LIMIT;
  }
  if (n > MAX_LIMIT) {
    return MAX_LIMIT;
  }

  return n;
}

export function getRun(runId: string, now: number = Date.now()): RunRecord | null {
  const record = runs.get(runId);
  if (record === undefined) {
    return null;
  }
  const created = Date.parse(record.createdAt);
  if (Number.isFinite(created) && now - created > TTL_MS) {
    runs.delete(runId);
    return null;
  }
  return record;
}

/**
 * Result of a `cancelRun` call. Discriminated so the route handler can
 * map each kind to a distinct HTTP status without re-parsing strings:
 *   - `ok`           → 200 (200 even when alreadyCancelled — idempotent)
 *   - `not-found`    → 404 (no such runId, or TTL-evicted)
 *   - `final-state`  → 409 (already-anchored / already-failed; can't undo)
 */
export type CancelResult =
  | { kind: "ok"; record: RunRecord; alreadyCancelled: boolean }
  | { kind: "not-found" }
  | { kind: "final-state"; status: RunRecord["status"] };

/**
 * Cancel a run. Pending or running → cancelled. Anchored or failed →
 * final-state (cannot be undone). Already-cancelled → idempotent ok.
 *
 * Status transitions:
 *   pending   → cancelled  ✓
 *   running   → cancelled  ✓ (real backend signals the runner; stub flips status)
 *   anchored  → final-state (already-final, can't undo)
 *   failed    → final-state (already-final)
 *   cancelled → ok with alreadyCancelled=true (idempotent replay)
 */
export function cancelRun(
  runId: string,
  now: number = Date.now(),
): CancelResult {
  // Apply TTL eviction first — consistent with getRun. A run that's
  // older than the TTL is treated as not-found rather than cancellable.
  evictExpired(now);

  const record = runs.get(runId);
  if (record === undefined) {
    return { kind: "not-found" };
  }

  if (record.status === "anchored" || record.status === "failed") {
    return { kind: "final-state", status: record.status };
  }

  if (record.status === "cancelled") {
    return { kind: "ok", record, alreadyCancelled: true };
  }

  // pending or running → cancelled
  const updated: RunRecord = {
    ...record,
    status: "cancelled",
    updatedAt: nowIso(now),
  };
  runs.set(runId, updated);

  return { kind: "ok", record: updated, alreadyCancelled: false };
}

/** @internal — for tests asserting cap / TTL / idempotency behaviour. */
export function __resetForTests(): void {
  runs.clear();
  idempotency.clear();
}

/** @internal — for tests inspecting cardinality. */
export function __runCount(): number {
  return runs.size;
}

/** @internal — for tests inspecting idempotency rows. */
export function __idempotencyCount(): number {
  return idempotency.size;
}

// ---------------------------------------------------------------------------
// STUB-only constants — NOT part of the /v1/runs public API contract.
//
// The TTL + cap are properties of THIS in-memory implementation. The
// Supabase swap will likely use a different retention story (proper
// archival, background eviction, no fixed cap) and these symbols WILL
// disappear when the real backend lands.
//
// Tests that import these are stub-coupled and gated by the
// `PLUCK_REAL_BACKEND=1` env (see __tests__/run-store.test.ts) so they
// only run against this stub. Public consumers should NOT depend on the
// names, types, or values below.
// ---------------------------------------------------------------------------

/** @internal — stub-only TTL constant. Not part of the public API. */
export const __INTERNAL_TTL_MS = TTL_MS;
/** @internal — stub-only cap constant. Not part of the public API. */
export const __INTERNAL_MAX_ENTRIES = MAX_ENTRIES;
