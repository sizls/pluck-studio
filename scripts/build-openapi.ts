// ---------------------------------------------------------------------------
// scripts/build-openapi.ts — auto-generate OpenAPI 3.1 spec for /v1/runs
// ---------------------------------------------------------------------------
//
// Reads the canonical taxonomy (BUREAU_PIPELINES, FUTURE_PIPELINES,
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
  BUREAU_PIPELINES,
  FUTURE_PIPELINES,
  RUN_STATUSES,
} from "../src/lib/v1/run-spec.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  version: string;
};

const TAG_RUNS = "Runs";
const EXAMPLE_RUN_ID = "openai-swift-falcon-3742";
const EXAMPLE_RECEIPT_URL = `/bureau/dragnet/runs/${EXAMPLE_RUN_ID}`;
const EXAMPLE_TS = "2026-05-04T17:00:00.000Z";

const exampleRunRecord = {
  runId: EXAMPLE_RUN_ID,
  pipeline: "bureau:dragnet",
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
  BureauPipeline: {
    type: "string",
    enum: [...BUREAU_PIPELINES],
    description:
      "One of the 11 Bureau program slugs. Each maps 1:1 to the legacy `/api/bureau/<slug>/run` route.",
  },
  RunSpecPipeline: {
    type: "string",
    enum: [...BUREAU_PIPELINES, ...FUTURE_PIPELINES],
    description:
      "All known pipelines — 11 Bureau slugs (shipped) + 4 future surface slugs (extract/sense/act/fleet, return 400 today).",
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
      receiptUrl: { type: "string", description: "Path to receipt page, e.g. `/bureau/dragnet/runs/<runId>`." },
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
    },
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
    content: errBody({ error: "authentication required", signInUrl: "/sign-in?redirect=/bureau/dragnet/run" }),
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
    description: "Per-IP+session rate limit exceeded.",
    content: errBody({ error: "too many requests — slow down and try again in a minute" }),
  },
} as const;

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

type Code = "200" | "400" | "401" | "403" | "404" | "409" | "429";

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
                summary: "Bureau DRAGNET — endpoint honesty probe",
                value: {
                  pipeline: "bureau:dragnet",
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
        { name: "pipeline", in: "query", required: false, schema: { $ref: "#/components/schemas/BureauPipeline" }, description: "Filter to one Bureau pipeline." },
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
                "id: 1\nevent: state\ndata: {\"runId\":\"openai-swift-falcon-3742\",\"pipeline\":\"bureau:dragnet\",\"status\":\"pending\",\"verdict\":null,\"verdictColor\":\"gray\",\"payload\":{\"targetUrl\":\"https://api.openai.com/v1/chat/completions\",\"probePackId\":\"canon-honesty\",\"cadence\":\"once\",\"authorizationAcknowledged\":true},\"response\":null,\"createdAt\":\"2026-05-04T17:00:00.000Z\",\"updatedAt\":\"2026-05-04T17:00:00.000Z\",\"receiptUrl\":\"/bureau/dragnet/runs/openai-swift-falcon-3742\"}\n\nid: 2\nevent: heartbeat\ndata: {\"ts\":1746381630000}\n\n",
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
      title: "Pluck Studio — /v1/runs API",
      version: pkg.version,
      summary: "Unified pipeline activation surface for the Pluck Bureau.",
      description:
        "Auto-generated from `src/lib/v1/run-spec.ts`. Pipeline + status enums are derived from `BUREAU_PIPELINES` / `FUTURE_PIPELINES` / `RUN_STATUSES`. Per-pipeline payload schemas live in `docs/V1_API.md` (not embedded here). Re-run `pnpm openapi:build` after any RunSpec / RunRecord / pipeline-validators / redactor change.",
      license: { name: "Proprietary", identifier: "LicenseRef-Sizls-Internal" },
      contact: { name: "Pluck Studio", url: "https://studio.pluck.run" },
    },
    servers: [
      { url: "https://studio.pluck.run", description: "production" },
      { url: "http://localhost:3030", description: "local dev" },
    ],
    tags: [{ name: TAG_RUNS, description: "Unified pipeline activation surface. POST creates, GET-list and GET-by-id are public-read, DELETE cancels." }],
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
