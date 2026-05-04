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
  status: "pending" | "running" | "anchored" | "failed";
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

## Per-pipeline payload reference

The canonical payload shape for each Bureau pipeline is defined by
that program's `lib/<program>/run-form-module.ts` and validated by the
legacy `/api/bureau/<program>/run` handler. Below is the migration
status. As each program migrates, its payload reference moves from
"see legacy route" to "see this section."

| Pipeline | Payload reference | Migrated to /v1/runs |
|---|---|---|
| `bureau:dragnet` | `src/lib/dragnet/run-form-module.ts` | **Yes (Phase 3 wedge)** |
| `bureau:oath` | `src/lib/oath/run-form-module.ts` | No (legacy) |
| `bureau:fingerprint` | `src/lib/fingerprint/run-form-module.ts` | No (legacy) |
| `bureau:custody` | `src/lib/custody/run-form-module.ts` | No (legacy) |
| `bureau:whistle` | `src/lib/whistle/run-form-module.ts` | No (legacy) |
| `bureau:bounty` | `src/lib/bounty/run-form-module.ts` | No (legacy) |
| `bureau:sbom-ai` | `src/lib/sbom-ai/run-form-module.ts` | No (legacy) |
| `bureau:rotate` | `src/lib/rotate/run-form-module.ts` | No (legacy) |
| `bureau:tripwire` | `src/lib/tripwire/run-form-module.ts` | No (legacy) |
| `bureau:nuclei` | `src/lib/nuclei/run-form-module.ts` | No (legacy) |
| `bureau:mole` | `src/lib/mole/run-form-module.ts` | No (legacy) |

### `bureau:dragnet` payload

```ts
{
  targetUrl: string;          // public URL (no localhost / RFC1918)
  probePackId: string;        // "canon-honesty" or "<author>/<pack>@<version>"
  cadence: "once" | "continuous";  // continuous returns 400 today
  authorizationAcknowledged: true; // must be literal true
}
```

---

## Migration runway

DRAGNET is the **wedge migration** — the first program to POST to the
unified surface. The remaining 10 programs follow at the cadence below;
they keep working unchanged on `/api/bureau/<slug>/run` until each is
migrated.

1. **DRAGNET** (shipped in Phase 3, this commit).
2. **OATH + FINGERPRINT** — next batch. Both have stable payload shapes
   and existing test coverage. Migration is mostly mechanical.
3. **WHISTLE + TRIPWIRE + ROTATE + CUSTODY + BOUNTY + SBOM-AI + MOLE +
   NUCLEI** — final batch. Migrate together once the per-pipeline
   verdict-color mapping is written.

The legacy `POST /api/bureau/<slug>/run` routes stay alive as
deprecated aliases throughout. Internally, the DRAGNET legacy route
already delegates to `lib/v1/run-store` so old callers and new
callers see the same record from `GET /api/v1/runs/[id]`.

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

The following endpoints are documented as planned API surface but have
**no current implementation**. They land alongside the real-backend
swap so SDKs can be generated against the planned union today.

| Endpoint | Purpose | Status |
|---|---|---|
| `GET /v1/runs` | Paginated list of recent runs (caller-scoped) | Planned — no impl |
| `DELETE /v1/runs/:id` | Cancel an in-flight run | Planned — no impl |
| `GET /v1/runs/:id/events` | Server-Sent Events stream of run progress | Planned — no impl |

Until each ships, the only run-discovery primitive is the `runId` /
`phraseId` returned by `POST /v1/runs` — bookmark-and-share is the
intended UX for the wedge.
