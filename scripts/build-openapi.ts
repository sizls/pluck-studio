// ---------------------------------------------------------------------------
// scripts/build-openapi.ts — auto-generate OpenAPI 3.1 spec for /v1/runs
// ---------------------------------------------------------------------------
//
// Reads the canonical taxonomy (PROGRAM_PIPELINES, FUTURE_PIPELINES,
// RUN_STATUSES) from `src/lib/v1/run-spec.ts` and emits a deterministic
// OpenAPI 3.1.0 JSON document at `public/openapi.json`. Served at
// runtime via `src/app/openapi.json/route.ts` (5-min public cache).
//
// REMINDER: re-run after any RunSpec / RunRecord / pipeline-validators
// / redactor change. The taxonomy invariant test
// (scripts/__tests__/build-openapi.test.ts) catches drift on the
// pipeline + status enums.
//
// Per-pipeline payload schemas intentionally live in V1_API.md — the
// spec treats `payload` as an open object so it stays under 800 lines.
// Run: `pnpm openapi:build` (uses `node --experimental-strip-types`).
// ---------------------------------------------------------------------------

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROGRAM_PIPELINES,
  FUTURE_PIPELINES,
  RUN_STATUSES,
} from "../src/lib/v1/run-spec.ts";
import {
  ALERT_CHANNEL_KEYS,
  AUTONOMY_MODES,
  FETCHER_KINDS,
  OBSERVATION_CLASSIFICATIONS,
  OBSERVATION_KINDS,
  OPERATOR_MUTABLE_STATUSES,
  WATCH_STATUSES,
} from "../src/lib/v1/watch-spec.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  version: string;
};

const TAG_RUNS = "Runs";
const TAG_WATCHES = "Watches";
const EXAMPLE_WATCH_ID = "openai-amber-falcon-3742";
const EXAMPLE_OBS_ID = "9c2a3e6a-3b6a-4d9f-9a3e-4d9f9a3e4d9f";
const EXAMPLE_OBS_PHRASE = "pluck:watch:openai-amber-falcon-3742:2026-05-13:obs-01-9f3a";
const EXAMPLE_RUN_ID = "openai-swift-falcon-3742";
const EXAMPLE_RECEIPT_URL = `/programs/dragnet/runs/${EXAMPLE_RUN_ID}`;
const EXAMPLE_TS = "2026-05-04T17:00:00.000Z";

const exampleRunRecord = {
  runId: EXAMPLE_RUN_ID,
  pipeline: "program:dragnet",
  status: "pending",
  verdict: null,
  verdictColor: "gray",
  payload: {
    targetUrl: "https://api.openai.com/v1/chat/completions",
    probePackId: "canon-honesty",
    cadence: "once",
    authorizationAcknowledged: true,
  },
  response: null,
  createdAt: EXAMPLE_TS,
  updatedAt: EXAMPLE_TS,
  receiptUrl: EXAMPLE_RECEIPT_URL,
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const schemas = {
  StudioPipeline: {
    type: "string",
    enum: [...PROGRAM_PIPELINES],
    description:
      "One of the 11 program slugs. Each maps 1:1 to the legacy `/api/programs/<slug>/run` route.",
  },
  RunSpecPipeline: {
    type: "string",
    enum: [...PROGRAM_PIPELINES, ...FUTURE_PIPELINES],
    description:
      "All known pipelines — 11 Pluck slugs (shipped) + 4 future surface slugs (extract/sense/act/fleet, return 400 today).",
  },
  RunStatus: {
    type: "string",
    enum: [...RUN_STATUSES],
    description: "`pending` → `running` → terminal (`anchored` | `failed` | `cancelled`).",
  },
  VerdictColor: {
    type: "string",
    enum: ["green", "amber", "red", "gray"],
    description: "Traffic-light tag used by receipt UIs. `gray` = no verdict yet.",
  },
  RunSpec: {
    type: "object",
    required: ["pipeline", "payload"],
    additionalProperties: false,
    properties: {
      pipeline: { $ref: "#/components/schemas/RunSpecPipeline" },
      payload: {
        type: "object",
        additionalProperties: true,
        description:
          "Per-pipeline payload — see docs/V1_API.md `Per-pipeline payload reference` for the 11 shapes.",
      },
      idempotencyKey: {
        type: "string",
        minLength: 1,
        maxLength: 256,
        description:
          "Caller-supplied. Same key + same canonicalised (pipeline, payload) returns the same runId (with `reused=true`).",
      },
    },
  },
  RunRecord: {
    type: "object",
    required: [
      "runId",
      "pipeline",
      "status",
      "verdict",
      "verdictColor",
      "payload",
      "response",
      "createdAt",
      "updatedAt",
      "receiptUrl",
    ],
    additionalProperties: false,
    properties: {
      runId: { type: "string", maxLength: 128, description: "phraseId — receipt URL primitive + share credential." },
      pipeline: { $ref: "#/components/schemas/RunSpecPipeline" },
      status: { $ref: "#/components/schemas/RunStatus" },
      verdict: { type: ["string", "null"], description: "Per-pipeline verdict tag once landed." },
      verdictColor: { $ref: "#/components/schemas/VerdictColor" },
      payload: {
        type: "object",
        additionalProperties: true,
        description:
          "Echoed payload (audit). Privacy redaction applies on GET — fields like WHISTLE.bundleUrl and ROTATE.operatorNote are stripped.",
      },
      response: { type: ["object", "null"], additionalProperties: true, description: "Pipeline-specific response — null until data exists." },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      receiptUrl: { type: "string", description: "Path to receipt page, e.g. `/programs/dragnet/runs/<runId>`." },
    },
  },
  CreateRunResponse: {
    type: "object",
    required: ["runId", "receiptUrl", "status", "reused"],
    additionalProperties: false,
    properties: {
      runId: { type: "string", maxLength: 128 },
      receiptUrl: { type: "string" },
      status: { $ref: "#/components/schemas/RunStatus" },
      reused: { type: "boolean", description: "True when an idempotency replay returned the existing record." },
    },
  },
  ListRunsResponse: {
    type: "object",
    required: ["runs", "nextCursor", "totalCount"],
    additionalProperties: false,
    properties: {
      runs: { type: "array", items: { $ref: "#/components/schemas/RunRecord" } },
      nextCursor: { type: ["string", "null"], description: "Opaque cursor; null when no more pages." },
      totalCount: { type: "integer", minimum: 0, description: "Total matching the filter across all pages." },
    },
  },
  CancelRunResponse: {
    allOf: [
      { $ref: "#/components/schemas/RunRecord" },
      {
        type: "object",
        required: ["alreadyCancelled"],
        properties: {
          alreadyCancelled: { type: "boolean", description: "True when the run was already cancelled (idempotent)." },
        },
      },
    ],
  },
  ErrorResponse: {
    type: "object",
    required: ["error"],
    additionalProperties: true,
    properties: {
      error: { type: "string" },
      signInUrl: { type: "string", description: "Present on 401 from POST. Pipeline-aware redirect." },
      status: { $ref: "#/components/schemas/RunStatus", description: "Present on 409 from DELETE — the final-state status." },
      retryAfterMs: { type: "integer", minimum: 0, description: "Present on 429 from POST /v1/watches/{id}/trigger — wait this many ms before retrying." },
    },
  },

  // -------------------------------------------------------------------------
  // /v1/watches schemas
  // -------------------------------------------------------------------------

  AutonomyMode: {
    type: "string",
    enum: [...AUTONOMY_MODES],
    description:
      "Watch-level autonomy. `diff-gated` runs a cheap text diff before the agent; `full-auto` always runs the agent + alerts when confidence > threshold; `always-agent` routes every observation to a human-confirm queue.",
  },
  FetcherKind: {
    type: "string",
    enum: [...FETCHER_KINDS],
    description: "How the worker fetches the watched URL. `browserbase` is a v2 stub.",
  },
  WatchStatus: {
    type: "string",
    enum: [...WATCH_STATUSES],
    description: "Watch lifecycle. `running` is transient; `failed` flips on consecutive errors; `archived` is soft-delete.",
  },
  ObservationKind: {
    type: "string",
    enum: [...OBSERVATION_KINDS],
    description: "What the runtime recorded. `baseline` is the first observation; `no-change` is the diff-gated short-circuit; `error` carries failure-as-data.",
  },
  ObservationClassification: {
    type: "string",
    enum: [...OBSERVATION_CLASSIFICATIONS],
    description: "Agent's semantic verdict over the snapshot.",
  },
  AlertChannels: {
    type: "object",
    // Derived from ALERT_CHANNEL_KEYS — drift-invariant test asserts equality.
    required: [...ALERT_CHANNEL_KEYS],
    additionalProperties: false,
    properties: {
      dashboard: { type: "boolean" },
      email: { type: "array", maxItems: 8, items: { type: "string", format: "email", maxLength: 254 } },
      webhook: { type: "array", maxItems: 4, items: { type: "string", format: "uri" } },
      slack: { type: "array", maxItems: 4, items: { type: "string", format: "uri" } },
      phraseId: { type: "boolean" },
    },
    description:
      "Inbound channel selection. All operator-supplied URLs (webhook, slack) pass the same public-host SSRF guard as the watch URL. At least one channel MUST be enabled.",
  },
  PublicAlertChannelSummary: {
    type: "object",
    required: ["dashboard", "phraseId", "emailCount", "webhookCount", "slackCount"],
    additionalProperties: false,
    properties: {
      dashboard: { type: "boolean" },
      phraseId: { type: "boolean" },
      emailCount: { type: "integer", minimum: 0 },
      webhookCount: { type: "integer", minimum: 0 },
      slackCount: { type: "integer", minimum: 0 },
    },
    description: "Redacted channel summary on public reads — address arrays are replaced with counts.",
  },
  WatchSpec: {
    type: "object",
    required: ["name", "url", "cron", "intent", "fetcherKind", "autonomyMode", "alertChannels"],
    additionalProperties: false,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      url: { type: "string", format: "uri", description: "Public http(s) URL. Localhost / RFC1918 / link-local / reserved-TLD rejected." },
      cron: { type: "string", description: "5-field cron or @-macro." },
      intent: { type: "string", minLength: 20, maxLength: 2000, description: "Natural-language directive — what the agent should watch for." },
      fetcherKind: { $ref: "#/components/schemas/FetcherKind" },
      autonomyMode: { $ref: "#/components/schemas/AutonomyMode" },
      alertChannels: { $ref: "#/components/schemas/AlertChannels" },
      confidenceThreshold: { type: "number", minimum: 0, maximum: 1, default: 0.75 },
      diffThreshold: { type: "number", minimum: 0, maximum: 1, default: 0.02 },
      ignoreSelectors: { type: "array", maxItems: 32, items: { type: "string" } },
      useVisionDefault: { type: "boolean", default: false },
      dailyBudgetUsd: { type: "number", minimum: 0, maximum: 100, default: 2.0 },
      idempotencyKey: { type: "string", minLength: 1, maxLength: 256 },
    },
  },
  WatchUpdate: {
    type: "object",
    additionalProperties: false,
    minProperties: 1,
    properties: {
      name: { type: "string", minLength: 1, maxLength: 120 },
      cron: { type: "string" },
      autonomyMode: { $ref: "#/components/schemas/AutonomyMode" },
      alertChannels: { $ref: "#/components/schemas/AlertChannels" },
      status: { type: "string", enum: [...OPERATOR_MUTABLE_STATUSES], description: "Operator-mutable subset of WatchStatus. `running` and `failed` are runtime-internal." },
      confidenceThreshold: { type: "number", minimum: 0, maximum: 1 },
      diffThreshold: { type: "number", minimum: 0, maximum: 1 },
      ignoreSelectors: { type: "array", maxItems: 32, items: { type: "string" } },
      useVisionDefault: { type: "boolean" },
      dailyBudgetUsd: { type: "number", minimum: 0, maximum: 100 },
    },
  },
  PublicWatchRecord: {
    type: "object",
    required: [
      "watchId", "name", "url", "cron", "intent", "fetcherKind", "autonomyMode", "status",
      "alertChannels", "confidenceThreshold", "diffThreshold", "ignoreSelectors",
      "useVisionDefault", "dailyBudgetUsd", "agentTokensSpentTotal", "agentCostUsdTotal",
      "lastObservationId", "lastFiredAt", "receiptUrl", "createdAt", "updatedAt",
    ],
    additionalProperties: false,
    properties: {
      watchId: { type: "string", maxLength: 128, description: "Pluck phrase-id; share credential for the receipt URL." },
      name: { type: "string" },
      url: { type: "string", format: "uri" },
      cron: { type: "string" },
      intent: { type: "string" },
      fetcherKind: { $ref: "#/components/schemas/FetcherKind" },
      autonomyMode: { $ref: "#/components/schemas/AutonomyMode" },
      status: { $ref: "#/components/schemas/WatchStatus" },
      alertChannels: { $ref: "#/components/schemas/PublicAlertChannelSummary" },
      confidenceThreshold: { type: "number" },
      diffThreshold: { type: "number" },
      ignoreSelectors: { type: "array", items: { type: "string" } },
      useVisionDefault: { type: "boolean" },
      dailyBudgetUsd: { type: "number" },
      agentTokensSpentTotal: { type: "integer", minimum: 0 },
      agentCostUsdTotal: { type: "number", minimum: 0 },
      lastObservationId: { type: ["string", "null"] },
      lastFiredAt: { type: ["string", "null"], format: "date-time", description: "ISO timestamp; null until first fire." },
      receiptUrl: { type: "string", description: "Path to the receipt page, e.g. `/watch/<watchId>`." },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
    description:
      "GET-side view of a watch — operator address lists in alertChannels (email/webhook/slack) are redacted to counts. The stored record retains the addresses.",
  },
  Observation: {
    type: "object",
    required: ["naturalLanguageSummary", "reasoning", "evidenceQuote", "causalExplanation", "extractedFields", "classification", "confidence", "alertWorthy", "suggestedNextCheckMs"],
    additionalProperties: false,
    properties: {
      naturalLanguageSummary: { type: "string", maxLength: 280 },
      reasoning: { type: "string", minLength: 20, maxLength: 1200 },
      evidenceQuote: { type: ["string", "null"] },
      causalExplanation: { type: ["string", "null"] },
      extractedFields: {
        type: "object",
        additionalProperties: { type: ["string", "number", "boolean", "null"] },
      },
      classification: { $ref: "#/components/schemas/ObservationClassification" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      alertWorthy: { type: "boolean" },
      suggestedNextCheckMs: { type: ["integer", "null"], minimum: 1 },
    },
  },
  ObservationRecord: {
    type: "object",
    required: ["observationId", "phraseId", "watchId", "kind", "prevObservationId", "observation", "errorMessage", "agentTokensUsed", "agentCostUsd", "modelUsed", "fetchedAt", "createdAt"],
    additionalProperties: false,
    properties: {
      observationId: { type: "string", format: "uuid" },
      phraseId: { type: "string", description: "`pluck:watch:<watchId>:<YYYY-MM-DD>:obs-<NN>-<r4>` — URL/Slack-safe." },
      watchId: { type: "string" },
      kind: { $ref: "#/components/schemas/ObservationKind" },
      prevObservationId: { type: ["string", "null"], description: "Null on first run and on `error` kind (don't chain errors to baselines)." },
      observation: { oneOf: [{ $ref: "#/components/schemas/Observation" }, { type: "null" }] },
      errorMessage: { type: ["string", "null"] },
      agentTokensUsed: { type: "integer", minimum: 0 },
      agentCostUsd: { type: "number", minimum: 0 },
      modelUsed: { type: ["string", "null"], description: "Provider/model that produced the observation. Null for `no-change` and Week-1 mock observations." },
      fetchedAt: { type: "string", format: "date-time" },
      createdAt: { type: "string", format: "date-time" },
    },
  },
  CreateWatchResponse: {
    type: "object",
    required: ["watchId", "receiptUrl", "status", "reused"],
    additionalProperties: false,
    properties: {
      watchId: { type: "string", maxLength: 128 },
      receiptUrl: { type: "string" },
      status: { $ref: "#/components/schemas/WatchStatus" },
      reused: { type: "boolean", description: "True when an idempotency replay returned the existing record." },
    },
    description: "Envelope-on-create. GET / PATCH / DELETE return the full PublicWatchRecord.",
  },
  WatchDetailResponse: {
    allOf: [
      { $ref: "#/components/schemas/PublicWatchRecord" },
      {
        type: "object",
        required: ["observations", "observationCount"],
        properties: {
          observations: { type: "array", items: { $ref: "#/components/schemas/ObservationRecord" } },
          observationCount: { type: "integer", minimum: 0 },
        },
      },
    ],
  },
  ListWatchesResponse: {
    type: "object",
    required: ["watches", "nextCursor", "totalCount"],
    additionalProperties: false,
    properties: {
      watches: { type: "array", items: { $ref: "#/components/schemas/PublicWatchRecord" } },
      nextCursor: { type: ["string", "null"] },
      totalCount: { type: "integer", minimum: 0 },
    },
  },
  DeleteWatchResponse: {
    allOf: [
      { $ref: "#/components/schemas/PublicWatchRecord" },
      {
        type: "object",
        properties: {
          alreadyArchived: { type: "boolean", description: "Present + true on idempotent replay." },
        },
      },
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Reusable response components
// ---------------------------------------------------------------------------

const errBody = (example: Record<string, unknown>) => ({
  "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" }, example },
});

const RESPONSES = {
  BadRequest: { description: "Invalid body, query, or path parameter.", content: errBody({ error: "`pipeline` is required." }) },
  Unauthorized: {
    description: "Missing or invalid Bearer token / session cookie.",
    content: errBody({ error: "authentication required", signInUrl: "/sign-in?redirect=/programs/dragnet/run" }),
  },
  Forbidden: {
    description: "Cross-site request rejected. Sec-Fetch-Site / Origin / Referer enforcement.",
    content: errBody({ error: "cross-site request rejected" }),
  },
  NotFound: { description: "Run not found.", content: errBody({ error: "run not found" }) },
  Conflict: {
    description: "Run is in a final state (`anchored` | `failed`) and cannot be cancelled.",
    content: errBody({ error: "run is in final state 'anchored' and cannot be cancelled", status: "anchored" }),
  },
  TooManyRequests: {
    description: "Per-IP+session rate limit exceeded; or — on POST /v1/watches/{id}/trigger — the per-watch 15 s cooldown is still active (`retryAfterMs` present in body, `Retry-After` header set).",
    content: errBody({ error: "too many requests — slow down and try again in a minute" }),
  },
  PayloadTooLarge: {
    description: "Request body exceeded the 64 KiB cap.",
    content: errBody({ error: "request body too large" }),
  },
} as const;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

type Code = "200" | "400" | "401" | "403" | "404" | "409" | "413" | "429";

const errRefs = (...codes: Exclude<Code, "200">[]) =>
  Object.fromEntries(
    codes.map((c) => [
      c,
      {
        "400": { $ref: "#/components/responses/BadRequest" },
        "401": { $ref: "#/components/responses/Unauthorized" },
        "403": { $ref: "#/components/responses/Forbidden" },
        "404": { $ref: "#/components/responses/NotFound" },
        "409": { $ref: "#/components/responses/Conflict" },
        "413": { $ref: "#/components/responses/PayloadTooLarge" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
      }[c],
    ]),
  );

const idParam = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", maxLength: 128 },
  description: "phraseId of the run.",
};

const authedSecurity = [{ bearerAuth: [] }, { sessionCookie: [] }];

const okJson = (schemaRef: string, description: string, example: unknown) => ({
  description,
  content: { "application/json": { schema: { $ref: schemaRef }, example } },
});

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const paths = {
  "/api/v1/runs": {
    post: {
      tags: [TAG_RUNS],
      summary: "Create a run",
      operationId: "createRun",
      description:
        "Activate any pipeline. Same-site enforced via Sec-Fetch-Site / Origin / Referer. Auth required — Supabase session cookie in production, dev-mode `Authorization: Bearer <token>` outside production. Idempotent: same `idempotencyKey` + canonicalised (pipeline, payload) returns the same `runId` with `reused=true`.",
      security: authedSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/RunSpec" },
            examples: {
              dragnet: {
                summary: "Pluck DRAGNET — endpoint honesty probe",
                value: {
                  pipeline: "program:dragnet",
                  payload: {
                    targetUrl: "https://api.openai.com/v1/chat/completions",
                    probePackId: "canon-honesty",
                    cadence: "once",
                    authorizationAcknowledged: true,
                  },
                  idempotencyKey: "client-retry-1",
                },
              },
            },
          },
        },
      },
      responses: {
        "200": okJson("#/components/schemas/CreateRunResponse", "Run created (or replayed via idempotency).", {
          runId: EXAMPLE_RUN_ID,
          receiptUrl: EXAMPLE_RECEIPT_URL,
          status: "pending",
          reused: false,
        }),
        ...errRefs("400", "401", "403", "429"),
      },
    },
    get: {
      tags: [TAG_RUNS],
      summary: "List recent runs (public read, redacted)",
      operationId: "listRuns",
      description:
        "Public-read by phraseId model. Same-site (CSRF) and rate-limit gates apply. Per-pipeline GET-side redaction applied to each item's `payload`.",
      security: [],
      parameters: [
        { name: "pipeline", in: "query", required: false, schema: { $ref: "#/components/schemas/StudioPipeline" }, description: "Filter to one Pluck pipeline." },
        { name: "since", in: "query", required: false, schema: { type: "string", format: "date-time" }, description: "Runs created strictly after this ISO-8601 timestamp." },
        { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        { name: "cursor", in: "query", required: false, schema: { type: "string", maxLength: 128 }, description: "Opaque pagination cursor." },
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string" },
          description:
            "RunStatus filter. Single value (`?status=cancelled`) or comma-separated (`?status=pending,running`). Whitespace tolerated.",
          examples: { single: { value: "cancelled" }, csv: { value: "pending,running" } },
        },
      ],
      responses: {
        "200": okJson("#/components/schemas/ListRunsResponse", "Paginated list of redacted run records.", {
          runs: [exampleRunRecord],
          nextCursor: null,
          totalCount: 1,
        }),
        ...errRefs("400", "403", "429"),
      },
    },
  },
  "/api/v1/runs/{id}": {
    get: {
      tags: [TAG_RUNS],
      summary: "Get a single run (public read, redacted)",
      operationId: "getRun",
      description:
        "Public read — the phraseId in the URL is the share credential. Same-site (CSRF) and rate-limit gates apply. Per-pipeline GET-side redaction applied to `payload`.",
      security: [],
      parameters: [idParam],
      responses: {
        "200": okJson("#/components/schemas/RunRecord", "Run record (with redacted payload).", exampleRunRecord),
        ...errRefs("400", "403", "404", "429"),
      },
    },
    // GET /api/v1/runs/{id}/events documented below as a sibling path —
    // OpenAPI Path Templates can't share a parent with a child path so
    // it lives at its own key.
    delete: {
      tags: [TAG_RUNS],
      summary: "Cancel a pending or running run",
      operationId: "cancelRun",
      description:
        "Cancel verb — does NOT erase the record. A cancelled run still resolves through GET so its receipt URL stays valid for audit + share. Auth required (same gate as POST). Final states (`anchored` | `failed`) return 409. Already-cancelled returns 200 with `alreadyCancelled=true`.",
      security: authedSecurity,
      parameters: [{ ...idParam, description: "phraseId of the run to cancel." }],
      responses: {
        "200": okJson("#/components/schemas/CancelRunResponse", "Run cancelled (or already cancelled, idempotent).", {
          ...exampleRunRecord,
          status: "cancelled",
          alreadyCancelled: false,
        }),
        ...errRefs("400", "401", "403", "404", "409", "429"),
      },
    },
  },
  "/api/v1/runs/{id}/events": {
    get: {
      tags: [TAG_RUNS],
      summary: "Server-Sent Events stream of run progress (public, redacted)",
      operationId: "streamRunEvents",
      description:
        "Long-lived `text/event-stream` connection. Emits an initial `state` event with the current redacted RunRecord on connect, a fresh `state` event on every status transition, and a `heartbeat` event every 30 seconds. Auto-closes after a 2s grace window when the run reaches a terminal status (`anchored` | `failed` | `cancelled`) and after a hard 5-minute lifetime cap. Honors the standard `Last-Event-ID` request header on reconnect — the server resumes its id counter from `Last-Event-ID + 1`. Same security posture as `GET /api/v1/runs/{id}`: same-site (CSRF) + rate-limit gates, NO auth gate (the phraseId in the URL is the share credential). Per-pipeline GET-side redaction applies to EVERY emitted state event — defense-in-depth at the SSE boundary. NOTE: OpenAPI has no first-class SSE schema; consumers should use the platform `EventSource` API (or equivalent).",
      security: [],
      parameters: [
        { ...idParam, description: "phraseId of the run to stream." },
        {
          name: "Last-Event-ID",
          in: "header",
          required: false,
          schema: { type: "string" },
          description:
            "Standard SSE reconnect header. Server resumes its event-id counter from `Last-Event-ID + 1`. Non-numeric values fall back to `1`.",
        },
      ],
      responses: {
        "200": {
          description:
            "SSE stream. Each message is `id: <n>\\nevent: <state|heartbeat|error>\\ndata: <json>\\n\\n`. The `state` event's `data` is a redacted RunRecord; the `heartbeat` event's `data` is `{ ts: <unix-ms> }`.",
          headers: {
            "Content-Type": {
              schema: { type: "string", const: "text/event-stream; charset=utf-8" },
            },
            "Cache-Control": {
              schema: { type: "string", const: "no-store, no-transform" },
            },
          },
          content: {
            "text/event-stream": {
              schema: { type: "string" },
              example:
                "id: 1\nevent: state\ndata: {\"runId\":\"openai-swift-falcon-3742\",\"pipeline\":\"program:dragnet\",\"status\":\"pending\",\"verdict\":null,\"verdictColor\":\"gray\",\"payload\":{\"targetUrl\":\"https://api.openai.com/v1/chat/completions\",\"probePackId\":\"canon-honesty\",\"cadence\":\"once\",\"authorizationAcknowledged\":true},\"response\":null,\"createdAt\":\"2026-05-04T17:00:00.000Z\",\"updatedAt\":\"2026-05-04T17:00:00.000Z\",\"receiptUrl\":\"/programs/dragnet/runs/openai-swift-falcon-3742\"}\n\nid: 2\nevent: heartbeat\ndata: {\"ts\":1746381630000}\n\n",
            },
          },
        },
        ...errRefs("400", "403", "404", "429"),
      },
    },
  },

  // -------------------------------------------------------------------------
  // /v1/watches paths
  // -------------------------------------------------------------------------

  "/api/v1/watches": {
    post: {
      tags: [TAG_WATCHES],
      summary: "Create a watch",
      operationId: "createWatch",
      description:
        "Create a periodic semantic monitor. Idempotent on `(ownerId, name, url, intent, fetcherKind, idempotencyKey)`. Returns the envelope on success — clients that need the full record after create should GET `/v1/watches/{watchId}`.",
      security: authedSecurity,
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/WatchSpec" },
            examples: {
              pricing: {
                summary: "OpenAI pricing watch (Playwright + diff-gated)",
                value: {
                  name: "OpenAI pricing watch",
                  url: "https://openai.com/pricing",
                  cron: "@daily",
                  intent:
                    "Alert when GPT-4 input token price changes from its current value, especially on the API pricing table.",
                  fetcherKind: "playwright",
                  autonomyMode: "diff-gated",
                  alertChannels: {
                    dashboard: true,
                    email: [],
                    webhook: [],
                    slack: [],
                    phraseId: true,
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "200": okJson(
          "#/components/schemas/CreateWatchResponse",
          "Watch created (or replayed via idempotency).",
          { watchId: EXAMPLE_WATCH_ID, receiptUrl: `/watch/${EXAMPLE_WATCH_ID}`, status: "active", reused: false },
        ),
        ...errRefs("400", "401", "403", "413", "429"),
      },
    },
    get: {
      tags: [TAG_WATCHES],
      summary: "List watches (public read, redacted)",
      operationId: "listWatches",
      description:
        "Public read by phraseId model — same posture as `/v1/runs`. Operator address lists in `alertChannels` are stripped (replaced with counts). Archived watches are hidden by default; pass `?status=archived` to surface them.",
      security: [],
      parameters: [
        {
          name: "status",
          in: "query",
          required: false,
          schema: { type: "string", maxLength: 128 },
          description:
            "WatchStatus filter. Single value or comma-separated (≤10 values). Unknown values return 400.",
          examples: { single: { value: "active" }, csv: { value: "active,paused" } },
        },
        { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
        { name: "cursor", in: "query", required: false, schema: { type: "string", maxLength: 128 } },
      ],
      responses: {
        "200": okJson("#/components/schemas/ListWatchesResponse", "Paginated list of redacted watch records.", {
          watches: [],
          nextCursor: null,
          totalCount: 0,
        }),
        ...errRefs("400", "403", "429"),
      },
    },
  },
  "/api/v1/watches/{id}": {
    get: {
      tags: [TAG_WATCHES],
      summary: "Get a watch (public read, redacted)",
      operationId: "getWatch",
      description:
        "Public read by phraseId. Response inlines the most recent observation history (cap 20) so the receipt page renders without a second round trip.",
      security: [],
      parameters: [{ ...idParam, description: "phraseId of the watch." }],
      responses: {
        "200": okJson("#/components/schemas/WatchDetailResponse", "Watch record + recent observations.", {
          watchId: EXAMPLE_WATCH_ID,
          name: "OpenAI pricing watch",
          url: "https://openai.com/pricing",
          cron: "@daily",
          intent: "Alert when GPT-4 input token price changes from its current value.",
          fetcherKind: "playwright",
          autonomyMode: "diff-gated",
          status: "active",
          alertChannels: { dashboard: true, phraseId: true, emailCount: 0, webhookCount: 0, slackCount: 0 },
          confidenceThreshold: 0.75,
          diffThreshold: 0.02,
          ignoreSelectors: [],
          useVisionDefault: false,
          dailyBudgetUsd: 2.0,
          agentTokensSpentTotal: 0,
          agentCostUsdTotal: 0,
          lastObservationId: null,
          lastFiredAt: null,
          receiptUrl: `/watch/${EXAMPLE_WATCH_ID}`,
          createdAt: EXAMPLE_TS,
          updatedAt: EXAMPLE_TS,
          observations: [],
          observationCount: 0,
        }),
        ...errRefs("400", "403", "404", "429"),
      },
    },
    patch: {
      tags: [TAG_WATCHES],
      summary: "Update a watch (subset)",
      operationId: "updateWatch",
      description:
        "Partial update. Operator-mutable fields only — `url`, `intent`, `fetcherKind` are immutable post-create (change those by archiving + recreating). Returns the full PublicWatchRecord.",
      security: authedSecurity,
      parameters: [idParam],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/WatchUpdate" },
            examples: { pause: { value: { status: "paused" } }, cron: { value: { cron: "0 */6 * * *" } } },
          },
        },
      },
      responses: {
        "200": okJson("#/components/schemas/PublicWatchRecord", "Updated watch record.", undefined),
        ...errRefs("400", "401", "403", "404", "409", "413", "429"),
      },
    },
    delete: {
      tags: [TAG_WATCHES],
      summary: "Archive a watch (soft delete)",
      operationId: "archiveWatch",
      description:
        "Archive verb — record stays for audit; observation history is preserved. `DELETE /v1/runs/:id` cancels because runs cannot be paused; `DELETE /v1/watches/:id` archives because watches CAN be paused via `PATCH status=paused`. Idempotent: already-archived returns 200 with `alreadyArchived: true`.",
      security: authedSecurity,
      parameters: [idParam],
      responses: {
        "200": okJson("#/components/schemas/DeleteWatchResponse", "Watch archived (or already archived).", undefined),
        ...errRefs("400", "401", "403", "404", "429"),
      },
    },
  },
  "/api/v1/watches/{id}/trigger": {
    post: {
      tags: [TAG_WATCHES],
      summary: "Fire a watch now (manual)",
      operationId: "triggerWatch",
      description:
        "Manual fire-now. Per-watch cooldown applies (15 s) to defeat trigger amplification — exceeded returns 429 with `Retry-After` + `retryAfterMs` payload. Week-1 stub runs a server-side fetch with manual redirect-walking + DNS-rebinding guard + HTTPS-downgrade rejection; Week-2 proxies to the Worker (Playwright + agent).",
      security: authedSecurity,
      parameters: [idParam],
      responses: {
        "200": okJson("#/components/schemas/ObservationRecord", "Observation recorded.", {
          observationId: EXAMPLE_OBS_ID,
          phraseId: EXAMPLE_OBS_PHRASE,
          watchId: EXAMPLE_WATCH_ID,
          kind: "baseline",
          prevObservationId: null,
          observation: null,
          errorMessage: null,
          agentTokensUsed: 0,
          agentCostUsd: 0,
          modelUsed: null,
          fetchedAt: EXAMPLE_TS,
          createdAt: EXAMPLE_TS,
        }),
        ...errRefs("400", "401", "403", "404", "409", "429"),
      },
    },
  },
  "/api/v1/watches/{id}/events": {
    get: {
      tags: [TAG_WATCHES],
      summary: "Server-Sent Events stream of watch progress (public, redacted)",
      operationId: "streamWatchEvents",
      description:
        "Long-lived `text/event-stream` connection. Emits an initial redacted PublicWatchRecord as a `state` event on connect; fresh `state` events on every transition; `observation` events when observations are recorded; `alert` events on per-channel dispatch (Week-2+); `heartbeat` every 30 s. Hard 5-minute connection cap. Honors `Last-Event-ID` (strict `^\\d{1,8}$`, clamped to `[0, 1_000_000]`). Per-watch subscriber cap 100 / global 5000 → `error` event + close.",
      security: [],
      parameters: [
        { ...idParam, description: "phraseId of the watch." },
        {
          name: "Last-Event-ID",
          in: "header",
          required: false,
          schema: { type: "string", pattern: "^\\d{1,8}$" },
          description: "Standard SSE reconnect header. Server resumes its event-id counter from `Last-Event-ID + 1`.",
        },
      ],
      responses: {
        "200": {
          description:
            "SSE stream. Each message is `id: <n>\\nevent: <state|observation|alert|heartbeat|error>\\ndata: <json>\\n\\n`. The `state` event's data is a `PublicWatchRecord`; `observation` data is an `ObservationRecord`; `heartbeat` data is `{ ts: <unix-ms> }`.",
          headers: {
            "Content-Type": { schema: { type: "string", const: "text/event-stream; charset=utf-8" } },
            "Cache-Control": { schema: { type: "string", const: "no-store, no-transform" } },
            "X-Content-Type-Options": { schema: { type: "string", const: "nosniff" } },
            "Referrer-Policy": { schema: { type: "string", const: "no-referrer" } },
          },
          content: {
            "text/event-stream": {
              schema: { type: "string" },
              example:
                "id: 1\nevent: state\ndata: {\"watchId\":\"openai-amber-falcon-3742\",\"status\":\"active\",\"cron\":\"@daily\",\"alertChannels\":{\"dashboard\":true,\"phraseId\":true,\"emailCount\":0,\"webhookCount\":0,\"slackCount\":0}}\n\nid: 2\nevent: heartbeat\ndata: {\"ts\":1746381630000}\n\n",
            },
          },
        },
        ...errRefs("400", "403", "404", "429"),
      },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Pluck Studio — /v1/runs + /v1/watches API",
      version: pkg.version,
      summary:
        "Unified pipeline activation (Pluck /v1/runs) + periodic semantic monitoring (/v1/watches).",
      description:
        "Auto-generated from `src/lib/v1/run-spec.ts` and `src/lib/v1/watch-spec.ts`. Pipeline + status enums are derived from the TypeScript taxonomy (`PROGRAM_PIPELINES` / `FUTURE_PIPELINES` / `RUN_STATUSES`, `AUTONOMY_MODES` / `FETCHER_KINDS` / `WATCH_STATUSES` / `OBSERVATION_KINDS` / `OBSERVATION_CLASSIFICATIONS`). Per-pipeline run payload schemas live in `docs/V1_API.md`. Re-run `pnpm openapi:build` after any spec / validator / redactor change.",
      license: { name: "Proprietary", identifier: "LicenseRef-Sizls-Internal" },
      contact: { name: "Pluck Studio", url: "https://studio.pluck.run" },
    },
    servers: [
      { url: "https://studio.pluck.run", description: "production" },
      { url: "http://localhost:3030", description: "local dev" },
    ],
    tags: [
      { name: TAG_RUNS, description: "Unified pipeline activation surface. POST creates, GET-list and GET-by-id are public-read, DELETE cancels." },
      { name: TAG_WATCHES, description: "Periodic semantic monitoring. POST creates, GET (list + single) are public-read, PATCH updates a subset, DELETE archives (soft delete), POST /trigger fires manually, GET /events streams SSE." },
    ],
    paths,
    components: {
      schemas,
      responses: RESPONSES,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Dev-mode affordance — accepted only outside production. Production honours `sessionCookie` only.",
        },
        sessionCookie: {
          type: "apiKey",
          in: "cookie",
          name: "sb-access-token",
          description: "Supabase JWT session cookie (production auth).",
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Entry point — only runs when invoked directly, not when imported by tests.
// ---------------------------------------------------------------------------

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const outDir = join(ROOT, "public");
  const outPath = join(outDir, "openapi.json");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(buildOpenApiDocument(), null, 2)}\n`, "utf8");
  // eslint-disable-next-line no-console
  console.log(`[build-openapi] wrote ${outPath}`);
}
