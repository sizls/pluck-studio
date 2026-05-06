# /v1/runs — unified pipeline activation API

The `/v1/runs` endpoint is the canonical surface for kicking off any
pipeline run inside Pluck Studio. It consolidates the 11 per-program
Bureau activation stubs (`/api/bureau/<slug>/run`) into a single
contract and is the seam where the real backend (Hono + Supabase +
Kite + Rekor) will swap in when the runner ships.

> **Status:** STUB. The current implementation persists runs to an
> in-memory `Map` in `src/lib/v1/run-store.ts`. The contract documented
> below is what the real backend implements; clients code against this
> contract today and pay zero migration tax when the swap lands.

---

## RunSpec

Inbound request body for `POST /api/v1/runs`:

```ts
interface RunSpec {
  pipeline: RunSpecPipeline;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

type RunSpecPipeline =
  // Bureau programs — shipped in stub form today
  | "bureau:dragnet"
  | "bureau:oath"
  | "bureau:fingerprint"
  | "bureau:custody"
  | "bureau:whistle"
  | "bureau:bounty"
  | "bureau:sbom-ai"
  | "bureau:rotate"
  | "bureau:tripwire"
  | "bureau:nuclei"
  | "bureau:mole"
  // Future surface — accepted by the schema, returns 400 today
  | "extract"
  | "sense"
  | "act"
  | "fleet";
```

`payload` is per-pipeline. For `bureau:<program>`, the payload shape is
the existing per-program request body (see "Per-pipeline payload
reference" below).

`idempotencyKey` is caller-supplied. The server hashes
`sha256(canonical-json({pipeline, payload, idempotencyKey}))` so the
same logical request always maps to the same `runId`. Replays return
the existing record with `reused: true`.

---

## RunRecord

Outbound shape for `GET /api/v1/runs/[id]` (and the source of truth
echoed back by `POST` indirectly via `runId` + `receiptUrl`):

```ts
interface RunRecord {
  runId: string;            // phrase ID — the canonical receipt URL primitive
  pipeline: RunSpecPipeline;
  status: "pending" | "running" | "anchored" | "failed" | "cancelled";
  verdict: string | null;
  verdictColor: "green" | "amber" | "red" | "gray";
  payload: Record<string, unknown>;
  response: Record<string, unknown> | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  receiptUrl: string; // /bureau/<program>/runs/<runId>
}
```

The `runId` is a phrase ID, not a UUID — same primitive that anchors
the receipt URL. Bureau pipelines that target a URL get a vendor-scoped
phrase (`openai-swift-falcon-3742`); the rest are slug-prefixed
(`custody-bright-stag-4012`).

---

## Authentication

Same posture as the legacy per-program routes — see
`src/lib/security/request-guards.ts`.

- **Auth:** Supabase JWT cookie (`sb-*-auth-token`) is the canonical
  signal. A `Bearer …` header is accepted only outside production as a
  dev affordance.
- **CSRF:** `Sec-Fetch-Site` must be `same-origin` or `same-site`;
  fallback to an `Origin`/`Referer` allowlist (`studio.pluck.run`,
  `localhost`).
- **Rate limit:** Per-IP+session bucket of 10 requests / 60s. The
  bucket map is capped at 10K entries to bound memory.

`POST /api/v1/runs` and `GET /api/v1/runs/[id]` share the same gate.

---

## Idempotency semantics

Two POSTs with the same canonicalised `(pipeline, payload, idempotencyKey)`
return the same `runId`. The server hashes:

```
sha256(canonical-json({ pipeline, payload, idempotencyKey }))
```

…with object keys deterministically sorted, so `{a:1,b:2}` and
`{b:2,a:1}` collide. Arrays preserve order.

When `idempotencyKey` is omitted, every POST creates a fresh run. The
DRAGNET form sends a minute-bucketed key
(`dragnet:<pack>:<url>:<cadence>:<minute>`) so a double-click within
~60s collapses to the same runId, but a deliberate "run again" 2
minutes later is a fresh run.

> **Edge case — minute-bucket boundary.** Two clicks straddling the
> :59 → :00 boundary (e.g. 14:32:59.4 and 14:33:00.1) fall into
> different buckets and produce different keys, even though they're
> only ~700ms apart. We accept this seam: the goal of the bucket is
> to absorb double-click bursts, not to guarantee dedupe over an
> arbitrary time window. Clients that need a stronger guarantee
> should pass an explicit caller-controlled `idempotencyKey`.

The legacy `POST /api/bureau/dragnet/run` route synthesizes the same
minute-bucketed key before delegating to the v1 store, so a legacy
double-click and a `/v1/runs` double-click with the same payload
return the SAME `phraseId`. Without this synthesis, every legacy POST
would create a ghost record that no `/v1/runs` caller could dedupe
against.

The response surfaces `reused: true` on idempotency replays — clients
can use this to differentiate "fresh run" from "your retry hit our
cache" without reading status codes.

### curl example — POST + idempotent replay

```bash
# First POST creates a new run.
curl -sS -X POST http://localhost:3030/api/v1/runs \
  -H 'content-type: application/json' \
  -H 'sec-fetch-site: same-origin' \
  -H 'authorization: Bearer dev-jwt' \
  -d '{
    "pipeline": "bureau:dragnet",
    "payload": {
      "targetUrl": "https://api.openai.com/v1/chat/completions",
      "probePackId": "canon-honesty",
      "cadence": "once",
      "authorizationAcknowledged": true
    },
    "idempotencyKey": "demo-run-2026-05-04"
  }'
# → { "runId": "openai-swift-falcon-3742",
#     "receiptUrl": "/bureau/dragnet/runs/openai-swift-falcon-3742",
#     "status": "pending", "reused": false }

# Replay with the SAME body returns the SAME runId — reused:true tells
# you it hit the idempotency cache, not a fresh run.
curl -sS -X POST http://localhost:3030/api/v1/runs \
  -H 'content-type: application/json' \
  -H 'sec-fetch-site: same-origin' \
  -H 'authorization: Bearer dev-jwt' \
  -d '{ … same body, same idempotencyKey … }'
# → { "runId": "openai-swift-falcon-3742", … "reused": true }

# Read the record back — public read, phraseId IS the share credential.
curl -sS http://localhost:3030/api/v1/runs/openai-swift-falcon-3742 \
  -H 'sec-fetch-site: same-origin'
# → full RunRecord
```

---

## `GET /api/v1/runs` — list recent runs

Companion to `GET /api/v1/runs/[id]`. Returns a paginated list of runs
in `createdAt` DESC order with optional filters and an opaque
cursor-based pagination scheme.

**Auth model.** Same posture as the single-record GET — public read by
phraseId is the contract. Same-site (CSRF) and rate-limit gates still
apply. The list endpoint does NOT require a Supabase session cookie or
Bearer token.

**Privacy.** Each list item's `payload` is run through the same
per-pipeline redactor (`src/lib/v1/redact.ts`) that the single-record
GET uses. WHISTLE.bundleUrl, WHISTLE.manualRedactPhrase, ROTATE.operatorNote
(and any future privacy-sensitive persisted fields) are stripped before
the payload is serialized. A list-scrape is not a deanonymization
vector.

### Query parameters

| Param | Type | Notes |
|---|---|---|
| `pipeline` | `bureau:<slug>` | Filter to a single bureau pipeline. Must be one of the 11 bureau slugs. Omit to include all pipelines. |
| `since` | ISO-8601 | Only runs created strictly AFTER this timestamp. Unparseable values return 400. |
| `limit` | integer | Page size. Clamped to `[1, 100]`; default `20`. |
| `cursor` | string ≤128 chars | Opaque pagination cursor — pass back the `nextCursor` from a prior response to fetch the next page. |
| `status` | `RunStatus` or CSV | Filter by status. Single value (`?status=cancelled`) matches one status; comma-separated (`?status=pending,running`) matches any. Allowed: `pending`, `running`, `anchored`, `failed`, `cancelled`. Unknown values return 400. Omit to include runs of any status (default — backward-compat). |

### Response shape

```ts
interface ListRunsResponse {
  runs: RedactedRunRecord[];   // each item's `payload` is per-pipeline redacted
  nextCursor: string | null;   // null when there are no more pages
  totalCount: number;          // total matching the filter (across all pages)
}
```

`totalCount` reflects the full filtered set so UIs can render
"showing 20 of N" without a second count query.

### Pagination semantics

The cursor is the `runId` of the last item from the previous page.
Pages do not overlap — the next page begins strictly AFTER the cursor's
record in `createdAt` DESC order (ties broken by `runId` for stable
ordering). A cursor that no longer resolves (e.g. the underlying run
TTL'd between pages) falls through to "start from the top" rather than
returning a 400 — callers shouldn't need to reason about TTL boundaries.

### curl example

```bash
# First page — newest 20 runs across all pipelines.
curl -sS 'http://localhost:3030/api/v1/runs?limit=20' \
  -H 'sec-fetch-site: same-origin'
# → { "runs": [...], "nextCursor": "openai-swift-falcon-3742", "totalCount": 47 }

# Filter to one pipeline + a creation cutoff.
curl -sS 'http://localhost:3030/api/v1/runs?pipeline=bureau:dragnet&since=2026-05-01T00:00:00Z' \
  -H 'sec-fetch-site: same-origin'

# Next page — pass the previous nextCursor.
curl -sS 'http://localhost:3030/api/v1/runs?limit=20&cursor=openai-swift-falcon-3742' \
  -H 'sec-fetch-site: same-origin'

# Active runs only — exclude cancelled/anchored/failed.
curl -sS 'http://localhost:3030/api/v1/runs?status=pending,running' \
  -H 'sec-fetch-site: same-origin'

# Combined filters — DRAGNET cancellations only.
curl -sS 'http://localhost:3030/api/v1/runs?pipeline=bureau:dragnet&status=cancelled' \
  -H 'sec-fetch-site: same-origin'
```

---

## `DELETE /api/v1/runs/[id]` — cancel a pending or running run

Completes the v1 read+write surface (POST / GET-list / GET-by-id /
DELETE). DELETE is the **cancel** verb — it does NOT erase the record.
A cancelled run still resolves through `GET /api/v1/runs/[id]` so its
receipt URL stays valid for audit + share.

**Auth model.** Same gate as `POST /api/v1/runs` — `isSameSiteRequest`
+ `rateLimitOk` + `isAuthed`. NOT public-read like the GET handlers;
cancelling is state-modifying so the caller must hold a Supabase
session cookie (or the dev-mode `Bearer` affordance).

**Privacy.** The success body echoes the cancelled record. The same
per-pipeline `redactPayloadForGet` redaction that the GET handler uses
runs on the cancel response too — without it, a WHISTLE `bundleUrl` or
ROTATE `operatorNote` would leak through the cancel path. The store
record itself is untouched (the canonical hash inputs are preserved).

### Status transitions

| From | DELETE result | HTTP |
|---|---|---|
| `pending` | flips to `cancelled` | 200 + record echo, `alreadyCancelled: false` |
| `running` | flips to `cancelled` (real backend signals the runner; stub just flips status) | 200 + record echo, `alreadyCancelled: false` |
| `cancelled` | idempotent — record unchanged | 200 + record echo, `alreadyCancelled: true` |
| `anchored` | rejected — already-final | 409 `{ error, status: "anchored" }` |
| `failed` | rejected — already-final | 409 `{ error, status: "failed" }` |
| missing runId | not found (or TTL'd) | 404 |

### Status codes

| Code | Meaning |
|---|---|
| `200` | Cancelled successfully (or already cancelled — idempotent). Body is the redacted RunRecord plus `alreadyCancelled: boolean`. |
| `400` | Invalid run id (length cap 128, same as GET). |
| `401` | Authentication required — caller must hold a Supabase session cookie (or dev-mode Bearer). |
| `403` | Cross-site request rejected (CSRF gate, same as POST). |
| `404` | Run not found (no such id, or TTL-evicted from the stub). |
| `409` | Run is in a final state (`anchored` or `failed`) and cannot be cancelled. Response body echoes the offending status. |
| `429` | Rate-limited — same per-IP+session bucket as POST/GET. |

### Idempotency

Cancelling a `cancelled` run is idempotent: the store record is not
re-mutated and the response carries `alreadyCancelled: true` so the
client can distinguish "fresh cancel" from "your retry hit an
already-cancelled run." `updatedAt` is preserved across idempotent
replays.

> **Stub-era authorization caveat (pre-pluck-api).** Today, ANY
> authenticated caller can cancel ANY run. The auth gate proves "the
> caller is signed in" but does NOT prove "the caller owns this run"
> — the run-store stub has no concept of run ownership yet. This will
> bind to the authenticated user identity at the same pluck-api
> inflection that adds `runs.owner_id`. Until then this is a known
> gap; MUST be fixed before public alpha. See the SECURITY block in
> `src/app/api/v1/runs/[id]/route.ts`. (Mirrors the NUCLEI
> author-handle stub gap — both close at the same migration.)

### curl example

```bash
# Cancel a pending or running run. Auth required — sb-session cookie
# (production) or the dev-mode Bearer affordance.
curl -X DELETE \
  -H "Cookie: sb-session=..." \
  -H "sec-fetch-site: same-origin" \
  https://studio.pluck.run/api/v1/runs/openai-swift-falcon-3742
# → 200 { runId, pipeline, status: "cancelled",
#         payload: <redacted>, …, alreadyCancelled: false }

# Replay — idempotent. The record is not re-mutated; the response
# tells you it was already cancelled.
curl -X DELETE \
  -H "Cookie: sb-session=..." \
  -H "sec-fetch-site: same-origin" \
  https://studio.pluck.run/api/v1/runs/openai-swift-falcon-3742
# → 200 { …, status: "cancelled", alreadyCancelled: true }

# Cancelling an anchored run is rejected — the receipt is final.
curl -X DELETE \
  -H "Cookie: sb-session=..." \
  -H "sec-fetch-site: same-origin" \
  https://studio.pluck.run/api/v1/runs/already-anchored-run-0001
# → 409 { error: "run is in final state 'anchored' and cannot be cancelled",
#         status: "anchored" }
```

After cancel, the run is still readable via `GET /api/v1/runs/[id]`
with `status: "cancelled"` — the receipt URL stays valid so the share
link doesn't 404 on the recipient.

---

## `GET /api/v1/runs/[id]/events` — Server-Sent Events stream

Long-lived `text/event-stream` connection that emits a fresh `state`
event on every status transition. Closes the read+streaming surface of
the v1 contract: POST creates, GET-by-id snapshots, DELETE cancels,
**this endpoint streams progress in real time**.

### Auth model

Same as `GET /api/v1/runs/[id]`: same-site (CSRF) + rate-limit gates,
**no auth gate**. The phraseId in the URL is the share credential — a
dashboard, a tweet, or a notification can subscribe without a Supabase
session. Browser EventSource clients open the connection automatically.

### Event types

| Event | When | `data` shape |
|---|---|---|
| `state` | On connect (initial snapshot) and on every status transition | Redacted RunRecord (same shape as `GET /api/v1/runs/[id]`) |
| `heartbeat` | Every 30 seconds, for liveness | `{ "ts": <unix-ms> }` |
| `error` | Per-run subscriber cap reached (rare) | `{ "code": "subscriber-cap-reached" }` |

The `state` event's payload runs through the same per-pipeline
redactor as `GET /api/v1/runs/[id]` — defense-in-depth at the SSE
boundary. WHISTLE.bundleUrl, ROTATE.operatorNote, etc. NEVER appear
in any emitted event (initial OR subsequent transitions).

### Auto-close behavior

- **Terminal status:** the stream emits the final `state` event for
  `anchored` / `failed` / `cancelled` and closes after a 2-second
  grace window so the last event reaches the client.
- **Hard lifetime cap:** 5 minutes. Clients that need longer streams
  reconnect via the standard `Last-Event-ID` mechanism.
- **Client disconnect:** closes the subscription immediately — the
  per-run subscriber Set drops the entry; if it was the last
  subscriber, the entry is removed from the runId map.

### `Last-Event-ID` reconnect semantics

Browsers and well-behaved EventSource implementations send the
last-seen event id back on auto-reconnect. The server resumes its
local id counter from `Last-Event-ID + 1` so the next event carries a
strictly-increasing id. **The stub does NOT replay missed events** —
the in-memory store has no event log. The client should re-sync the
canonical state from `GET /api/v1/runs/[id]` after a reconnect if it
needs catch-up. The Supabase swap replaces this with channel-replay
semantics; the request/response shape stays stable.

### EventSource example (browser)

```javascript
const es = new EventSource(
  "/api/v1/runs/openai-swift-falcon-3742/events",
);

es.addEventListener("state", (ev) => {
  const record = JSON.parse(ev.data);
  console.log(record.status, record.verdict);
  // Terminal status arrives just before the server closes the stream.
  if (["anchored", "failed", "cancelled"].includes(record.status)) {
    es.close();
  }
});

es.addEventListener("heartbeat", () => {
  // Optional — useful for `Last-Event-ID` reconnect debugging.
});

es.onerror = () => {
  // Browser auto-reconnects with `Last-Event-ID` on transient drops.
  // Re-sync from GET /api/v1/runs/[id] after a long disconnect.
};
```

### curl example

```bash
# Subscribe — initial state event arrives immediately, then heartbeats
# every 30s, then a final state event on cancel/anchor/fail.
curl -N \
  -H "sec-fetch-site: same-origin" \
  https://studio.pluck.run/api/v1/runs/openai-swift-falcon-3742/events
# id: 1
# event: state
# data: {"runId":"openai-swift-falcon-3742","status":"pending",…}
#
# id: 2
# event: heartbeat
# data: {"ts":1746381660000}
#
# (cancelled out-of-band by another client)
# id: 3
# event: state
# data: {…,"status":"cancelled"}
# (server closes after 2s grace window)

# Reconnect with Last-Event-ID — server resumes counter from 4.
curl -N \
  -H "sec-fetch-site: same-origin" \
  -H "Last-Event-ID: 3" \
  https://studio.pluck.run/api/v1/runs/openai-swift-falcon-3742/events
# id: 4
# event: state
# data: {…}
```

---

## Machine-readable spec — `/openapi.json`

The /v1/runs surface is published as an auto-generated OpenAPI 3.1
document at [`/openapi.json`](https://studio.pluck.run/openapi.json).
The spec is regenerated from `src/lib/v1/run-spec.ts` by the
`scripts/build-openapi.ts` generator and committed to
`public/openapi.json`. The `BureauPipeline` and `RunStatus` enums are
derived directly from `BUREAU_PIPELINES` and `RUN_STATUSES`, so adding
a new pipeline cannot drift the spec without a regeneration step (a
unit test asserts the invariant).

```bash
# Fetch the spec
curl https://studio.pluck.run/openapi.json | jq .info

# Regenerate after a RunSpec / RunRecord / pipeline-validators change
pnpm openapi:build
```

### Generating a client SDK

```bash
# TypeScript SDK via openapi-typescript
npx openapi-typescript https://studio.pluck.run/openapi.json -o pluck-runs.d.ts

# Python SDK via openapi-python-client
openapi-python-client generate --url https://studio.pluck.run/openapi.json

# Any of the 50+ generators in openapi-generator
openapi-generator-cli generate -i https://studio.pluck.run/openapi.json \
  -g go -o ./pluck-runs-go
```

Per-pipeline payload schemas are intentionally NOT embedded in the
spec — see "Per-pipeline payload reference" below for the 11
program-specific shapes. The OpenAPI document treats `payload` as an
open object so the spec stays under 800 lines and doesn't drift from
the per-pipeline validators in `src/lib/v1/pipeline-validators.ts`.

### MCP integration — `/api/mcp/manifest.json` + `/mcp`

The /v1/runs surface is also published as a **Studio MCP discovery
document** at [`/api/mcp/manifest.json`](https://studio.pluck.run/api/mcp/manifest.json).
The document declares the 11 Bureau programs as
`pluck://program/<slug>` resources, the canonical `pluck.search` /
`pluck.diff` / `pluck.run` tools (with JSON-Schema input shapes), and
the bearer-or-cookie auth posture. AI agents discover Studio through
this document; the external `@sizls/pluck-mcp` package consumes it and
exposes the MCP JSON-RPC runtime protocol against /v1/runs, binding
its tool catalog to the document's tool list.

**Framing — this is NOT an MCP-spec conformant manifest.** MCP itself
is a JSON-RPC RUNTIME protocol (`initialize` → `serverInfo` +
`capabilities`, then `tools/list`, `resources/list`, etc.) — it does
not specify a static manifest schema. The shape Studio publishes is
Studio-invented for discovery convenience. We deliberately do NOT
emit a `$schema` field; the document carries `specReference:
"https://modelcontextprotocol.io"` (the protocol homepage, not a
schema URL) and a top-level `description` spelling out the framing.
The bridge package is what speaks MCP; this document just tells the
bridge — and operators — what's behind /v1/runs.

The operator-facing wiring page lives at
[`/mcp`](https://studio.pluck.run/mcp) — copy-pastable
`mcp.config.json` snippets for Claude Desktop / Cursor, plus an
inline render of the document data the JSON endpoint serves. Same
public-read posture as `/openapi.json` (no auth, same-site CSRF +
rate-limit gates apply, 5-minute cache).

Until `@sizls/pluck-mcp` is published to npm, the page also shows a
direct `curl` loop against `/api/mcp/manifest.json` + `/api/v1/runs`
so operators can experiment today.

The document is built by `src/lib/mcp/build-manifest.ts` — pure
function over `ACTIVE_PROGRAMS` + `BUREAU_PIPELINES`. Adding a new
Bureau program auto-extends the resources list and the
`pluck.run` tool's pipeline enum; a snapshot test locks the
deterministic output, and an ajv-backed test compiles every
inputSchema against a real JSON-Schema validator (catches typos
visual review would miss). The `pluck://` URI namespace is stable —
once a resource ships, its URI shape is locked.

```bash
# Fetch the discovery document
curl https://studio.pluck.run/api/mcp/manifest.json | jq .

# Add Studio to Claude Desktop (when @sizls/pluck-mcp ships, this works)
cat <<'EOF' > ~/.config/claude-desktop/mcp.config.json
{
  "mcpServers": {
    "pluck-studio": {
      "command": "npx",
      "args": ["-y", "@sizls/pluck-mcp"],
      "env": {
        "PLUCK_STUDIO_URL": "https://studio.pluck.run",
        "PLUCK_STUDIO_TOKEN": "<your-bearer-token>"
      }
    }
  }
}
EOF
```

Studio does NOT implement the MCP wire protocol itself — the
document is purely informational discovery, like robots.txt or
openapi.json. External clients use the `@sizls/pluck-mcp` bridge.

---

## Per-pipeline payload reference

The canonical payload shape for each Bureau pipeline is defined by
that program's `lib/<program>/run-form-module.ts` and validated by the
legacy `/api/bureau/<program>/run` handler. Below is the migration
status. As each program migrates, its payload reference moves from
"see legacy route" to "see this section."

| Pipeline | Payload reference | Migrated to /v1/runs |
|---|---|---|
| `bureau:dragnet` | `src/lib/dragnet/run-form-module.ts` | **Yes (Phase 3 wedge)** |
| `bureau:nuclei` | `src/lib/nuclei/run-form-module.ts` | **Yes (Wave 1)** |
| `bureau:oath` | `src/lib/oath/run-form-module.ts` | **Yes (Wave 1)** |
| `bureau:fingerprint` | `src/lib/fingerprint/run-form-module.ts` | **Yes (Wave 2)** |
| `bureau:custody` | `src/lib/custody/run-form-module.ts` | **Yes (Wave 2)** |
| `bureau:mole` | `src/lib/mole/run-form-module.ts` | **Yes (Wave 2)** |
| `bureau:bounty` | `src/lib/bounty/run-form-module.ts` | **Yes (Wave 3)** |
| `bureau:sbom-ai` | `src/lib/sbom-ai/run-form-module.ts` | **Yes (Wave 3)** |
| `bureau:rotate` | `src/lib/rotate/run-form-module.ts` | **Yes (Wave 3)** |
| `bureau:tripwire` | `src/lib/tripwire/run-form-module.ts` | **Yes (Wave 3)** |
| `bureau:whistle` | `src/lib/whistle/run-form-module.ts` | **Yes (Wave 3)** |

**Migration progress:** 11/11 Bureau pipelines now POST to `/v1/runs` —
the entire alpha-program surface is on the unified contract. Every
legacy `/api/bureau/<slug>/run` route stays alive as a deprecated alias
that delegates to the same shared validator and dual-writes into the
v1 store, so legacy and v1 callers converge on the same `phraseId` for
the same payload.

### `bureau:dragnet` payload

```ts
{
  targetUrl: string;          // public URL (no localhost / RFC1918)
  probePackId: string;        // "canon-honesty" or "<author>/<pack>@<version>"
  cadence: "once" | "continuous";  // continuous returns 400 today
  authorizationAcknowledged: true; // must be literal true
}
```

### `bureau:nuclei` payload

```ts
{
  author: string;              // short lowercase slug, ≤32 chars (e.g. "alice")
  packName: string;            // "<slug>@<version>" (e.g. "canon-honesty@0.1")
  sbomRekorUuid: string;       // 64–80 hex chars (SBOM-AI cross-reference)
  vendorScope: string;         // comma-separated `<vendor>/<model>` pairs
  license: string;             // SPDX identifier from ALLOWED_LICENSES
  recommendedInterval: string; // 5-field cron OR @-macro (≤64 chars)
  authorizationAcknowledged: true; // must be literal true
}
```

> **Security note (pre-pluck-api).** The `author` handle is
> operator-asserted, NOT bound to the authenticated user identity.
> Anyone authenticated can submit any handle and reserve the slug —
> the phrase-ID prefix bakes the handle into the public receipt URL,
> which becomes an impersonation primitive once the registry goes
> public. This will be bound to authenticated identity at NUCLEI v1.0
> GA. See the SECURITY block in
> `src/app/api/bureau/nuclei/run/route.ts` (AE R1 finding S1).

The runId is **author-scoped** (`alice-swift-falcon-3742`) — receipt URL
self-discloses the publishing operator. Idempotency key shape used by
the RunForm + legacy alias:
`nuclei:<author>:<packName>:<sbomRekorUuid>:<minute-bucket>`.

#### Pre-fill via query params (SBOM-AI cross-publish)

The NUCLEI run form (`/bureau/nuclei/run`) accepts two optional
query params for handoff from the SBOM-AI receipt CTA:

| Param | Form field | Notes |
|---|---|---|
| `sbomRekorUuid` | `sbomRekorUuid` | Lowercased + trimmed; must still satisfy the 64–80 hex validator |
| `packName` | `packName` | Trimmed; must still match `<slug>@<version>` |

When either is present, a "Pre-filled from SBOM-AI receipt" banner
renders above the form and the operator must STILL review + click
submit (auth-ack required). Mirrors the DRAGNET `?vendor=&assertion=`
prefill pattern from `/extract`. The NUCLEI receipt back-links to the
SBOM-AI source artifact via the rekor UUID code block + cosign verify
command in the "Source artifact" section.

### `bureau:oath` payload

```ts
{
  vendorDomain: string;        // bare hostname or full URL → normalized to hostname
  hostingOrigin?: string;      // optional override; defaults to `https://<vendorDomain>`
                               // must be https://, no private/localhost
  // Legacy alias accepted by the validator for back-compat:
  expectedOrigin?: string;     // same semantics as hostingOrigin
  authorizationAcknowledged: true; // must be literal true
}
```

The runId is **vendor-scoped** (`openai-swift-falcon-3742`) — receipt
URL self-discloses the OATH target. Idempotency key shape used by the
RunForm + legacy alias:
`oath:<vendorDomain>:<effectiveHostingOrigin>:<minute-bucket>`, where
`effectiveHostingOrigin` is the explicit override or
`https://<vendorDomain>` when omitted.

### `bureau:fingerprint` payload

```ts
{
  vendor: string;          // hosted-mode allowlist slug ("openai", "anthropic", …)
  model: string;           // vendor-specific model slug ("gpt-4o", "claude-3-5-sonnet")
  authorizationAcknowledged: true; // must be literal true
}
```

The runId is **vendor-scoped** (`openai-swift-falcon-3742`) — receipt
URL self-discloses the scanned vendor. The vendor must be in the
hosted-mode allowlist (see `src/lib/fingerprint/run-form-module.ts` for
the canonical list); unsupported vendors are rejected with a 400 +
`supportedVendors` array so the client can surface alternatives. Run
the OSS `pluck bureau fingerprint scan --responder` CLI for vendors
outside the allowlist.

Idempotency key shape used by the RunForm + legacy alias:
`fingerprint:<vendor>:<model>:<minute-bucket>`.

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`, `vendor`,
`model`, `status: "scan pending"`, `deprecated: true`, and
`replacement: "/api/v1/runs"`.

### `bureau:custody` payload

```ts
{
  bundleUrl: string;             // HTTPS-only public URL of the CustodyBundle
  expectedVendor?: string;       // optional — bare hostname (e.g. "openai.com")
                                 //   used both to assert the bundle's
                                 //   self-declared vendor AND as the runId
                                 //   phrase prefix when present
  vendorDomain?: string;         // mirror of expectedVendor — the form posts
                                 //   both fields so canonicalJson() drops
                                 //   them identically when omitted, and the
                                 //   run-store's vendor-scoping picks
                                 //   expectedVendor over the bundle host
  authorizationAcknowledged: true; // must be literal true
}
```

The runId scoping rule: when `expectedVendor` (and its `vendorDomain`
mirror) is present, the runId is **vendor-scoped**
(`openai-swift-falcon-3742`); when absent, it falls back to the
**bundle hostname** (`example-swift-falcon-3742`). Either way the
receipt URL self-discloses the verification target.

Idempotency key shape used by the RunForm + legacy alias:
`custody:<vendorOrUnknown>:<bundleUrl>:<minute-bucket>`, where
`vendorOrUnknown` is the explicit `expectedVendor` or the literal
string `"unknown"` (so a generic bundle still has a stable dedupe
shape across legacy + /v1/runs).

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`,
`bundleUrl`, `expectedVendor` (or null), `status: "verification pending"`,
`deprecated: true`, and `replacement: "/api/v1/runs"`.

### `bureau:mole` payload

```ts
{
  canaryId: string;              // operator slug (≤48 chars, e.g. "nyt-2024-01-15")
  canaryUrl: string;             // HTTPS-only public URL of the canary content
                                 //   (Studio fetches + sha256-hashes; the body
                                 //   itself is NEVER published)
  fingerprintPhrases: string;    // comma-separated short phrases (10–80 chars
                                 //   each, ≤7 phrases) that should appear in
                                 //   the canary verbatim
  authorizationAcknowledged: true; // must be literal true
}
```

> **PRIVACY INVARIANT — canaryBody is NEVER accepted on the payload.**
>
> MOLE's load-bearing privacy posture: the canary body itself stays
> with the operator. Only `canaryId`, `canaryUrl`, and the
> operator-supplied fingerprint phrases (the public-log subset) enter
> the wire. The shared `validateMolePayload` validator enforces this
> as a defense-in-depth check: any payload carrying `canaryBody` or
> `canaryContent` is rejected with a 400 — even on the legacy
> `/api/bureau/mole/run` alias. Receipts schema-drops these fields
> at render; the validator backstops the wire so a misbuilt client
> can't accidentally leak the body. See "Sealing comes BEFORE
> probing" in the MOLE landing for context.

The runId is **canary-id-scoped** — receipt URL self-discloses
*which* canary was sealed, never the body. The phrase prefix is the
canaryId with non-alphanumerics stripped (e.g. `nyt-2024-01-15` →
`nyt20240115-swift-falcon-3742`).

Idempotency key shape used by the RunForm + legacy alias:
`mole:<canaryId>:<canaryUrl>:<minute-bucket>`.

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`,
`canaryId`, `canaryUrl`, the parsed `fingerprintPhrases` array (NOT
the canary body), `status: "seal pending"`, `deprecated: true`, and
`replacement: "/api/v1/runs"`.

### `bureau:bounty` payload

```ts
{
  sourceRekorUuid: string;     // 64–80 hex chars (the source DRAGNET red dot,
                               //   FINGERPRINT delta, or MOLE verdict that
                               //   grounds the filing)
  target: "hackerone" | "bugcrowd"; // platform to file against
  program: string;             // platform-specific program slug ("openai")
  vendor: string;              // affected vendor slug ("openai")
  model: string;               // affected model slug ("gpt-4o")
  authorizationAcknowledged: true; // must be literal true
}
```

> **Security note — auth tokens stay LOCAL.** HackerOne / Bugcrowd
> credentials NEVER cross this surface. Studio reads operator-stored
> tokens at dispatch time. The validator additionally rejects any
> payload key that smells like an auth token (header-style
> `authorization` / `bearer`, env-style `*_TOKEN` / `*_API_KEY` /
> `*_SECRET`) — defense-in-depth backstop in case a misbuilt client
> tries to forward a credential.

The runId is **target-platform-scoped**
(`hackerone-swift-falcon-3742`, `bugcrowd-…`) — the receipt URL
self-discloses *which platform was filed against*; the affected vendor
lives in the receipt body. Note: BOUNTY's payload also carries
`vendor`, but the run-store's scoping resolves `target` first so the
URL surfaces the platform.

Idempotency key shape used by the RunForm + legacy alias:
`bounty:<target>:<program>:<sourceRekorUuid>:<minute-bucket>`.

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`, `target`,
`program`, `vendor`, `model`, `sourceRekorUuid`, `status: "filing pending"`,
`deprecated: true`, and `replacement: "/api/v1/runs"`.

### `bureau:sbom-ai` payload

```ts
{
  artifactUrl: string;         // HTTPS-only public URL of the artifact body
  artifactKind: "probe-pack" | "model-card" | "mcp-server";
  expectedSha256?: string;     // optional 64-hex cross-check; omitted when empty
  authorizationAcknowledged: true; // must be literal true
}
```

The runId is **artifact-kind-scoped** — the receipt URL surfaces the
artifact category in the URL itself
(`probepack-…`, `modelcard-…`, `mcpserver-…`, with non-alphanumerics
stripped per slug normalization).

Idempotency key shape used by the RunForm + legacy alias:
`sbom-ai:<artifactKind>:<artifactUrl>:<expectedSha256OrNone>:<minute-bucket>`,
where `expectedSha256OrNone` is the literal string `"none"` when the
operator omits the optional cross-check.

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`,
`artifactKind`, `artifactUrl`, `expectedSha256` (or null),
`status: "publish pending"`, `deprecated: true`, and
`replacement: "/api/v1/runs"`.

#### Cross-publish to NUCLEI

When `artifactKind === "probe-pack"` and the SBOM-AI receipt has
anchored, the receipt surfaces a **"Publish to NUCLEI registry →"**
CTA. The CTA links to:

```
/bureau/nuclei/run?sbomRekorUuid=<rekorUuid>
```

The NUCLEI form pre-fills the `sbomRekorUuid` field from the query
param so operators don't retype the cross-reference. `model-card`
and `mcp-server` artifacts do NOT show the CTA — NUCLEI registry
only accepts probe-pack artifacts. Mirrors the DRAGNET
`?vendor=&assertion=` prefill pattern from the `/extract` integration.

### `bureau:rotate` payload

```ts
{
  oldKeyFingerprint: string;   // 64-hex SPKI sha256 (PUBLIC key)
  newKeyFingerprint: string;   // 64-hex SPKI sha256 (PUBLIC key); MUST != old
  reason: "compromised" | "routine" | "lost";
  operatorNote?: string;       // optional ≤512 char free-form context
  authorizationAcknowledged: true; // must be literal true
}
```

> **Security note — private-key material NEVER on the wire.** ROTATE
> only ever sees PUBLIC SPKI fingerprints. The operator's runner signs
> revocations server-side with operator-held HSM keys. The validator
> rejects any payload key resembling private-key material
> (`privateKey`, `private_key`, `*secret`, `pem`, `privkey`, …) —
> defense-in-depth backstop on the "Studio handles only public
> material" posture.
>
> **GET-side redaction.** `operatorNote` is accepted at submission
> (operator-supplied free-form context, e.g. "scheduled rotation Q3")
> but is **NOT echoed in the public `GET /api/v1/runs/[id]` response**.
> The phraseId is the share credential and the URL prefix is reason-
> scoped (compromised/routine/lost) — that's already a deliberate
> social-pressure signal, but the optional note could carry attacker
> IOCs or internal-investigation language the operator did not intend
> to surface at GET-by-phraseId resolution. The per-pipeline redactor
> in `src/lib/v1/redact.ts` strips it; the run-store record is
> untouched so canonical idempotency stays stable. Defense-in-depth:
> redaction at the GET boundary.

The runId is **reason-scoped** — the receipt URL surfaces *why* the
rotation happened (`compromised-…`, `routine-…`, `lost-…`). This is a
deliberate social-pressure signal: "compromised" rotations are
visible from the URL alone.

Idempotency key shape used by the RunForm + legacy alias:
`rotate:<reason>:<oldKeyFingerprint>:<newKeyFingerprint>:<minute-bucket>`.

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`,
`oldKeyFingerprint`, `newKeyFingerprint`, `reason`,
`status: "rotation pending"`, `deprecated: true`, and
`replacement: "/api/v1/runs"`.

### `bureau:tripwire` payload

```ts
{
  machineId: string;           // operator slug (≤48 chars, e.g. "alice-mbp")
  policySource: "default" | "custom";
  customPolicyUrl?: string;    // required when policySource = "custom";
                               //   HTTPS-only, no localhost / private IPs
  notarize: boolean;           // whether non-green cassettes auto-publish to Rekor
  authorizationAcknowledged: true; // must be literal true
}
```

The runId is **machine-id-scoped** — each machine's deployment has
its own permanent receipt URL (`alicembp-swift-falcon-3742`, with
non-alphanumerics stripped).

Idempotency key shape used by the RunForm + legacy alias:
`tripwire:<machineId>:<policySource>:<minute-bucket>`. Note: the
`customPolicyUrl` is part of the canonical payload (so a
default-policy run and a custom-policy run dedupe separately) but is
NOT part of the idempotency key string itself.

The Phase-2.5 runner that actually fetches `customPolicyUrl` MUST
re-validate scheme + re-resolve hostname (TOCTOU) + reject redirects +
cap timeout/size + parse untrusted JSON without `eval`. See the
SECURITY block in `lib/v1/pipeline-validators.ts` for the full
runner contract.

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`,
`machineId`, `policySource`, `notarize`,
`status: "configuration pending"`, `deprecated: true`, and
`replacement: "/api/v1/runs"`.

### `bureau:whistle` payload

```ts
{
  bundleUrl: string;           // HTTPS-only public URL — fetched server-side,
                               //   NEVER echoed in the response
  category: "training-data" | "policy-violation" | "safety-incident";
  routingPartner: "propublica" | "bellingcat" | "404media" | "eff-press";
  manualRedactPhrase?: string; // optional ≤256 char scrub phrase
  anonymityCaveatAcknowledged: true; // must be literal true
  authorizationAcknowledged: true;   // must be literal true
}
```

> **Security note — anonymity-by-default.** WHISTLE's load-bearing
> posture is operator anonymity. The receipt URL prefix is the
> **routing-partner slug** (NEVER the source); the `bundleUrl`
> participates in the canonical hash for idempotency dedupe but is
> intentionally NOT echoed in the response body. The validator
> additionally rejects any payload key resembling source-identifying
> material (`sourceName`, `sourceEmail`, `sourceIp`, `sourceHandle`,
> `reporterName`, `reporterEmail`, etc.) — defense-in-depth backstop
> in case a misbuilt client tries to "be helpful" by forwarding
> identifying info. Anonymity is best-effort, NOT absolute; both ack
> checkboxes are required.
>
> **GET-side redaction.** `bundleUrl` is required at submission (the
> routing partner needs to retrieve the bundle), but it is **NOT echoed
> in the public `GET /api/v1/runs/[id]` response**. The phraseId is the
> share credential; if it leaked the URL, anyone could trace the source.
> The same applies to `manualRedactPhrase` (the operator-supplied scrub
> phrase). The per-pipeline redactor in `src/lib/v1/redact.ts` strips
> these fields from the GET response shape; the run-store record is
> untouched so the canonical idempotency hash remains stable across
> retries. Defense-in-depth: redaction at the GET boundary.

The runId is **routing-partner-scoped** — the receipt URL self-
discloses *which newsroom received the tip*, never the source
(`propublica-…`, `bellingcat-…`, `404media-…`, `effpress-…` with
non-alphanumerics stripped).

Idempotency key shape used by the RunForm + legacy alias:
`whistle:<routingPartner>:<category>:<bundleUrl>:<minute-bucket>`.
The `bundleUrl` is part of the dedupe key so re-submitting the same
bundle to the same partner within a minute collapses; submitting to
a DIFFERENT partner produces a separate run record (each partner
gets its own routing receipt).

**Response (200):** `{ runId, receiptUrl, status: "pending", reused }`.
The legacy alias additionally echoes `runId === phraseId`, `category`,
`routingPartner`, `status: "submission pending"`, `deprecated: true`,
and `replacement: "/api/v1/runs"`. **Note:** `bundleUrl` is
intentionally NOT echoed.

---

## Migration runway

**Status: 11/11 Bureau pipelines migrated — full alpha surface on the
unified contract.**

DRAGNET was the **wedge migration** — the first program to POST to the
unified surface. NUCLEI and OATH followed in Wave 1; FINGERPRINT,
CUSTODY, and MOLE in Wave 2; BOUNTY, SBOM-AI, ROTATE, TRIPWIRE, and
WHISTLE in Wave 3 (this commit). All 11 alpha-program legacy routes
now stay alive as deprecated aliases that delegate to the shared
validator and dual-write into the v1 store.

1. **DRAGNET** (shipped in Phase 3 wedge).
2. **NUCLEI + OATH** (Wave 1). Both POST to `/v1/runs`; legacy aliases
   dual-write so legacy + /v1/runs callers converge on the same
   `phraseId` for the same payload.
3. **FINGERPRINT + CUSTODY + MOLE** (Wave 2). Same pattern. MOLE
   additionally enforces the canary-body privacy invariant on the
   wire.
4. **BOUNTY + SBOM-AI + ROTATE + TRIPWIRE + WHISTLE** (Wave 3 — this
   commit). Same delegated-validator + dual-write pattern. Three of
   the five carry hard-locked privacy invariants at the validator
   boundary:
   - **BOUNTY** rejects any auth-token-shaped payload key
     (`authorization`, `bearer`, `*_TOKEN`, `*_API_KEY`, `*_SECRET`).
   - **ROTATE** rejects any private-key-material-shaped payload key
     (`privateKey`, `private_key`, `*secret`, `pem`, `privkey`).
   - **WHISTLE** rejects any source-identifying payload key (`sourceName`,
     `sourceEmail`, `sourceIp`, `*_handle`, `reporterName`, …) AND
     intentionally drops `bundleUrl` from the response (anonymity-
     by-default).

**100% migration complete** — no Bureau pipeline still posts directly
to its `/api/bureau/<slug>/run` route. New client code should target
`/v1/runs`; existing legacy callers continue to work unchanged
through the deprecated aliases until the runner GA + RFC 8594
sunset.

**v1 read+streaming surface is structurally complete:** POST creates
+ GET-list + GET-by-id + DELETE-cancel + SSE-events. The remaining
work to graduate `/v1/runs` from stub to GA is the backend swap
(Supabase + DSSE + Rekor + Realtime — see "Backend swap plan" below);
the HTTP contract is frozen.

The legacy `POST /api/bureau/<slug>/run` routes stay alive as
deprecated aliases throughout. Internally, the migrated routes
delegate to `lib/v1/run-store` so old callers and new callers see the
same record from `GET /api/v1/runs/[id]`.

---

## Backend swap plan

The current implementation is a stub. The real backend lands as:

1. **Persistence:** Supabase Postgres `runs` table, RLS-enforced. Same
   `RunRecord` shape; `getRun` becomes `SELECT … FROM runs WHERE id = $1`.
2. **Pipeline execution:** Hono service in `@sizls/pluck-api` reads
   pending rows and invokes the appropriate runner (probe pack, DSP
   sensor, browser agent). Status transitions write back to the row.
3. **DSSE signing:** Each terminal-state run produces a DSSE envelope
   signed by the Pluck-fleet hosted key
   (`/.well-known/pluck-keys.json`).
4. **Rekor anchoring:** The DSSE envelope is anchored in Sigstore
   Rekor; the `rekorUuid` lands on the run record. The receipt page's
   "Verify offline" path becomes real.
5. **Realtime:** Supabase Realtime channel `runs:id=eq.<runId>` pushes
   status changes to the client. The `@directive-run/query` integration
   (already wired into the receipt page's Directive module) replaces
   the in-memory facts with the Realtime feed; the render code does
   not change.

The HTTP contract above does not change across the swap.

---

## Future surface (`extract`, `sense`, `act`, `fleet`)

Documented in `RunSpecPipeline` so client SDKs can be generated against
the union today. The route returns 400 with a `documented but not yet
implemented` error message. The non-Bureau shelves land per the
plan in `~/.claude/plans/mighty-gliding-swan.md`.

---

## Future surfaces tracked

All previously-tracked future surfaces have shipped. The v1 contract
is structurally complete:

| Endpoint | Purpose | Status |
|---|---|---|
| `POST /v1/runs` | Create a run | Shipped |
| `GET /v1/runs` | Paginated list | Shipped |
| `GET /v1/runs/:id` | Single record by phraseId | Shipped |
| `DELETE /v1/runs/:id` | Cancel a pending or running run | Shipped |
| `GET /v1/runs/:id/events` | Server-Sent Events stream of run progress | Shipped |

The runId / phraseId returned by `POST /v1/runs` remains the share
credential — bookmark-and-share is still the intended UX for the
wedge. SSE adds real-time progress on top, without changing the
share-link primitive.
