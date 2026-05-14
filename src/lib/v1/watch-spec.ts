// ---------------------------------------------------------------------------
// /v1/watches — WatchSpec + WatchRecord types
// ---------------------------------------------------------------------------
//
// The /v1/watches API is the canonical surface for periodic semantic
// monitoring inside Pluck Studio. Standalone — does NOT live under
// /v1/runs. Bureau programs run once-per-activation; Watches run forever
// on a cron and emit a stream of Observation records.
//
// Wedge: the agent IS the selector. Operators describe what to watch in
// natural language (`intent`); the runtime decides what's a meaningful
// change. CSS-selector scrapers die on a class rename; Watches survive.
//
// Day-N contract (the public shape never changes across the swap):
//   - POST  /v1/watches              -> create
//   - GET   /v1/watches              -> list (paginated)
//   - GET   /v1/watches/[id]         -> read
//   - PATCH /v1/watches/[id]         -> update (cron, channels, autonomyMode, status)
//   - DELETE /v1/watches/[id]        -> archive
//   - POST  /v1/watches/[id]/trigger -> fire-now (manual)
//   - GET   /v1/watches/[id]/events  -> SSE stream
//
// Week-1 stub persistence is in-memory (lib/watch/store.ts) mirroring
// run-store.ts; Week-2 swap is Supabase + a long-running worker that
// owns the Directive runtime system. The shape below MUST survive that
// swap unchanged.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const AUTONOMY_MODES = [
  "full-auto",     // always run agent; alert when confidence >= threshold; below -> review queue
  "diff-gated",    // cheap text diff first; agent only on non-trivial diff; alert directly
  "always-agent",  // always run agent; route EVERY observation to human-confirm queue
] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

const AUTONOMY_SET: ReadonlySet<string> = new Set(AUTONOMY_MODES);
export function isAutonomyMode(s: string): s is AutonomyMode {
  return AUTONOMY_SET.has(s);
}

export const FETCHER_KINDS = [
  "playwright",    // headless Chromium via worker; JS-rendered + auth-walled
  "http",          // plain fetch(); static APIs, RSS, simple pages
  "browserbase",   // third-party headless API; v2
] as const;
export type FetcherKind = (typeof FETCHER_KINDS)[number];

const FETCHER_SET: ReadonlySet<string> = new Set(FETCHER_KINDS);
export function isFetcherKind(s: string): s is FetcherKind {
  return FETCHER_SET.has(s);
}

export const WATCH_STATUSES = [
  "active",        // scheduler will fire on cadence
  "paused",        // operator-paused; still in registry, no fires
  "running",       // transient — fetch + observation in flight
  "failed",        // last run errored; auto-paused after consecutive failures
  "archived",      // soft-deleted; kept for audit
] as const;
export type WatchStatus = (typeof WATCH_STATUSES)[number];

const STATUS_SET: ReadonlySet<string> = new Set(WATCH_STATUSES);
export function isWatchStatus(s: string): s is WatchStatus {
  return STATUS_SET.has(s);
}

// ---------------------------------------------------------------------------
// Alert channels
// ---------------------------------------------------------------------------
//
// All four channels are first-class. Operators pick any subset per watch.
//
//   - dashboard:  always-on; renders in Studio UI via SSE (no config)
//   - email:      Resend; operator supplies recipient list
//   - webhook:    HMAC-signed POST to operator-supplied URL
//   - slack:      Slack incoming webhook URL
//   - phraseId:   write a Pluck-style receipt; composes with Bureau audit trail

export interface AlertChannels {
  /** Always implicit-on for the watch owner. Stored explicit for forwards-compat. */
  readonly dashboard: boolean;
  /** Empty array = disabled. Each entry is a deliverable email address. */
  readonly email: ReadonlyArray<string>;
  /** Empty array = disabled. Each entry is a https:// URL (Worker signs payloads). */
  readonly webhook: ReadonlyArray<string>;
  /** Empty array = disabled. Each entry is a Slack incoming-webhook URL. */
  readonly slack: ReadonlyArray<string>;
  /** True = every alert writes a receipt row (phrase-id addressable). */
  readonly phraseId: boolean;
}

// ---------------------------------------------------------------------------
// Observation (the agent's output)
// ---------------------------------------------------------------------------
//
// Shipping the contract NOW even though Week-1 stub emits a mock — every
// downstream consumer (UI, SSE clients, receipt page) reads against this
// shape, so the Week-2 worker swap doesn't ripple.

export const OBSERVATION_KINDS = [
  "baseline",       // first run; no comparison possible yet
  "no-change",      // diff-gated trivial diff (hash match)
  "observation",    // agent classified semantic content
  "error",          // fetch or agent failed; failure-as-data
] as const;
export type ObservationKind = (typeof OBSERVATION_KINDS)[number];

export const OBSERVATION_CLASSIFICATIONS = [
  "unchanged",
  "minor-change",        // cosmetic only (rotating banner, timestamp)
  "meaningful-change",   // user's intent condition triggered or violated
  "layout-shifted",      // structure changed; self-healing re-investigation territory
  "blocked",             // CAPTCHA / 403 / login wall
  "missing",             // page reachable but the watched content is gone
] as const;
export type ObservationClassification =
  (typeof OBSERVATION_CLASSIFICATIONS)[number];

export interface Observation {
  /** Operator-readable summary, ready for an email subject or Slack message (<=280 chars). */
  readonly naturalLanguageSummary: string;
  /** Agent's full reasoning. Load-bearing for the receipt page audit trail. */
  readonly reasoning: string;
  /** Verbatim quote from page content supporting the classification. Anti-hallucination. */
  readonly evidenceQuote: string | null;
  /** Why the value changed — the wedge differentiator. Null on baseline / unchanged. */
  readonly causalExplanation: string | null;
  /** Structured semantic fields extracted by the agent (e.g. { priceUsd: 879 }). */
  readonly extractedFields: Readonly<Record<string, string | number | boolean | null>>;
  readonly classification: ObservationClassification;
  /** 0..1 — agent's self-assessed confidence in its classification. */
  readonly confidence: number;
  /** True only when the user's intent condition is satisfied/violated. */
  readonly alertWorthy: boolean;
  /** Agent hint: if a change appears imminent, suggest a faster recheck. Clamped by worker. */
  readonly suggestedNextCheckMs: number | null;
}

export interface ObservationRecord {
  /** Stable UUID for the observation; phraseId is the user-facing alias. */
  readonly observationId: string;
  /** pluck:watch:<watch-slug>:<ymd>:obs-<seq>-<r4> — URL-/Slack-safe phrase-id. */
  readonly phraseId: string;
  readonly watchId: string;
  readonly kind: ObservationKind;
  /** Null on baseline (first run); set otherwise so receipt page can render a diff. */
  readonly prevObservationId: string | null;
  /** Null on `error` kind. */
  readonly observation: Observation | null;
  /** Set when kind === "error". */
  readonly errorMessage: string | null;
  /** Agent cost accounting (zero for diff-gated no-change). */
  readonly agentTokensUsed: number;
  readonly agentCostUsd: number;
  /** Provider/model that produced the observation. Null for `no-change`. */
  readonly modelUsed: string | null;
  readonly fetchedAt: string;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// WatchSpec (the inbound payload — what operators send to POST)
// ---------------------------------------------------------------------------

export interface WatchSpec {
  /** Operator-supplied display name. 1..120 chars. */
  readonly name: string;
  /** http:// or https:// URL. Public host (no localhost / private IP — see validator). */
  readonly url: string;
  /** 5-field cron expression OR @-macro (validated via lib/cron). */
  readonly cron: string;
  /** Operator's natural-language description of what to watch. 20..2000 chars. */
  readonly intent: string;
  readonly fetcherKind: FetcherKind;
  readonly autonomyMode: AutonomyMode;
  readonly alertChannels: AlertChannels;
  /**
   * Confidence threshold for full-auto mode (0..1). Below this, alerts route
   * to review queue instead of firing channels. Default 0.75.
   */
  readonly confidenceThreshold?: number;
  /**
   * Normalized text-diff threshold for diff-gated mode (0..1). Levenshtein
   * distance / max(len) — below this the agent is skipped. Default 0.02.
   */
  readonly diffThreshold?: number;
  /**
   * Optional CSS selectors to strip before hashing for diff-gated mode.
   * Use for rotating banners, timestamps, CSRF tokens that bust the cheap diff.
   */
  readonly ignoreSelectors?: ReadonlyArray<string>;
  /** Vision (screenshot) input by default. False = text-only unless escalation needs it. */
  readonly useVisionDefault?: boolean;
  /** Per-day budget cap in USD. Auto-pauses watch when exceeded. Default 2.00. */
  readonly dailyBudgetUsd?: number;
  /** Idempotency key for double-submit collapse. Optional. */
  readonly idempotencyKey?: string;
}

// ---------------------------------------------------------------------------
// WatchRecord (the stored shape — what GETs return)
// ---------------------------------------------------------------------------

export interface WatchRecord {
  /** Pluck phrase-id: watch-<adj>-<animal>-<NNNN> or scoped form. */
  readonly watchId: string;
  readonly name: string;
  readonly url: string;
  readonly cron: string;
  readonly intent: string;
  readonly fetcherKind: FetcherKind;
  readonly autonomyMode: AutonomyMode;
  readonly alertChannels: AlertChannels;
  readonly status: WatchStatus;
  readonly confidenceThreshold: number;
  readonly diffThreshold: number;
  readonly ignoreSelectors: ReadonlyArray<string>;
  readonly useVisionDefault: boolean;
  readonly dailyBudgetUsd: number;
  /** Lifetime token spend across all fires (NOT day-bucketed). */
  readonly agentTokensSpentTotal: number;
  /** Lifetime USD spend across all fires. */
  readonly agentCostUsdTotal: number;
  /** Last successful observation phrase-id. Null until first non-error observation lands. */
  readonly lastObservationId: string | null;
  /** Unix ms; null until first fire. */
  readonly lastFiredAt: number | null;
  /** Receipt path: /watch/<watchId>. */
  readonly receiptUrl: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// PATCH payload — partial update
// ---------------------------------------------------------------------------
//
// Only mutable fields are listed. `url`, `intent`, `fetcherKind` are NOT
// mutable post-create — changing those is morally a new watch (the
// observation history is no longer comparable). Operators wanting that
// change archive and recreate.

export interface WatchUpdate {
  readonly cron?: string;
  readonly name?: string;
  readonly autonomyMode?: AutonomyMode;
  readonly alertChannels?: AlertChannels;
  readonly status?: Extract<WatchStatus, "active" | "paused" | "archived">;
  readonly confidenceThreshold?: number;
  readonly diffThreshold?: number;
  readonly ignoreSelectors?: ReadonlyArray<string>;
  readonly useVisionDefault?: boolean;
  readonly dailyBudgetUsd?: number;
}

// ---------------------------------------------------------------------------
// Defaults (used by store on POST when fields omitted)
// ---------------------------------------------------------------------------

export const WATCH_DEFAULTS = {
  confidenceThreshold: 0.75,
  diffThreshold: 0.02,
  dailyBudgetUsd: 2.0,
  useVisionDefault: false,
} as const;
