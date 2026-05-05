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
| `bureau:nuclei` | `src/lib/nuclei/run-form-module.ts` | **Yes (Wave 1)** |
| `bureau:oath` | `src/lib/oath/run-form-module.ts` | **Yes (Wave 1)** |
| `bureau:fingerprint` | `src/lib/fingerprint/run-form-module.ts` | **Yes (Wave 2)** |
| `bureau:custody` | `src/lib/custody/run-form-module.ts` | **Yes (Wave 2)** |
| `bureau:mole` | `src/lib/mole/run-form-module.ts` | **Yes (Wave 2)** |
| `bureau:whistle` | `src/lib/whistle/run-form-module.ts` | No (legacy) |
| `bureau:bounty` | `src/lib/bounty/run-form-module.ts` | No (legacy) |
| `bureau:sbom-ai` | `src/lib/sbom-ai/run-form-module.ts` | No (legacy) |
| `bureau:rotate` | `src/lib/rotate/run-form-module.ts` | No (legacy) |
| `bureau:tripwire` | `src/lib/tripwire/run-form-module.ts` | No (legacy) |

**Migration progress:** 6/11 Bureau pipelines now POST to `/v1/runs`. The
remaining 5 (whistle, bounty, sbom-ai, rotate, tripwire) keep working
unchanged on `/api/bureau/<slug>/run` until each is migrated.

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

---

## Migration runway

DRAGNET was the **wedge migration** — the first program to POST to the
unified surface. NUCLEI and OATH followed in Wave 1; FINGERPRINT,
CUSTODY, and MOLE in Wave 2 (this commit). The remaining 5 programs
keep working unchanged on `/api/bureau/<slug>/run` until each is
migrated.

1. **DRAGNET** (shipped in Phase 3 wedge).
2. **NUCLEI + OATH** (Wave 1). Both now POST to `/v1/runs`; the legacy
   aliases dual-write into the v1 store so legacy + /v1/runs callers
   converge on the same `phraseId` for the same payload.
3. **FINGERPRINT + CUSTODY + MOLE** (Wave 2 — this commit). Same
   delegated-validator + dual-write pattern. MOLE additionally enforces
   the canary-body privacy invariant on the wire.
4. **WHISTLE + BOUNTY + SBOM-AI + ROTATE + TRIPWIRE** — final batch.
   Migrate together once the per-pipeline verdict-color mapping is
   written.

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
