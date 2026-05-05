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
  // CUSTODY carries `bundleUrl` (when no expectedVendor is set) — fall
  // back to the bundle hostname for the phrase prefix so the receipt
  // URL still self-discloses the target. Note: CUSTODY's expectedVendor
  // is optional; when provided the validator already promotes it to
  // vendorDomain-shaped scoping above (see CUSTODY field aliasing in
  // the legacy route's dual-write, where expectedVendor populates
  // vendorDomain at the store boundary).
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
