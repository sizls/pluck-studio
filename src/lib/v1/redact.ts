// ---------------------------------------------------------------------------
// /v1/runs — per-pipeline GET-side payload redaction
// ---------------------------------------------------------------------------
//
// PROBLEM: every program's POST validator can accept fields that participate
// in the canonical idempotency hash but MUST NOT be echoed back through
// `GET /api/v1/runs/[id]`. The two load-bearing examples today:
//
//   - WHISTLE.bundleUrl — required at submission (the routing partner needs
//     to retrieve the bundle), part of the dedupe key, but a privacy leak
//     if echoed: anyone with the phraseId could trace back to the source.
//     The phraseId is a public share credential (the "Google Docs share
//     link" model); it must NOT be a deanonymization vector.
//   - WHISTLE.manualRedactPhrase — operator-supplied scrub phrase; same
//     anonymity-by-default posture.
//   - ROTATE.operatorNote — optional ≤512-char free-form context that
//     could carry incident detail. The receipt URL is reason-scoped
//     (compromised/routine/lost) so a "compromised" rotation already
//     surfaces socially; the operatorNote could leak attacker-IOCs or
//     internal-investigation language. Strip it from GET.
//
// The POST response already redacts these (the route handlers + validators
// drop them from the echoed body). But `record.payload` in the run-store
// holds the FULL payload — needed for the canonical hash to remain stable
// — and `GET /api/v1/runs/[id]` previously serialized it verbatim. This
// module fixes that gap by redacting at the GET boundary.
//
// DESIGN: per-pipeline registry, additive. Each program's redactor lists
// the explicit fields to strip; everything else passes through. New
// programs default to PASS_THROUGH and the type system enforces
// exhaustiveness via `Record<StudioPipeline, …>`. The redactor receives
// the canonical-JSON-stable payload + returns a safe-to-publish version
// (does not mutate the input — the run-store record still holds the
// original for idempotency / audit).
//
// SECURITY POSTURE:
//   - Validator (POST): wire-layer input gate.
//   - Route handler (POST): response-shape gate.
//   - Run-store: holds the canonical payload (idempotency).
//   - THIS MODULE (GET): output-layer gate. Defense-in-depth.
// ---------------------------------------------------------------------------

import { type StudioPipeline, BUREAU_PIPELINES } from "./run-spec";

export type PayloadRedactor = (
  payload: Record<string, unknown>,
) => Record<string, unknown>;

const PASS_THROUGH: PayloadRedactor = (payload) => payload;

// WHISTLE — strip bundleUrl + manualRedactPhrase. Both are needed at POST
// time (bundleUrl participates in the canonical hash; manualRedactPhrase
// drives downstream scrub) but are anonymity hazards at GET. The phraseId
// in the URL is the share credential; the response must not include any
// trace back to the source.
const REDACT_WHISTLE: PayloadRedactor = (payload) => {
  const { bundleUrl: _bundleUrl, manualRedactPhrase: _manualRedactPhrase, ...safe } =
    payload;

  return safe;
};

// ROTATE — strip operatorNote. The receipt URL is already reason-scoped
// (compromised/routine/lost) so the *kind* of rotation surfaces socially;
// the optional free-form note could carry attacker IOCs, internal
// investigation language, or other detail that the operator did not
// intend to publish at GET-by-phraseId resolution.
const REDACT_ROTATE: PayloadRedactor = (payload) => {
  const { operatorNote: _operatorNote, ...safe } = payload;

  return safe;
};

// MOLE: canaryUrl is by-design public — the seal target — and the operator
// is publishing that "the canary lives somewhere". canaryBody / canaryContent
// are already validator-rejected on the POST wire, so there is no persisted
// field to strip on GET. PASS_THROUGH.
//
// BOUNTY: validator already rejects auth-token-shaped fields entirely at
// POST. No persisted privacy-sensitive fields to redact on GET. PASS_THROUGH.

export const PAYLOAD_REDACTORS: Record<StudioPipeline, PayloadRedactor> = {
  "program:dragnet": PASS_THROUGH,
  "program:oath": PASS_THROUGH,
  "program:fingerprint": PASS_THROUGH,
  "program:custody": PASS_THROUGH,
  "program:whistle": REDACT_WHISTLE,
  "program:bounty": PASS_THROUGH,
  "program:sbom-ai": PASS_THROUGH,
  "program:rotate": REDACT_ROTATE,
  "program:tripwire": PASS_THROUGH,
  "program:nuclei": PASS_THROUGH,
  "program:mole": PASS_THROUGH,
};

// Belt-and-suspenders runtime check — if BUREAU_PIPELINES grows and someone
// forgets to add an entry to PAYLOAD_REDACTORS, this throws at import time
// in dev. The `Record<StudioPipeline, …>` already enforces this at the type
// level; this catches the (rare) case where the union and the array drift.
for (const p of BUREAU_PIPELINES) {
  if (!(p in PAYLOAD_REDACTORS)) {
    throw new Error(
      `[redact] missing redactor for Pluck pipeline: ${p}`,
    );
  }
}

/**
 * Redact a stored payload for safe inclusion in a public GET response.
 *
 * The input is the run-store's canonical payload (which MAY contain
 * fields that participated in the idempotency hash but MUST NOT echo
 * to a phraseId-credentialed reader). The output is a shallow copy
 * with privacy-sensitive fields stripped per the program's redactor.
 *
 * For pipelines documented but not yet implemented (extract / sense /
 * act / fleet) the run-store rejects the POST upstream; if a record
 * with such a pipeline ever appears the GET path falls back to
 * PASS_THROUGH so the user still sees the record. (The /v1/runs POST
 * route rejects future pipelines with a 400, so this is theoretical.)
 */
export function redactPayloadForGet(
  pipeline: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const redactor = (PAYLOAD_REDACTORS as Record<string, PayloadRedactor>)[pipeline];

  if (redactor === undefined) {
    return payload;
  }

  return redactor(payload);
}

// ---------------------------------------------------------------------------
// /v1/watches — GET-side record redaction
// ---------------------------------------------------------------------------
//
// PROBLEM: `/api/v1/watches/[id]` is public-read by phraseId — the phraseId
// is the share credential, mirroring the Pluck receipt-link model. The
// stored WatchRecord carries operator-private fields that MUST NOT echo to
// a phraseId-credentialed reader:
//
//   - `alertChannels.email`     — operator's notification address list
//   - `alertChannels.webhook`   — operator's automation endpoint(s)
//   - `alertChannels.slack`     — operator's incident-channel URLs
//
// These are credentials/PII the operator did not consent to publish. Strip
// them at the GET boundary. The stored record stays untouched (alerts still
// dispatch correctly). Apply to:
//
//   - GET /api/v1/watches/[id]              (single)
//   - GET /api/v1/watches                   (list — each row)
//   - GET /api/v1/watches/[id]/events       (SSE `state` event payload)
//
// The flag-shaped channels (`dashboard`, `phraseId`) are NOT secret — they
// tell a reader "this watch has dashboard live + receipts on" without
// leaking destinations. We keep those on the wire.
//
// Boolean shape is preserved: the public view replaces the address arrays
// with their COUNTS so the dashboard can render "Email (3)" without
// disclosing the addresses.
// ---------------------------------------------------------------------------

export interface PublicAlertChannelSummary {
  readonly dashboard: boolean;
  readonly phraseId: boolean;
  readonly emailCount: number;
  readonly webhookCount: number;
  readonly slackCount: number;
}

export interface PublicWatchRecord {
  readonly watchId: string;
  readonly name: string;
  readonly url: string;
  readonly cron: string;
  readonly intent: string;
  readonly fetcherKind: string;
  readonly autonomyMode: string;
  readonly status: string;
  readonly alertChannels: PublicAlertChannelSummary;
  readonly confidenceThreshold: number;
  readonly diffThreshold: number;
  readonly ignoreSelectors: ReadonlyArray<string>;
  readonly useVisionDefault: boolean;
  readonly dailyBudgetUsd: number;
  readonly agentTokensSpentTotal: number;
  readonly agentCostUsdTotal: number;
  readonly lastObservationId: string | null;
  readonly lastFiredAt: string | null;
  readonly receiptUrl: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AlertChannelsLike {
  dashboard?: unknown;
  phraseId?: unknown;
  email?: unknown;
  webhook?: unknown;
  slack?: unknown;
}

interface WatchRecordLike {
  watchId: string;
  name: string;
  url: string;
  cron: string;
  intent: string;
  fetcherKind: string;
  autonomyMode: string;
  status: string;
  alertChannels: AlertChannelsLike;
  confidenceThreshold: number;
  diffThreshold: number;
  ignoreSelectors: ReadonlyArray<string>;
  useVisionDefault: boolean;
  dailyBudgetUsd: number;
  agentTokensSpentTotal: number;
  agentCostUsdTotal: number;
  lastObservationId: string | null;
  // Internal encoding is Unix ms — `store.ts` is the only writer and it
  // always writes `number | null`. The earlier `string` arm was defensive
  // polymorphism that is now dead post-R3. R5 ARCH-A1 lockdown.
  lastFiredAt: number | null;
  receiptUrl: string;
  createdAt: string;
  updatedAt: string;
}

function arrayLen(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/**
 * Project a stored WatchRecord into the public view served by GET routes
 * and SSE `state` events. Address arrays in alertChannels are replaced
 * with counts. `lastFiredAt` (Unix ms internally) is rendered as ISO so
 * the public surface uses a single timestamp encoding.
 */
export function redactWatchForGet(record: WatchRecordLike): PublicWatchRecord {
  const c = record.alertChannels;

  return {
    watchId: record.watchId,
    name: record.name,
    url: record.url,
    cron: record.cron,
    intent: record.intent,
    fetcherKind: record.fetcherKind,
    autonomyMode: record.autonomyMode,
    status: record.status,
    alertChannels: {
      dashboard: c.dashboard === true,
      phraseId: c.phraseId === true,
      emailCount: arrayLen(c.email),
      webhookCount: arrayLen(c.webhook),
      slackCount: arrayLen(c.slack),
    },
    confidenceThreshold: record.confidenceThreshold,
    diffThreshold: record.diffThreshold,
    ignoreSelectors: record.ignoreSelectors,
    useVisionDefault: record.useVisionDefault,
    dailyBudgetUsd: record.dailyBudgetUsd,
    agentTokensSpentTotal: record.agentTokensSpentTotal,
    agentCostUsdTotal: record.agentCostUsdTotal,
    lastObservationId: record.lastObservationId,
    lastFiredAt:
      record.lastFiredAt === null
        ? null
        : new Date(record.lastFiredAt).toISOString(),
    receiptUrl: record.receiptUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
