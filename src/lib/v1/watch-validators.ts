// ---------------------------------------------------------------------------
// /v1/watches — payload validation
// ---------------------------------------------------------------------------
//
// Shape + grammar checks. NOT business-rules:
//   - Operator-quota caps (max active watches per owner) live in the store.
//   - Worker concurrency / browser-pool caps live in the worker.
//   - Per-channel auth / signing-secret validation lives at dispatch time.
//
// What this module DOES gate:
//   - WatchSpec envelope shape (no unknown top-level keys, types, lengths).
//   - URL: parseable, http(s) only, public host (no localhost / RFC1918 /
//     link-local / loopback) — same posture as DRAGNET target-url validator.
//   - Cron: valid 5-field expression OR @-macro (delegates to lib/cron).
//   - AutonomyMode / FetcherKind enum membership.
//   - AlertChannels: at least ONE channel enabled; per-channel address
//     shape (email RFC-ish, https URL for webhook/slack).
//   - Intent / name length bounds.
//   - WatchUpdate (PATCH): same per-field rules, but every field optional.
// ---------------------------------------------------------------------------

import { validateCron } from "../cron/validate";
import {
  type AlertChannels,
  isAutonomyMode,
  isFetcherKind,
  isWatchStatus,
  type WatchSpec,
  type WatchUpdate,
} from "./watch-spec";

// ---------------------------------------------------------------------------
// Top-level envelope guards
// ---------------------------------------------------------------------------

const ALLOWED_SPEC_KEYS: ReadonlySet<string> = new Set([
  "name",
  "url",
  "cron",
  "intent",
  "fetcherKind",
  "autonomyMode",
  "alertChannels",
  "confidenceThreshold",
  "diffThreshold",
  "ignoreSelectors",
  "useVisionDefault",
  "dailyBudgetUsd",
  "idempotencyKey",
]);

const ALLOWED_UPDATE_KEYS: ReadonlySet<string> = new Set([
  "name",
  "cron",
  "autonomyMode",
  "alertChannels",
  "status",
  "confidenceThreshold",
  "diffThreshold",
  "ignoreSelectors",
  "useVisionDefault",
  "dailyBudgetUsd",
]);

const ALLOWED_CHANNELS_KEYS: ReadonlySet<string> = new Set([
  "dashboard",
  "email",
  "webhook",
  "slack",
  "phraseId",
]);

// ---------------------------------------------------------------------------
// Field bounds — exported so the UI can mirror them client-side
// ---------------------------------------------------------------------------

export const WATCH_LIMITS = {
  nameMin: 1,
  nameMax: 120,
  intentMin: 20,
  intentMax: 2000,
  ignoreSelectorsMax: 32,
  emailRecipientsMax: 8,
  webhookUrlsMax: 4,
  slackUrlsMax: 4,
  dailyBudgetMinUsd: 0,
  dailyBudgetMaxUsd: 100,
  confidenceMin: 0,
  confidenceMax: 1,
  diffThresholdMin: 0,
  diffThresholdMax: 1,
  idempotencyKeyMax: 256,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; error: string };
type Result<T> = Ok<T> | Err;

function fail(error: string): Err {
  return { ok: false, error };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * Same posture as DRAGNET's target-url guard. Public-host only — no
 * localhost / loopback / RFC1918 / link-local. The Worker is the only
 * thing that fetches; we don't want a Watch pointed at the Worker's own
 * Supabase / internal services. Symmetric with run-form's client-side guard.
 */
function validatePublicUrl(raw: string): Result<string> {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return fail("`url` is required.");
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return fail("`url` must be a valid URL (include https://).");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return fail("`url` must use http:// or https://.");
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::" ||
    host === "127.0.0.1"
  ) {
    return fail("`url` cannot point at localhost or loopback addresses.");
  }
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) {
      return fail("`url` cannot point at private/loopback IPs.");
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return fail("`url` cannot point at private/loopback IPs.");
    }
    if (a === 192 && b === 168) {
      return fail("`url` cannot point at private/loopback IPs.");
    }
    if (a === 169 && b === 254) {
      return fail("`url` cannot point at link-local addresses.");
    }
  }

  return { ok: true, value: trimmed };
}

// RFC-5322 is famously a rabbit hole; this is the same shape every
// rational web app actually uses: one @, no whitespace, reasonable lengths.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

function validateEmail(raw: string): boolean {
  if (raw.length === 0 || raw.length > 254) {
    return false;
  }

  return EMAIL_PATTERN.test(raw);
}

function validateHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function validateBoundedNumber(
  raw: unknown,
  field: string,
  min: number,
  max: number,
): Result<number> {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return fail(`\`${field}\` must be a finite number.`);
  }
  if (raw < min || raw > max) {
    return fail(`\`${field}\` must be in [${min}, ${max}].`);
  }

  return { ok: true, value: raw };
}

// ---------------------------------------------------------------------------
// AlertChannels validator
// ---------------------------------------------------------------------------

function validateAlertChannels(raw: unknown): Result<AlertChannels> {
  if (!isPlainObject(raw)) {
    return fail("`alertChannels` must be an object.");
  }
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_CHANNELS_KEYS.has(key)) {
      return fail(`unexpected alertChannels key: ${key}`);
    }
  }

  if (typeof raw.dashboard !== "boolean") {
    return fail("`alertChannels.dashboard` must be a boolean.");
  }
  if (typeof raw.phraseId !== "boolean") {
    return fail("`alertChannels.phraseId` must be a boolean.");
  }

  const email = raw.email ?? [];
  if (!isStringArray(email)) {
    return fail("`alertChannels.email` must be an array of strings.");
  }
  if (email.length > WATCH_LIMITS.emailRecipientsMax) {
    return fail(
      `\`alertChannels.email\` accepts up to ${WATCH_LIMITS.emailRecipientsMax} recipients.`,
    );
  }
  for (const e of email) {
    if (!validateEmail(e)) {
      return fail(`\`alertChannels.email\` contains an invalid address: ${e}`);
    }
  }

  const webhook = raw.webhook ?? [];
  if (!isStringArray(webhook)) {
    return fail("`alertChannels.webhook` must be an array of strings.");
  }
  if (webhook.length > WATCH_LIMITS.webhookUrlsMax) {
    return fail(
      `\`alertChannels.webhook\` accepts up to ${WATCH_LIMITS.webhookUrlsMax} URLs.`,
    );
  }
  for (const w of webhook) {
    if (!validateHttpsUrl(w)) {
      return fail(`\`alertChannels.webhook\` must use https://: ${w}`);
    }
  }

  const slack = raw.slack ?? [];
  if (!isStringArray(slack)) {
    return fail("`alertChannels.slack` must be an array of strings.");
  }
  if (slack.length > WATCH_LIMITS.slackUrlsMax) {
    return fail(
      `\`alertChannels.slack\` accepts up to ${WATCH_LIMITS.slackUrlsMax} URLs.`,
    );
  }
  for (const s of slack) {
    if (!validateHttpsUrl(s)) {
      return fail(`\`alertChannels.slack\` must use https://: ${s}`);
    }
  }

  const anyEnabled =
    raw.dashboard === true ||
    raw.phraseId === true ||
    email.length > 0 ||
    webhook.length > 0 ||
    slack.length > 0;

  if (!anyEnabled) {
    return fail(
      "`alertChannels` must enable at least one channel (dashboard / email / webhook / slack / phraseId).",
    );
  }

  return {
    ok: true,
    value: {
      dashboard: raw.dashboard,
      email,
      webhook,
      slack,
      phraseId: raw.phraseId,
    },
  };
}

// ---------------------------------------------------------------------------
// WatchSpec validator (POST body)
// ---------------------------------------------------------------------------

export type ValidateWatchSpecResult =
  | { ok: true; spec: WatchSpec }
  | { ok: false; error: string };

export function validateWatchSpec(value: unknown): ValidateWatchSpecResult {
  if (!isPlainObject(value)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  for (const key of Object.keys(value)) {
    if (!ALLOWED_SPEC_KEYS.has(key)) {
      return { ok: false, error: `unexpected top-level key: ${key}` };
    }
  }

  // name
  if (typeof value.name !== "string") {
    return { ok: false, error: "`name` must be a string." };
  }
  const name = value.name.trim();
  if (
    name.length < WATCH_LIMITS.nameMin ||
    name.length > WATCH_LIMITS.nameMax
  ) {
    return {
      ok: false,
      error: `\`name\` must be ${WATCH_LIMITS.nameMin}..${WATCH_LIMITS.nameMax} chars.`,
    };
  }

  // url
  if (typeof value.url !== "string") {
    return { ok: false, error: "`url` must be a string." };
  }
  const urlRes = validatePublicUrl(value.url);
  if (!urlRes.ok) {
    return { ok: false, error: urlRes.error };
  }

  // cron
  if (typeof value.cron !== "string") {
    return { ok: false, error: "`cron` must be a string." };
  }
  if (!validateCron(value.cron)) {
    return {
      ok: false,
      error: "`cron` is not a valid 5-field cron expression or @-macro.",
    };
  }

  // intent
  if (typeof value.intent !== "string") {
    return { ok: false, error: "`intent` must be a string." };
  }
  const intent = value.intent.trim();
  if (
    intent.length < WATCH_LIMITS.intentMin ||
    intent.length > WATCH_LIMITS.intentMax
  ) {
    return {
      ok: false,
      error: `\`intent\` must be ${WATCH_LIMITS.intentMin}..${WATCH_LIMITS.intentMax} chars (describe what to watch for in plain language).`,
    };
  }

  // fetcherKind
  if (typeof value.fetcherKind !== "string" || !isFetcherKind(value.fetcherKind)) {
    return {
      ok: false,
      error:
        "`fetcherKind` must be one of: playwright, http, browserbase.",
    };
  }

  // autonomyMode
  if (typeof value.autonomyMode !== "string" || !isAutonomyMode(value.autonomyMode)) {
    return {
      ok: false,
      error:
        "`autonomyMode` must be one of: full-auto, diff-gated, always-agent.",
    };
  }

  // alertChannels
  const channelsRes = validateAlertChannels(value.alertChannels);
  if (!channelsRes.ok) {
    return { ok: false, error: channelsRes.error };
  }

  // confidenceThreshold (optional)
  let confidenceThreshold: number | undefined;
  if (value.confidenceThreshold !== undefined) {
    const r = validateBoundedNumber(
      value.confidenceThreshold,
      "confidenceThreshold",
      WATCH_LIMITS.confidenceMin,
      WATCH_LIMITS.confidenceMax,
    );
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    confidenceThreshold = r.value;
  }

  // diffThreshold (optional)
  let diffThreshold: number | undefined;
  if (value.diffThreshold !== undefined) {
    const r = validateBoundedNumber(
      value.diffThreshold,
      "diffThreshold",
      WATCH_LIMITS.diffThresholdMin,
      WATCH_LIMITS.diffThresholdMax,
    );
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    diffThreshold = r.value;
  }

  // ignoreSelectors (optional)
  let ignoreSelectors: ReadonlyArray<string> | undefined;
  if (value.ignoreSelectors !== undefined) {
    if (!isStringArray(value.ignoreSelectors)) {
      return {
        ok: false,
        error: "`ignoreSelectors` must be an array of strings.",
      };
    }
    if (value.ignoreSelectors.length > WATCH_LIMITS.ignoreSelectorsMax) {
      return {
        ok: false,
        error: `\`ignoreSelectors\` accepts up to ${WATCH_LIMITS.ignoreSelectorsMax} entries.`,
      };
    }
    ignoreSelectors = value.ignoreSelectors;
  }

  // useVisionDefault (optional)
  let useVisionDefault: boolean | undefined;
  if (value.useVisionDefault !== undefined) {
    if (typeof value.useVisionDefault !== "boolean") {
      return { ok: false, error: "`useVisionDefault` must be a boolean." };
    }
    useVisionDefault = value.useVisionDefault;
  }

  // dailyBudgetUsd (optional)
  let dailyBudgetUsd: number | undefined;
  if (value.dailyBudgetUsd !== undefined) {
    const r = validateBoundedNumber(
      value.dailyBudgetUsd,
      "dailyBudgetUsd",
      WATCH_LIMITS.dailyBudgetMinUsd,
      WATCH_LIMITS.dailyBudgetMaxUsd,
    );
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    dailyBudgetUsd = r.value;
  }

  // idempotencyKey (optional)
  let idempotencyKey: string | undefined;
  if (value.idempotencyKey !== undefined) {
    if (typeof value.idempotencyKey !== "string") {
      return { ok: false, error: "`idempotencyKey` must be a string." };
    }
    if (
      value.idempotencyKey.length === 0 ||
      value.idempotencyKey.length > WATCH_LIMITS.idempotencyKeyMax
    ) {
      return {
        ok: false,
        error: `\`idempotencyKey\` must be 1..${WATCH_LIMITS.idempotencyKeyMax} characters.`,
      };
    }
    idempotencyKey = value.idempotencyKey;
  }

  const spec: WatchSpec = {
    name,
    url: urlRes.value,
    cron: value.cron,
    intent,
    fetcherKind: value.fetcherKind,
    autonomyMode: value.autonomyMode,
    alertChannels: channelsRes.value,
    ...(confidenceThreshold !== undefined ? { confidenceThreshold } : {}),
    ...(diffThreshold !== undefined ? { diffThreshold } : {}),
    ...(ignoreSelectors !== undefined ? { ignoreSelectors } : {}),
    ...(useVisionDefault !== undefined ? { useVisionDefault } : {}),
    ...(dailyBudgetUsd !== undefined ? { dailyBudgetUsd } : {}),
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  };

  return { ok: true, spec };
}

// ---------------------------------------------------------------------------
// WatchUpdate validator (PATCH body)
// ---------------------------------------------------------------------------

export type ValidateWatchUpdateResult =
  | { ok: true; update: WatchUpdate }
  | { ok: false; error: string };

export function validateWatchUpdate(value: unknown): ValidateWatchUpdateResult {
  if (!isPlainObject(value)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  for (const key of Object.keys(value)) {
    if (!ALLOWED_UPDATE_KEYS.has(key)) {
      return { ok: false, error: `unexpected top-level key: ${key}` };
    }
  }
  if (Object.keys(value).length === 0) {
    return { ok: false, error: "PATCH body must contain at least one field." };
  }

  const update: Record<string, unknown> = {};

  if (value.name !== undefined) {
    if (typeof value.name !== "string") {
      return { ok: false, error: "`name` must be a string." };
    }
    const name = value.name.trim();
    if (
      name.length < WATCH_LIMITS.nameMin ||
      name.length > WATCH_LIMITS.nameMax
    ) {
      return {
        ok: false,
        error: `\`name\` must be ${WATCH_LIMITS.nameMin}..${WATCH_LIMITS.nameMax} chars.`,
      };
    }
    update.name = name;
  }

  if (value.cron !== undefined) {
    if (typeof value.cron !== "string" || !validateCron(value.cron)) {
      return {
        ok: false,
        error: "`cron` is not a valid 5-field cron expression or @-macro.",
      };
    }
    update.cron = value.cron;
  }

  if (value.autonomyMode !== undefined) {
    if (
      typeof value.autonomyMode !== "string" ||
      !isAutonomyMode(value.autonomyMode)
    ) {
      return {
        ok: false,
        error:
          "`autonomyMode` must be one of: full-auto, diff-gated, always-agent.",
      };
    }
    update.autonomyMode = value.autonomyMode;
  }

  if (value.alertChannels !== undefined) {
    const r = validateAlertChannels(value.alertChannels);
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    update.alertChannels = r.value;
  }

  if (value.status !== undefined) {
    if (typeof value.status !== "string" || !isWatchStatus(value.status)) {
      return {
        ok: false,
        error: "`status` must be one of: active, paused, archived.",
      };
    }
    // Only the operator-mutable subset is allowed via PATCH; `running`
    // and `failed` are runtime-internal transitions.
    if (
      value.status !== "active" &&
      value.status !== "paused" &&
      value.status !== "archived"
    ) {
      return {
        ok: false,
        error: "`status` (via PATCH) must be one of: active, paused, archived.",
      };
    }
    update.status = value.status;
  }

  if (value.confidenceThreshold !== undefined) {
    const r = validateBoundedNumber(
      value.confidenceThreshold,
      "confidenceThreshold",
      WATCH_LIMITS.confidenceMin,
      WATCH_LIMITS.confidenceMax,
    );
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    update.confidenceThreshold = r.value;
  }

  if (value.diffThreshold !== undefined) {
    const r = validateBoundedNumber(
      value.diffThreshold,
      "diffThreshold",
      WATCH_LIMITS.diffThresholdMin,
      WATCH_LIMITS.diffThresholdMax,
    );
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    update.diffThreshold = r.value;
  }

  if (value.ignoreSelectors !== undefined) {
    if (!isStringArray(value.ignoreSelectors)) {
      return {
        ok: false,
        error: "`ignoreSelectors` must be an array of strings.",
      };
    }
    if (value.ignoreSelectors.length > WATCH_LIMITS.ignoreSelectorsMax) {
      return {
        ok: false,
        error: `\`ignoreSelectors\` accepts up to ${WATCH_LIMITS.ignoreSelectorsMax} entries.`,
      };
    }
    update.ignoreSelectors = value.ignoreSelectors;
  }

  if (value.useVisionDefault !== undefined) {
    if (typeof value.useVisionDefault !== "boolean") {
      return { ok: false, error: "`useVisionDefault` must be a boolean." };
    }
    update.useVisionDefault = value.useVisionDefault;
  }

  if (value.dailyBudgetUsd !== undefined) {
    const r = validateBoundedNumber(
      value.dailyBudgetUsd,
      "dailyBudgetUsd",
      WATCH_LIMITS.dailyBudgetMinUsd,
      WATCH_LIMITS.dailyBudgetMaxUsd,
    );
    if (!r.ok) {
      return { ok: false, error: r.error };
    }
    update.dailyBudgetUsd = r.value;
  }

  return { ok: true, update: update as WatchUpdate };
}
