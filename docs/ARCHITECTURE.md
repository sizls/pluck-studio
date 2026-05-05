# Pluck Studio — Architecture

Pluck Studio is the operator-facing web surface for the Pluck Bureau —
the family of AI-vendor-honesty programs that publish Sigstore-anchored
receipts. The Studio's job is to take 11 distinct programs (DRAGNET,
OATH, FINGERPRINT, CUSTODY, WHISTLE, BOUNTY, SBOM-AI, ROTATE, TRIPWIRE,
NUCLEI, MOLE) and make them activate-runnable from a browser, via a
single unified contract, with one set of privacy invariants, one
authentication posture, and one receipt-URL primitive.

This document is the higher-level "how the system is built" companion to
`docs/V1_API.md` (which specifies the wire contract). Read this when
you're a new contributor or AI agent landing in the codebase cold and
need a load-bearing mental model before opening files. State as of
commit `86817e7` — 902 unit tests across 46 files + 82 Playwright
test cases across 16 spec files, all green.

---

## 1. Mental model

Studio is the operator-facing surface for the Pluck Bureau. It hosts a
landing page per program, an activation form per program, an API per
program, and a receipt page per program — but every one of those routes
funnels through one shared persistence-and-redaction surface
(`/api/v1/runs`) so the underlying machinery is uniform. The 11 alpha
programs all activate via the same five-step pattern (landing → run
form → run API → receipt page → OG image). The `/v1/runs` API is the
canonical write surface; the per-program `/api/bureau/<slug>/run`
routes are deprecated aliases that exist only so legacy callers keep
working until the runner GA. The UI is built on top of `/v1/runs`,
not on top of the legacy aliases.

The architecture optimizes for one property above all: **a new program
is a registry entry plus eight small per-program files, not a
re-architecture.** Adding the twelfth program touches the registry, the
pipeline-validator map, the redactor map, the run-store scoping
function, and a single program directory under `src/app/bureau/<slug>/`
plus `src/lib/<slug>/`. Nothing else in the codebase moves.

---

## 2. Code map

```
src/
├── app/                                 Next.js App Router (server + client)
│   ├── page.tsx                         "/" — Studio home
│   ├── runs/page.tsx                    "/runs" — by-program activation directory
│   ├── vendor/                          "/vendor" + "/vendor/[slug]" — Vendor Honesty Index
│   │   ├── page.tsx                       — index across the curated vendor allowlist
│   │   └── [slug]/
│   │       ├── page.tsx                   — per-vendor live profile (10 vendors today)
│   │       ├── feed.xml/                  — Atom feed per vendor (passive distribution)
│   │       └── opengraph-image.tsx        — 1200x630 PNG per vendor for social cards
│   ├── monitors/page.tsx                "/monitors" — 24h aggregate cron timeline
│   ├── what-we-dont-know/page.tsx       "/what-we-dont-know" — negative-knowledge page
│   ├── privacy/page.tsx                 "/privacy" — operator privacy posture
│   ├── sign-in/page.tsx                 "/sign-in" — Supabase auth entrypoint
│   ├── sitemap.ts + robots.ts           "/sitemap.xml" + "/robots.txt"
│   ├── bureau/                          per-program landing/run/receipt
│   │   ├── page.tsx                       "/bureau" — full program library
│   │   ├── monitors/[name]/page.tsx       per-program monitor detail
│   │   └── <11 program slugs>/            see § 3
│   └── api/
│       ├── v1/runs/                      canonical /v1/runs surface
│       │   ├── route.ts                    POST (create) + GET (list, paginated)
│       │   └── [id]/route.ts               GET (single, redacted) + DELETE (cancel)
│       └── bureau/<slug>/run/             11 deprecated legacy aliases (one per program)
│
├── lib/                                 non-UI logic (the "engine")
│   ├── programs/
│   │   ├── registry.ts                  ACTIVE_PROGRAMS + PHRASE_ID_PREFIX_CONVENTIONS
│   │   │                                  + PROGRAM_PRIVACY_POSTURE — the master registry
│   │   ├── vendor-registry.ts           curated allowlist for /vendor/[slug] (10 vendors)
│   │   ├── vendor-preview.ts            stub VHI data until pluck-api wires real receipts
│   │   └── monitors-preview.ts          stub /monitors data ditto
│   ├── v1/                              the unified pipeline surface
│   │   ├── run-spec.ts                  RunSpec + RunRecord types + validateRunSpec
│   │   ├── run-store.ts                 in-memory persistence (idempotency, TTL, FIFO)
│   │   ├── pipeline-validators.ts       per-pipeline payload contracts (single source)
│   │   └── redact.ts                    per-pipeline GET-side redaction (privacy)
│   ├── cron/                            cron grammar + nextNRuns walker (used by monitors)
│   │   ├── validate.ts                    5-field + @-macro grammar
│   │   ├── next-runs.ts                   nextNRuns(cron, n, from) — pure helper
│   │   └── index.ts                       barrel
│   ├── security/request-guards.ts       auth, CSRF, rate-limit shared utilities
│   ├── phrase-id.ts                     phrase-id generation + parsing primitive
│   ├── <11 program folders>/            per-program form + receipt Directive modules
│   │   └── run-form-module.ts | run-receipt-module.ts
│   └── __tests__/                       per-program unit tests
│
├── components/bureau-ui/                shared UI primitives
│   ├── chrome.tsx, forms.tsx              BureauChrome, BureauButton, BureauInput, …
│   ├── TimelineDot.tsx, RekorSearch.tsx   per-program shared atoms
│   ├── EmbedBadge.tsx, QuorumBadge.tsx
│   ├── DossierViewer.tsx                  BOUNTY EvidencePacket viewer
│   ├── VendorLeaderboard.tsx              cross-cutting across VHI + landing
│   ├── ReputationBadge.tsx                vendor honesty letter grade (A..F + svg renderer)
│   ├── CalendarStrip.tsx                  cron next-N visualisation
│   └── V1RunStatusBanner.tsx              the Strict-Mode-safe locale-formatted banner
│
e2e/                                     16 Playwright specs covering the activation pattern
│   ├── <program>-activation.spec.ts       one per program (11)
│   ├── runs-directory.spec.ts             /runs hub
│   ├── vendor-index.spec.ts               VHI
│   ├── calendar-strip.spec.ts             cron preview
│   ├── negative-knowledge.spec.ts         /what-we-dont-know
│   └── v1-runs.spec.ts                    /v1/runs cross-cutting
│
docs/
├── V1_API.md                            the wire contract — payload schemas + curl
├── IDEAS.md                             game-changer backlog (R1/R2/R3 + v3-R1/R2)
└── ARCHITECTURE.md                      this file
```

902 unit tests across `src/lib/**/__tests__` and
`src/components/bureau-ui/__tests__`; 82 Playwright tests across `e2e/`.
Both suites green at `64f5a23`.

---

## 3. The 11-program activation pattern

Every program follows the same five-step shape. The names of the files
do not change — only the program slug does. DRAGNET (the wedge) is the
canonical reference; the others are mechanical clones with per-program
field schemas, validators, and redactors.

**The five steps**

1. **Landing page** — `src/app/bureau/<slug>/page.tsx`. Server-rendered.
   No state. Marketing copy + CTA into the run form.
2. **Run form** — `src/app/bureau/<slug>/run/page.tsx` +
   `src/app/bureau/<slug>/run/RunForm.tsx`. Form is a client component
   backed by a Directive module
   (`src/lib/<slug>/run-form-module.ts`). State, validation
   short-circuits, and submit-side effects all flow through Directive
   facts; React reads via `useFact` / `useDerived`.
3. **Run API** — Two endpoints:
   - `/api/v1/runs` (canonical) — accepts
     `{ pipeline: "bureau:<slug>", payload, idempotencyKey }`.
   - `/api/bureau/<slug>/run` (deprecated alias, RFC 8594 signaled) —
     accepts the legacy per-program body shape, runs the same shared
     validator, dual-writes into the same v1 store. Both surfaces
     return the SAME `phraseId` for the same payload.
4. **Receipt page** — `src/app/bureau/<slug>/runs/[id]/page.tsx` +
   `ReceiptView.tsx`. Receipt is a client component backed by a second
   Directive module (`src/lib/<slug>/run-receipt-module.ts`). When
   pluck-api lands, the in-memory facts get replaced by a
   `@directive-run/query`-backed Realtime subscription — the render
   code does not change.
5. **OG image** — `src/app/bureau/<slug>/runs/[id]/opengraph-image.tsx`.
   1200×630 PNG. Renders the receipt's verdict as a self-marketing
   social-card preview when the URL is pasted into Slack/X/Discord.

**DRAGNET reference files**

| Step | File |
|---|---|
| Landing | `src/app/bureau/dragnet/page.tsx` |
| Run form | `src/app/bureau/dragnet/run/RunForm.tsx` |
| Form module | `src/lib/dragnet/run-form-module.ts` |
| v1 API | `src/app/api/v1/runs/route.ts` |
| Legacy alias | `src/app/api/bureau/dragnet/run/route.ts` |
| Validator | `validateDragnetPayload` in `src/lib/v1/pipeline-validators.ts` |
| Redactor | `PAYLOAD_REDACTORS["bureau:dragnet"]` in `src/lib/v1/redact.ts` |
| Run-store scoping | `runIdForBureau` in `src/lib/v1/run-store.ts` |
| Receipt page | `src/app/bureau/dragnet/runs/[id]/ReceiptView.tsx` |
| Receipt module | `src/lib/dragnet/run-receipt-module.ts` |
| OG image | `src/app/bureau/dragnet/runs/[id]/opengraph-image.tsx` |

**The 11 programs**

Sourced from `ACTIVE_PROGRAMS` and `PHRASE_ID_PREFIX_CONVENTIONS` in
`src/lib/programs/registry.ts`. Order is registry order (matches the
Wave migration sequence: wedge → Wave 1 → Wave 2 → Wave 3).

| Slug | Program | Phrase-ID prefix source | Predicate URI |
|---|---|---|---|
| `dragnet` | DRAGNET | vendor (probe target) | `https://pluck.run/DragnetCycle/v1` |
| `oath` | OATH | vendor (oath target) | `https://pluck.run/PluckOath/v1` |
| `fingerprint` | FINGERPRINT | vendor (model owner) | `https://pluck.run/ModelFingerprint/v1` |
| `custody` | CUSTODY | vendor or 'unknown' (bundle source) | `https://pluck.run/CustodyBundle/v1` |
| `whistle` | WHISTLE | routing partner (NOT source) | `https://pluck.run/WhistleSubmission/v1` |
| `bounty` | BOUNTY | target platform (HackerOne/Bugcrowd) | `https://pluck.run/BountySubmission/v1` |
| `sbom-ai` | SBOM-AI | artifact kind (probe-pack/model-card/mcp-server) | `https://pluck.run/SbomAi/ProbePack/v1` |
| `rotate` | ROTATE | rotation reason (compromised/routine/lost) | `https://pluck.run/KeyRevocation/v1` |
| `tripwire` | TRIPWIRE | machine ID slug (per-dev-machine) | `https://pluck.run/TripwirePolicy/v1` |
| `nuclei` | NUCLEI | author handle (operator-asserted; see § 5) | `https://pluck.run/NucleiPackEntry/v1` |
| `mole` | MOLE | canary ID (NOT canary content) | `https://pluck.run/CanaryDocument/v1` |

**Why prefix-source matters.** Each program's phrase-ID prefix is a
deliberate privacy / UX choice. WHISTLE's prefix is the routing partner
(not the source) so anonymity isn't broken by the URL alone. MOLE's
prefix is an operator-chosen ID (not the canary body) so the body
stays local. ROTATE's prefix is the reason ("compromised") so a
compromise is socially visible from a copy-pasted link. The full
rationale for each program lives in `PHRASE_ID_PREFIX_CONVENTIONS`.

---

## 4. The /v1/runs unified API surface

`/v1/runs` is the single seam between the UI and persistence. Every
activation funnels through it; every receipt page reads from it.

### Write path

```
client (RunForm or curl)
   │
   │ POST /api/v1/runs   { pipeline, payload, idempotencyKey? }
   ▼
src/app/api/v1/runs/route.ts
   │  1. isSameSiteRequest(req)         CSRF gate
   │  2. rateLimitOk(req)                per-IP+session bucket (10 / 60s)
   │  3. parse body (JSON)
   │  4. isAuthed(req)                  Supabase JWT cookie or dev Bearer
   │  5. validateRunSpec(body)          shape gate (envelope shape)
   │  6. PIPELINE_VALIDATORS[pipeline]  per-program payload gate
   ▼
src/lib/v1/run-store.ts → createRun(spec)
   │  - idempotencyHashOf(spec)         sha256(canonicalJson({pipeline,payload,key}))
   │  - hit cache → return existing record + reused:true
   │  - miss      → runIdForBureau(pipeline, payload) → phrase-id
   │  - persist to in-memory Map        TTL 24h, FIFO cap 10K
   ▼
{ runId, receiptUrl, status: "pending", reused }
```

### Read paths

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/runs` | Paginated list with filters (`pipeline`, `since`, `status`, `cursor`, `limit`). Public read; CSRF + rate-limit still apply. |
| `GET` | `/api/v1/runs/[id]` | Single record by phraseId. Public read (the phraseId IS the share credential). Payload runs through `redactPayloadForGet` — § 5. |
| `DELETE` | `/api/v1/runs/[id]` | Cancel a pending or running run. **Auth-gated** (state-modifying). Idempotent on already-cancelled. Echoes the cancelled record (also redacted). |
| `GET` | `/api/v1/runs/[id]/events` | Server-Sent Events stream — emits a `state` event on connect, on every transition, and a `heartbeat` every 30s. Same gates as GET-by-id (public read; CSRF + rate-limit). Auto-closes on terminal status (2s grace) and after 5min. Honors `Last-Event-ID` reconnect. Per-pipeline payload redaction applied to EVERY emitted state event — defense-in-depth at the SSE boundary. |

### Layer responsibilities

| File | Responsibility |
|---|---|
| `src/lib/v1/run-spec.ts` | TypeScript types (`RunSpec`, `RunRecord`, `RunStatus`, `BureauPipeline`), the `BUREAU_PIPELINES` array, and `validateRunSpec` (envelope shape — rejects unknown top-level keys, `idempotencyKey` length cap, etc.). Persistence-agnostic. |
| `src/lib/v1/pipeline-validators.ts` | Per-pipeline payload contracts. One function per program (`validateDragnetPayload`, `validateNucleiPayload`, …) and a `PIPELINE_VALIDATORS` map keyed by `BureauPipeline`. **Single source of truth** between `/v1/runs` and the legacy aliases. Belt-and-suspenders runtime check at module load throws if `BUREAU_PIPELINES` ever drifts from the map. |
| `src/lib/v1/run-store.ts` | In-memory stub with idempotency cache, 24h TTL eviction, 10K-entry FIFO cap, cursor pagination, status filtering, per-program `runIdForBureau` scoping, and an in-memory pub/sub layer that feeds the SSE route. **Public API**: `createRun`, `getRun`, `listRuns`, `cancelRun`, `subscribeToRun`. **Internal**: `idempotencyHashOf`, `canonicalJson`, `__INTERNAL_TTL_MS`, `__INTERNAL_MAX_ENTRIES`, `__INTERNAL_SUBSCRIBERS_PER_RUN_CAP` (gated behind `PLUCK_REAL_BACKEND` env in tests). |
| `src/lib/v1/redact.ts` | Per-pipeline GET-side payload redaction. `PAYLOAD_REDACTORS` map keyed by `BureauPipeline`. WHISTLE strips `bundleUrl`+`manualRedactPhrase`; ROTATE strips `operatorNote`; the other 9 pass through. The store record is untouched (idempotency must remain stable); redaction happens at the GET / SSE boundary only. |
| `src/app/api/v1/runs/route.ts` + `[id]/route.ts` + `[id]/events/route.ts` | Security gates (CSRF / rate-limit / auth) + delegation. Zero business logic — they call `validateRunSpec`, `PIPELINE_VALIDATORS[…]`, `createRun`/`getRun`/`listRuns`/`cancelRun`/`subscribeToRun`, and `redactPayloadForGet`. The events route additionally manages the SSE stream lifecycle (heartbeat, terminal-state close, 5min cap). Replaceable as a unit when pluck-api lands. |
| `src/lib/security/request-guards.ts` | `isAuthed`, `isSameSiteRequest`, `rateLimitOk`, `isPrivateOrLocalHost`. Shared by `/v1/runs` and the 11 legacy aliases. |
| `src/lib/sigil/phrase-sigil.ts` | Pure deterministic generator for the **Phrase Crest** sigil (R2 game-changer #1). `phraseSigilData(phraseId, opts)` decomposes via `parsePhraseId`, hashes adjective → HSL hue + noun → shape (one of 10 hand-built primitives); `renderPhraseSigil(data, size)` emits the SVG bytes. No `Math.random`, no `Date.now`, no external font loads, no animal silhouette assets — every byte is derived from the phrase ID + program accent. Snapshotted in `__tests__` so any drift trips the determinism contract every share-target relies on. Consumed by the `<PhraseSigil>` server component (in `src/components/bureau-ui/`), wired into /search results, /vendor receipt rows, and all 11 receipt-page headers. |
| `src/components/bureau-ui/VerdictBadge.tsx` + `src/lib/programs/verdict-mapping.ts` | **VerdictBadge is the shared visual primitive for trust-tier distinctions** (v3-R2 game-changer #3). Server component, 6 variants (`verified` / `registry-fenced` / `re-witnessed` / `expired` / `failed` / `pending`), two sizes (`sm` 20px for inline tile use, `md` 28px for receipt headers). Each variant: muted HSL pill background + bureau-mono label + unicode glyph (`✓` `↻` `⚠` `✕` — no emoji). The `verdictToBadgeVariant(programSlug, verdict)` mapping is the single source of truth — wired into /search results, /vendor receipt rows, NUCLEI + MOLE receipt verdict lines. Programs without nuanced trust tiers get `null` from the mapping and keep the bare verdict-color dot. The badge SUPPLEMENTS the dot for load-bearing tiers (NUCLEI's `published-ingested-only`, MOLE's `re-witnessed`); it does not replace it. |

---

## 5. Privacy invariants — the load-bearing rules

Each program declares what Studio refuses to know. The negative-knowledge
page (`/what-we-dont-know`) renders these verbatim from
`PROGRAM_PRIVACY_POSTURE`. The phrase-ID schema is the proof: if Studio
knew it, it would be in the URL. Five programs carry **load-bearing**
invariants enforced in code (defense-in-depth across multiple layers).

### BOUNTY — no auth tokens on the wire

| Layer | Enforcement |
|---|---|
| Validator | `validateBountyPayload` rejects any payload key matching `authorization` / `bearer` / `*_TOKEN` / `*_API_KEY` / `*_SECRET`. |
| Schema | `BountyPayload` defines no auth-token field. |
| GET redaction | `PASS_THROUGH` — no persisted privacy-sensitive fields, since the validator already rejects them. |
| Test | `pipeline-validators.test.ts` locks the rejection patterns at unit level. |

Tokens stay LOCAL — Studio reads them at dispatch time from
operator-controlled storage, never over `/v1/runs`.

### MOLE — canary body never enters any public surface

| Layer | Enforcement |
|---|---|
| Validator | `validateMolePayload` rejects any payload carrying `canaryBody` or `canaryContent`. The wire schema is `canaryId` + `canaryUrl` + `fingerprintPhrases` only. |
| Schema | `MolePayload` defines no body field; receipt's render schema drops these too. |
| GET redaction | `PASS_THROUGH` — by-design, since the body never lands in the store. |
| Test | `mole-run-receipt-module.test.ts` includes a banned-pattern guard asserting `canaryBody` is absent from the receipt schema. |

Sealing comes BEFORE probing — the Rekor timestamp must predate any
probe-run, which means the canary body has to stay with the operator
the whole time.

### ROTATE — no private-key material on the wire; no operator-note in GET

| Layer | Enforcement |
|---|---|
| Validator | `validateRotatePayload` rejects `privateKey` / `private_key` / `*secret` / `pem` / `privkey` keys. Only PUBLIC SPKI fingerprints (64-hex) are accepted. |
| Schema | `RotatePayload` defines `oldKeyFingerprint` + `newKeyFingerprint` (public only) + `reason` + optional `operatorNote`. |
| GET redaction | `REDACT_ROTATE` strips `operatorNote` from the response shape. The store record retains it (idempotency stays stable); the GET boundary scrubs it. |
| Test | `pipeline-validators.test.ts` locks the private-key-shaped key rejection; `redact.test.ts` (or the `/v1/runs` route test) locks the operatorNote scrub. |

### WHISTLE — no source identity, bundleUrl never echoed

| Layer | Enforcement |
|---|---|
| Validator | `validateWhistlePayload` rejects any source-identifying key (`sourceName`, `sourceEmail`, `sourceIp`, `sourceHandle`, `reporterName`, `reporterEmail`, …). Phrase-ID prefix is the routing partner, NEVER the source. |
| Schema | `WhistlePayload` defines `bundleUrl` + `category` + `routingPartner` + optional `manualRedactPhrase` + the two ack flags. |
| GET redaction | `REDACT_WHISTLE` strips both `bundleUrl` AND `manualRedactPhrase`. The bundleUrl is required at submission (the routing partner needs to retrieve it) and participates in the canonical idempotency hash, but it MUST NOT echo to a phraseId-credentialed reader — anyone with the URL could trace the source. |
| Test | `pipeline-validators.test.ts` locks the source-identifying-key rejection; the legacy-alias test locks that `bundleUrl` is dropped from the POST response too. |

### NUCLEI — operator-asserted author handle (caveat)

This one is the **stub-era unfixed** invariant. The validator accepts an
operator-asserted `author` handle and bakes it into the phrase-ID
prefix. Anyone authenticated can submit any handle and reserve the slug
— the public receipt URL becomes an impersonation primitive once the
registry goes public.

| Layer | Enforcement |
|---|---|
| Validator | `validateNucleiPayload` constrains the handle to a short lowercase slug grammar (`isValidAuthor`). |
| Schema | `NucleiPayload` carries `author` + `packName` + `sbomRekorUuid` + `vendorScope` + `license` + `recommendedInterval` + ack. |
| GET redaction | `PASS_THROUGH` — author handle is by-design public. |
| Test | `pipeline-validators.test.ts` locks the slug grammar but cannot prove ownership today. |
| **Caveat** | Documented in the SECURITY block of `src/app/api/bureau/nuclei/run/route.ts` and on the `/what-we-dont-know` NUCLEI row. Binds to authenticated identity at NUCLEI v1.0 GA — same pluck-api inflection that adds `runs.owner_id`. |

---

## 6. The legacy → /v1 migration runway

All 11 alpha programs originally posted to per-program
`/api/bureau/<slug>/run` routes. Wave 0 (the DRAGNET wedge), Wave 1
(NUCLEI + OATH), Wave 2 (FINGERPRINT + CUSTODY + MOLE), and Wave 3
(BOUNTY + SBOM-AI + ROTATE + TRIPWIRE + WHISTLE) migrated each program's
RunForm to POST to `/api/v1/runs` instead. The old endpoints stay alive
as **deprecated aliases** so legacy callers (curl scripts, half-migrated
SDKs) keep working until the runner GA.

Each legacy alias does the same five things:

1. **Same security gates.** `isSameSiteRequest`, `rateLimitOk`,
   `isAuthed` — identical to `/v1/runs`. Errors return the same status
   codes and `signInUrl` redirect.
2. **Delegate validation.** Calls the same shared
   `validate<Slug>Payload` from `src/lib/v1/pipeline-validators.ts` —
   single source of truth. The legacy and v1 surfaces cannot drift.
3. **Synthesize the v1 idempotency key.** Each alias re-derives the
   same minute-bucketed key the migrated RunForm sends to `/v1/runs`.
   E.g. DRAGNET synthesizes
   `dragnet:<probePackId>:<targetUrl>:<cadence>:<minute>`. Without this
   step every legacy POST would create a ghost run that no `/v1/runs`
   caller could ever dedupe against. (C1 critical from the AE review.)
4. **Dual-write to the v1 store.** Calls `createRun()` directly with
   `pipeline: "bureau:<slug>"` — so the receipt page reads a canonical
   record from `GET /api/v1/runs/[id]` regardless of which surface the
   client used to write.
5. **Emit RFC 8594 signals.** Every response carries:
   - `Deprecation: true` — literal token, machine-readable.
   - `Sunset: Wed, 31 Dec 2026 23:59:59 GMT` — IMF-fixdate, six+
     months from migration.
   - `Link: </api/v1/runs>; rel="successor-version"` — points clients
     at the canonical surface for auto-migration.

Body fields also carry `deprecated: true` and
`replacement: "/api/v1/runs"` so callers that don't read response
headers (browser SDKs, intermediaries) still see the signal.

### `runId === phraseId` (single primitive)

Pre-migration, the legacy `runId` was a per-request `randomUUID()` that
diverged from `phraseId`. Two callers couldn't dedupe on `runId`
because it was fresh on every retry; the canonical primitive has
always been the phrase-id. The migration unified them — `runId ===
phraseId` — so legacy callers and v1 callers see the same identity for
the same payload. (M5 fix.)

### Sunset clock

**31 Dec 2026, 23:59:59 GMT**. Every alias emits this date verbatim in
its `Sunset` header. The runner GA (real backend swap, see § 11) lands
before this; aliases are removed at the same time.

---

## 7. Cross-cutting surfaces

Beyond the per-program activation routes, Studio renders seven
cross-cutting routes that aggregate or invert across programs.

### `/runs` — by-program activation directory

Server-rendered. One card per `ACTIVE_PROGRAMS` entry; one card per
`COMING_SOON_PROGRAMS` entry (currently empty — all 11 alpha programs
are activated). Pure registry-driven render — adding a program means
adding a registry entry; this page auto-includes it. Tests:
`e2e/runs-directory.spec.ts`.

### `/vendor` + `/vendor/[slug]` — Vendor Honesty Index

Per-vendor live profile across the 11 Bureau programs. Every receipt
that names a vendor (DRAGNET / OATH / FINGERPRINT / CUSTODY phrase-ID
prefix; NUCLEI vendorScope tag; MOLE canaryUrl host) enriches that
vendor's permanent URL.

- **Vendor allowlist** — `src/lib/programs/vendor-registry.ts`. 10
  curated vendors today (OpenAI, Anthropic, Google, Meta, Mistral,
  Cohere, Perplexity, DeepSeek, xAI, Microsoft). Unknown slugs return
  404 via `notFound()`. Vetted-allowlist gate is load-bearing for
  brand-safety since arbitrary slugs would be a defamation surface.
- **Stub data** — `src/lib/programs/vendor-preview.ts` until pluck-api
  wires real receipts. Per-vendor OG image at
  `/vendor/[slug]/opengraph-image.tsx`.
- **Subscription feeds** — see "Subscription feeds" below.
- **Tests** — `e2e/vendor-index.spec.ts`, `e2e/vendor-feed.spec.ts`.

### Subscription feeds — `/vendor/[slug]/feed.xml`

Per-vendor Atom 1.0 feed. Free passive distribution: a journalist
subscribes to `/vendor/openai/feed.xml` in their RSS reader and every
new receipt against OpenAI lands in their inbox. The route lives at
`src/app/vendor/[slug]/feed.xml/route.ts` and pre-renders one feed
per curated vendor via `generateStaticParams()`.

- **Vetted-allowlist gate** — same `lookupVendor()` check as the page;
  unknown slug → `notFound()`. The feed is never rendered for an
  unvetted vendor.
- **Privacy redaction** — every entry's payload routes through
  `redactPayloadForGet(pipeline, payload)` before XML emission.
  Defense-in-depth: WHISTLE `bundleUrl`, WHISTLE `manualRedactPhrase`,
  and ROTATE `operatorNote` MUST NOT appear in feed entries even if
  the upstream preview/feed source ever drifts.
- **Atom 1.0 contract** — every entry carries `<id>`, `<title>`,
  `<link>`, `<updated>`, `<published>`, `<author>`, `<summary>`. The
  feed itself carries `<id>`, `<title>`, `<subtitle>`, `<updated>`,
  `<author>`, `<link rel="self">`, `<link rel="alternate">`. No XML
  library — strings + `xmlEscape()` for `&` `<` `>` `"` `'`.
- **Cache + headers** — `Cache-Control: public, max-age=300`
  (matches typical RSS reader poll cadence),
  `Content-Type: application/atom+xml; charset=utf-8`,
  `X-Content-Type-Options: nosniff`.
- **Auto-discovery** — `/vendor/<slug>` head includes
  `<link rel="alternate" type="application/atom+xml" href="/vendor/<slug>/feed.xml">`
  so RSS readers detect the feed automatically; the
  `data-testid="vendor-feed-link"` link in the page footer also
  surfaces it for human visitors.
- **Curl example** —
  `curl https://studio.pluck.run/vendor/openai/feed.xml`
- **Tests** — `src/app/vendor/[slug]/feed.xml/__tests__/route.test.ts`
  (unit), `e2e/vendor-feed.spec.ts` (e2e).

### `/today` + `/today/opengraph-image` — Daily Roll-Up

The shareable daily honesty card. Server-rendered page at
`/today` shows one tile per Bureau program (registry-driven) with
last-24h verdict density; `/today/opengraph-image` emits a 1200×630
PNG via next/og's edge-runtime `ImageResponse` so any paste of the
URL into Slack / X / Discord / iMessage auto-unfurls into the daily
honesty signal.

- **Aggregation helper** — `src/lib/programs/today-rollup.ts`. Pure +
  deterministic with a `now` parameter; returns `DailyRollup` covering
  all 11 active programs (vendor-bearing programs fold their
  vendor-preview activity into per-program totals; non-vendor-bearing
  programs use a hand-curated stub). Privacy posture: counts only —
  no payload, phrase-ID, or vendor-ID data flows through the rollup
  shape. Locked by `today-rollup.test.ts`.
- **Watermark** — the OG card carries "DEMO DATA — PREVIEW" per the
  VHI pattern; required while the rollup helper aggregates stub data.
- **API stability** — when pluck-api `/v1/runs?since=24h-ago` lands,
  the helper swaps to a real query in one private function; the
  public `getDailyRollup(now?)` signature stays stable.
- **Tests** — `src/lib/programs/__tests__/today-rollup.test.ts`
  (unit), `src/app/today/__tests__/page.test.tsx` (server-render),
  `e2e/today.spec.ts` (e2e — OG image PNG magic-bytes check).

### `/search` — Phrase-ID Auto-Stitch Search

Paste any phrase ID. Get every related receipt across all 11 Bureau
programs out. The receipt URL becomes a discoverable nexus.

- **Parser** — `parsePhraseId(input)` in `src/lib/phrase-id.ts`.
  Decomposes a 4-part scoped phrase ID (`<scope>-<adj>-<noun>-<NNNN>`)
  into its parts; bare 3-part R1-form phrase IDs flagged invalid since
  search needs the scope to fan out.
- **Aggregator** — `searchPhraseId(query)` in
  `src/lib/search/phrase-stitch.ts`. Pure + deterministic. Returns
  `{ parsed, directMatch, relatedByScope, totalCount }`. directMatch is
  the exact phraseId; relatedByScope is every other receipt sharing the
  scope, sorted newest-first, deduped against the directMatch.
- **Stub-era data source** — vendor-preview.ts. When pluck-api lands,
  the aggregator swaps to a real
  `listRuns({ phraseIdPrefix: parsed.scope })` query — the public
  `searchPhraseId` signature stays stable.
- **Page** — server-rendered at `src/app/search/page.tsx`. Form posts
  via GET to `/search?q=...` (works without JS). Renders the
  decomposition card (scope/adj/noun/serial with the
  `PHRASE_ID_PREFIX_CONVENTIONS` semantic label), direct-match tile,
  and related-by-scope grid.
- **Empty / invalid / not-found states** — empty query renders sample
  links (round-tripped via `sampleSearchablePhraseIds()`); invalid
  format renders an inline error + sample fallback; valid scope with
  no matches renders the decomposition + a clear "no receipts yet"
  callout.
- **Cross-link** — `/runs` carries a `data-testid="search-cross-link"`
  pointer.
- **Tests** — `src/lib/search/__tests__/phrase-stitch.test.ts` (unit),
  `src/app/search/__tests__/page.test.tsx` (server-render),
  `e2e/search.spec.ts` (e2e).

### `/monitors` — cron timeline of upcoming pack fires

Aggregate 24h timeline of every published NUCLEI pack's fires. Driven
by `nextNRuns(cron, n, from)` from `src/lib/cron/next-runs.ts` — pure
deterministic walker (UTC) with a 5M-iteration ceiling. Today the data
lives in `src/lib/programs/monitors-preview.ts`; swaps to
`/v1/monitors` when pluck-api ships. Per-monitor detail at
`/bureau/monitors/[name]`. Tests: `e2e/calendar-strip.spec.ts`.

### `/what-we-dont-know` — privacy posture per program

The negative-knowledge page. Pure server-render driven by
`PROGRAM_PRIVACY_POSTURE` and `PHRASE_ID_PREFIX_CONVENTIONS` from
`src/lib/programs/registry.ts`. Adding a program means adding a posture
entry; the registry test suite blocks PRs that skip the disclosure.
Tests: `e2e/negative-knowledge.spec.ts`.

### `/privacy` — operator privacy posture

Operator-facing privacy posture statement. Public disclosure that
phrase-IDs intentionally name probe targets in the URL. Static
server-render; no state.

### `/sitemap.xml` + `/robots.txt`

`src/app/sitemap.ts` and `src/app/robots.ts`. Sitemap auto-derives from
`ACTIVE_PROGRAMS` and `VENDOR_REGISTRY` so every program landing + run
page + every vendor profile + every Atom feed lands in the index.

### Cross-program flows — SBOM-AI ↔ NUCLEI auto-link

The supply-chain trust loop closes with a query-param prefill hop
between SBOM-AI receipts and the NUCLEI run form. No new routes —
just two component additions and a banner.

- **SBOM-AI receipt → NUCLEI form.** When `artifactKind === "probe-pack"`
  the receipt renders a "Publish to NUCLEI registry →" CTA at
  `src/app/bureau/sbom-ai/runs/[id]/NucleiPublishCta.tsx`. The CTA
  links to `/bureau/nuclei/run?sbomRekorUuid=<uuid>`. While the
  SBOM-AI publish is still pending the CTA renders greyed out so the
  operator sees the next step early but can't accidentally publish
  with a placeholder UUID. `model-card` and `mcp-server` artifacts
  do NOT show the CTA — NUCLEI registry only accepts probe-pack
  artifacts.
- **NUCLEI form prefill.** `RunForm.tsx` reads `?sbomRekorUuid=` and
  `?packName=` via `useSearchParams()` on first mount and seeds the
  Directive form module facts. The "nuclei-prefill-banner" data-testid
  fires when either param is present. Mirrors the DRAGNET
  `?vendor=&assertion=` pattern from `/extract`.
- **NUCLEI receipt → SBOM-AI back-link.** The NUCLEI receipt renders
  a "Source artifact" section
  (`src/app/bureau/nuclei/runs/[id]/SbomAiSourceArtifact.tsx`) with the
  rekor UUID as a code block plus the offline `cosign verify-blob`
  command. We deliberately don't resolve the rekor UUID to a phraseId
  — that would require a new route and the cosign command itself
  demonstrates the trust chain.

E2E coverage: `e2e/nuclei-sbom-ai-loop.spec.ts`.

### `/openapi.json` — machine-readable spec

`src/app/openapi.json/route.ts` serves a static OpenAPI 3.1 document
auto-generated by `scripts/build-openapi.ts` and committed at
`public/openapi.json`. The spec covers the full /v1/runs surface
(POST + GET-list + GET-by-id + DELETE) and is the canonical contract
external SDKs and consumers bind against. The pipeline + status enums
are derived from `BUREAU_PIPELINES` / `RUN_STATUSES` so the spec
cannot drift from the runtime taxonomy without failing the
`scripts/__tests__/build-openapi.test.ts` invariant. Re-run
`pnpm openapi:build` after any RunSpec / RunRecord / pipeline-validators
/ redactor change. See `docs/V1_API.md` → "Machine-readable spec".

---

## 8. Adding a new program — the cookbook

Step-by-step for a hypothetical "TENTH" program (slug `tenth`, predicate
`https://pluck.run/TenthOutcome/v1`).

1. **Build the Directive form module.**
   Create `src/lib/tenth/run-form-module.ts`. Use `createModule` from
   `@directive-run/core` with `t.string()` / `t.boolean()` schema for
   the form fields, derivations for the submit-enabled state, and the
   shared form-validation utilities. Mirror `src/lib/dragnet/run-form-module.ts`.

2. **Build the Directive receipt module.**
   Create `src/lib/tenth/run-receipt-module.ts`. Defines the receipt
   schema, predicate URI export
   (`export const TENTH_PREDICATE_URI = "https://pluck.run/TenthOutcome/v1"`),
   and the verdict-color derivation. Mirror
   `src/lib/dragnet/run-receipt-module.ts`.

3. **Register the pipeline in the v1 type system.**
   Add `"bureau:tenth"` to `BUREAU_PIPELINES` in
   `src/lib/v1/run-spec.ts`. The `BureauPipeline` union and
   `bureau:tenth` runtime guards auto-derive.

4. **Register the program in `ACTIVE_PROGRAMS`.**
   Add an entry to `src/lib/programs/registry.ts` with slug, name,
   actionVerb, summary, outputShape, predicateUri, runPath,
   landingPath, accent color, and `vendorBearing` flag. Add an entry
   to `PHRASE_ID_PREFIX_CONVENTIONS` and `PROGRAM_PRIVACY_POSTURE`
   too — the registry tests will fail if you skip these. The
   `/runs` and `/what-we-dont-know` pages auto-render from these.

5. **Implement the payload validator.**
   Add `validateTenthPayload(payload: unknown): ValidatorResult` in
   `src/lib/v1/pipeline-validators.ts`. Wire it into
   `PIPELINE_VALIDATORS["bureau:tenth"]`. The runtime check at module
   load enforces this; the type system enforces it in CI.

6. **Add a redactor entry.**
   `PAYLOAD_REDACTORS["bureau:tenth"]` in `src/lib/v1/redact.ts`. Use
   `PASS_THROUGH` unless TENTH carries a privacy-sensitive persisted
   field (then write a per-program redactor — see `REDACT_WHISTLE` /
   `REDACT_ROTATE` for the pattern).

7. **Extend `runIdForBureau` in the run-store.**
   `src/lib/v1/run-store.ts`. Add a branch that resolves TENTH's
   phrase-ID prefix (whatever the registry says — vendor / artifact /
   author / etc.). Order matters: more-specific scoping (canary ID,
   target platform) wins over less-specific (vendor) when a program
   carries both. Document the ordering in a comment.

8. **Build the Next.js routes.**
   - `src/app/bureau/tenth/page.tsx` — landing.
   - `src/app/bureau/tenth/run/page.tsx` — server shell.
   - `src/app/bureau/tenth/run/RunForm.tsx` — client component, reads
     the form module via `useFact` / `useDerived`. Posts to
     `/api/v1/runs` with `pipeline: "bureau:tenth"`.
   - `src/app/bureau/tenth/runs/[id]/page.tsx` — server shell.
   - `src/app/bureau/tenth/runs/[id]/ReceiptView.tsx` — client
     component, reads the receipt module + the v1 status via
     `V1RunStatusBanner`.
   - `src/app/bureau/tenth/runs/[id]/opengraph-image.tsx` — 1200×630
     PNG. Mirror DRAGNET's structure.

9. **Build the legacy alias.**
   `src/app/api/bureau/tenth/run/route.ts`. CSRF + rate-limit + auth
   gates → `validateTenthPayload` → synthesize idempotency key →
   `createRun({ pipeline: "bureau:tenth", … })` → return `{ runId,
   phraseId, status, deprecated: true, replacement: "/api/v1/runs" }`
   with the standard `Deprecation` / `Sunset` / `Link` headers.
   Mirror `src/app/api/bureau/dragnet/run/route.ts` exactly.

10. **Add tests.**
    - **Unit:** `validateTenthPayload` happy path + each rejection
      mode in `src/lib/v1/__tests__/pipeline-validators.test.ts`.
      Form module + receipt module unit tests in
      `src/lib/__tests__/tenth-run-form-module.test.ts` +
      `tenth-run-receipt-module.test.ts`.
    - **Integration:** Legacy alias route handler — same shape as
      `dragnet/run/route.ts` tests.
    - **E2E:** `e2e/tenth-activation.spec.ts` — fill form, submit,
      land on receipt page, verify phraseId, verify OG image
      generates without error.

11. **Update docs.**
    - `docs/V1_API.md` — add a "Per-pipeline payload reference"
      section for `bureau:tenth` and bump the migrated table to 12/12.
    - `docs/ARCHITECTURE.md` — extend the Section 3 table with
      TENTH's row.

After step 11, the registry test suite will refuse a PR that's missing
any of registry / posture / prefix-convention / validator / redactor
entries.

---

## 9. Testing strategy

**902 unit tests** across `src/lib/**/__tests__/` and
`src/components/bureau-ui/__tests__/` — Vitest, run with
`pnpm test --run`. **82 Playwright tests** across `e2e/` — run with
`pnpm test:e2e`. Both suites green at commit `64f5a23`.

### Unit tests

Per-program form-module + receipt-module tests, per-program validator
tests in `src/lib/v1/__tests__/pipeline-validators.test.ts`,
run-store tests in `src/lib/v1/__tests__/run-store.test.ts` (stub-only
TTL/FIFO assertions gated behind `PLUCK_REAL_BACKEND` env so the
contract stays clean for the real-backend swap), redactor tests, cron
tests (validator + nextNRuns walker), shared-UI primitive tests,
registry exhaustiveness tests (every `BureauPipeline` must have a
validator AND a redactor AND a posture entry — drift fails CI).

### Integration tests

Each `/api/bureau/<slug>/run` legacy alias has a route-handler test
asserting the full security/auth/validation chain, the deprecation
headers, and the dual-write into the v1 store. The `/api/v1/runs`
POST/GET-list/GET-by-id/DELETE handlers have parallel coverage.

### E2E tests (Playwright)

Sixteen specs in `e2e/`:

- 11 `<program>-activation.spec.ts` — one per program, exercising
  the canonical landing → form → API → receipt → OG flow.
- `runs-directory.spec.ts` — `/runs` hub.
- `vendor-index.spec.ts` — VHI.
- `calendar-strip.spec.ts` — cron preview.
- `negative-knowledge.spec.ts` — `/what-we-dont-know`.
- `v1-runs.spec.ts` — `/v1/runs` cross-cutting (idempotency,
  pagination, cancellation).

### Convergence tests

Cross-route phraseId equality is locked at unit-level using
`vi.useFakeTimers()` so the minute-bucketed idempotency key derives
deterministically. A double-click to the legacy alias, a
double-click to `/v1/runs` with the same body, and a sequence of
both produce the same `phraseId` — the test asserts this directly.

### Privacy invariants locked at TEST level

- **MOLE canaryBody-not-in-schema** —
  `mole-run-receipt-module.test.ts` includes a banned-pattern guard
  asserting `canaryBody` and `canaryContent` are absent from the
  receipt schema.
- **WHISTLE source-identity-rejection** —
  `pipeline-validators.test.ts` exhaustively asserts every
  source-identifying key shape gets rejected.
- **BOUNTY auth-token-rejection** — same suite,
  `validateBountyPayload` rejects every token-shaped key.
- **ROTATE private-key-rejection + operatorNote scrub** — validator
  test for the wire-rejection; redactor test for the GET-side scrub.
- **VHI vetted-allowlist** — `vhi-runtime.test.ts` (or its
  successor) asserts unknown slugs return 404 + verifies the
  banned-pattern guard rejects defamatory slugs.

---

## 10. Bureau-Directive Loyalty rule

From project memory:

> Every new Pluck Bureau program MUST use `@directive-run/core`
> (facts/constraints/resolvers/derivations/effects/plugins) +
> `@directive-run/ai` for agent loops + `@directive-run/query` for
> Studio data + `@directive-run/react` for reactive UI.

In Studio terms: every activation form (`RunForm.tsx`) and every
receipt page (`ReceiptView.tsx`) MUST be backed by a Directive
module under `src/lib/<slug>/`. State, derivations, and submit-side
effects flow through Directive facts; React reads via `useFact` /
`useDerived` from `@directive-run/react`. When pluck-api lands, the
in-memory facts get replaced by a `@directive-run/query` Realtime
subscription — the render code does not change.

**Static disclosure pages are exempt.** Pages with no state — `/runs`,
`/vendor`, `/vendor/[slug]`, `/monitors`, `/what-we-dont-know`,
`/privacy`, `/sitemap.xml`, `/robots.txt`, all `landing.tsx` per-program
landings — are pure server-renders. Wiring Directive into a
zero-state page would add bundle weight for no semantic gain. The
exempt list is bounded; everything that's *interactive* MUST use
Directive.

The 14 already-shipped Bureau programs (the imperative-TS ancestors of
the alpha-program shelf) are tracked in project memory as a follow-on
retrofit track — not in this codebase's scope.

---

## 11. Backend-swap readiness

The current `/v1/runs` implementation is a **stub** — in-memory `Map`
in `src/lib/v1/run-store.ts`. The Supabase + DSSE + Rekor backend
lands in `@sizls/pluck-api`. The swap is mechanical because the
contract was designed for replacement from day one.

**What's already swap-ready**

- **`run-store.ts` internals are marked `@internal`.** `idempotencyHashOf`,
  `canonicalJson`, `__INTERNAL_TTL_MS`, `__INTERNAL_MAX_ENTRIES`,
  `__resetForTests`, `__runCount`, `__idempotencyCount` — all flagged
  as not-public. The Supabase swap is free to compute idempotency
  differently (e.g. a `runs.idempotency_hash` column with a partial
  unique index) without breaking any caller.
- **Stub-only TTL/FIFO assertion tests are gated behind
  `PLUCK_REAL_BACKEND` env.** Tests that import the `__INTERNAL_*`
  symbols only run against the stub. The contract tests
  (`createRun` returns a record, `getRun` returns it back, idempotent
  replays return `reused: true`) run against either backend.
- **Public API stays stable.** `createRun(spec) → CreateRunResult`,
  `getRun(id) → RunRecord | null`, `listRuns(filter) →
  ListRunsResult`, `cancelRun(id) → CancelResult`,
  `subscribeToRun(id, cb) → unsubscribe`. Every caller in the
  codebase binds against this surface — no caller reaches into the
  underlying `Map`.
- **Per-pipeline validators are persistence-agnostic.** They take a
  payload, return `{ ok, error? }`. Zero coupling to the store.
- **Per-pipeline redactors are persistence-agnostic.** Same — they
  take a payload, return a payload. The store layer does not call
  them.
- **The `/v1/runs` route handlers do not reach into store internals.**
  They call `createRun` / `getRun` / `listRuns` / `cancelRun` and
  `redactPayloadForGet` only. Replacing the store is a one-import
  change in `run-store.ts`.

**What lands at swap time**

1. **Persistence:** Supabase Postgres `runs` table, RLS-enforced.
   `getRun` becomes `SELECT … FROM runs WHERE id = $1`. The
   `runs.owner_id` column closes the NUCLEI author-handle binding gap
   AND the cancel-authorization gap (today, any authenticated caller
   can cancel any run — store has no concept of run ownership).
2. **Pipeline execution:** Hono service in `@sizls/pluck-api` reads
   pending rows, invokes the appropriate runner (probe pack, DSP
   sensor, browser agent), writes status transitions back to the row.
3. **DSSE signing:** Each terminal-state run produces a DSSE envelope
   signed by the Pluck-fleet hosted key
   (`/.well-known/pluck-keys.json`).
4. **Rekor anchoring:** The DSSE envelope is anchored in Sigstore
   Rekor; `rekorUuid` lands on the run record. The receipt page's
   "Verify offline" path becomes real.
5. **Realtime:** Supabase Realtime channel `runs:id=eq.<runId>` pushes
   status changes to the client. The `@directive-run/query`
   integration on each receipt page replaces in-memory facts with the
   Realtime feed. The render code does not change. The stub-era
   in-memory pub/sub (`subscribeToRun` in `run-store.ts`, today
   feeding `GET /api/v1/runs/[id]/events`) maps directly onto a
   `runs:id=eq.<runId>` channel subscription — same callback shape,
   same per-run scope. The SSE route's HTTP contract (event types,
   `Last-Event-ID` semantics, terminal-state auto-close, heartbeat
   cadence) is a thin shim over the channel and stays stable across
   the swap.

**The HTTP contract from `docs/V1_API.md` does not change across the
swap.** `RunSpec`, `RunRecord`, the curl examples, the status codes,
the deprecation headers on the legacy aliases — all stable. Clients
written against today's stub continue to work against the real backend
without modification.

---

*Last reviewed: commit `86817e7` — wide-R1 doc-gap fix. 902 unit
tests across 46 files + 82 Playwright test cases across 16 spec
files, all green. 11/11 alpha programs migrated to `/v1/runs`.
Runner GA + alias sunset target: 31 Dec 2026.*
