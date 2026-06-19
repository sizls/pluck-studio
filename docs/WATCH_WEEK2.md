# Watch — Week-2 contract-design backlog

These items came out of the R2 AE-review domain-expert lane (commit `2c8aecb` baseline). They are **contract-shape decisions for the Worker swap** — they all change the `WatchSpec` / `Observation` / receipt shape and therefore MUST land before the public API freezes at Week-2 GA. Sorted by must-have → nice-to-have.

The Week-1 R1+R3+R5 hardening (SSRF, DNS rebinding, HTTPS-downgrade, cooldown TOCTOU + failure-rollback, redaction, FIFO, OpenAPI, phrase-id format, taxonomy drift invariants) is orthogonal to these — those are already shipped.

---

## Stub-mode contract today

For each P0/P1 item: what the Week-1 stub currently does, what the Week-2 contract requires, and the smallest server-side change we could ship NOW (Week-1 stub) to keep demo behavior aligned with the future contract. The "fix now" column is the de-risking checklist before the Worker swap.

| # | Item | Stub today | Week-2 contract | Fix now (low-cost de-risk) |
|---|---|---|---|---|
| 1 | Alert hysteresis | Mock trigger emits a fresh STUB observation each click; no alert dispatcher exists yet → no spam, but no dedupe either | `alertCooldownMs` + `alertGroupingWindowMs` per watch; per-(watch, classification) suppression | Hardcode `alertCooldownMs: 60_000` server-side in the store; cap mock observations to 1/minute regardless of trigger spam |
| 2 | Per-channel routing rules | All enabled channels fire identically (no dispatcher yet) | `channelRules[]` with `minConfidence` + `classifications[]` per channel | Defer — needs the dispatcher to exist first |
| 3 | Trust feedback loop | Receipt is read-only | `POST /observations/[id]/feedback` + Vendor Honesty Index rollup | Add a `feedback` button stub on `WatchDetailView` that POSTs to a 501-returning endpoint, so the UX seam ships early |
| 4 | Classification enum | 6 states (unchanged / minor-change / meaningful-change / layout-shifted / blocked / missing) | + `rate-limited`, `auth-wall`, `consent-gate`, `geo-blocked`, `soft-404` | Add the 5 missing enum values to `OBSERVATION_CLASSIFICATIONS` now — the OpenAPI drift-invariant test will assert them across the wire, even though the mock never emits them |
| 5 | Maintenance windows + TZ | Cron interpreted in server UTC; no quiet hours | `timezone` + `quietHours[]` on WatchSpec | Add `timezone?: string` to WatchSpec validator (accept any IANA TZ string, default `"UTC"`); store but don't act on it Week-1 |
| 6 | Calibration period | Trigger always emits an observation | `calibrationRuns` (default 3) — agent observes-but-never-alerts | Defer — alerting doesn't fire Week-1 anyway |
| 7 | 4th autonomy mode | 3 modes | `auto-confident` OR fold into per-channel rules | Defer — design call coupled to #2 |
| 8 | `extractedFields` typing | `Record<string, string\|number\|boolean\|null>` | `intentCategory` + `fieldsSchema` | Add `intentCategory?` enum (pricing/status/changelog/inventory/jobs/custom) to WatchSpec now, stored opaquely — Worker uses it Week-2 |
| 9 | Polling politeness | Trigger fetches without `If-None-Match` / robots.txt | Honor Retry-After, ETag, robots.txt, per-target 1 RPS cap | Worker concern — defer |
| 10 | Stagger / jitter | No scheduler yet | `hash(watchId) % jitterWindowMs` offset | Worker concern — defer |
| 11 | Pluck composition seam | No on-alert verb | `WatchSpec.onAlert.fireBureauProgram` | Add `onAlert?` to WatchSpec validator now, stored opaquely. Critical-path because removing it from the public API later is breaking |
| 12 | Internal-host allowlist | Hardcoded RFC1918/.internal block | Org-scoped `hostnameAllowlist[]` | Defer — needs org concept |
| 13 | `always-agent` queue | No queue, no API | `GET /review-queue` + `POST /review-queue/[id]/resolve` | Defer — coupled to alert dispatcher |
| 14 | Diff strategy | Levenshtein only (Worker will run this) | `diffStrategy` enum + per-strategy threshold | Add `diffStrategy?` to WatchSpec validator now, stored opaquely |
| 15 | `lastFiredAt: null` UX | Renders "never" | Distinguish `awaiting-first-run` from `failing` | Tiny UI fix: render "Awaiting first fire" when `lastFiredAt === null && status === "active"` |
| 16 | `intent` onboarding | Empty textarea | Template gallery | UI: add 3-4 placeholder examples below the intent field as click-to-fill |
| 17 | Idempotency hash drops `name` | Hashes `name` currently | Hash without `name` | Drop `name` from `idempotencyHashOf` canonical input — 1-line change |
| 18 | Vocabulary clash | `/monitors` + `/watch` both live, no comparison copy | Either rename `/monitors` → `/timelines` OR add comparison block | **Recommended:** rename. Only 4 callsites + 1 layout file + 1 type alias |
| 19 | Receipt URL plural | `/watch/<id>` (singular) | Pick — `/watches/<id>` is REST canonical | Defer — coupled to #18 |
| 20 | Per-org budget rollup | Per-watch `dailyBudgetUsd` only | Org-scoped cap | Defer — needs org concept |

**Recommendation: ship "fix now" for items 1, 3, 4, 5, 8, 11, 14, 15, 16, 17 in a focused PR before Week-2 starts.** Each is hours of work; collectively they de-risk most of the Week-2 contract freeze. Item 18 is its own decision (rename or comparison), see below.

---

## P0 — alerting v1 is broken without these

### 1. Alert hysteresis

**Problem:** A page that flips $99 ↔ $109 every 15 min fires 96 alerts/day. Operators churn in week 1.

**Contract changes:**
- `WatchSpec.alertCooldownMs?: number` — minimum gap between alerts on the same watch.
- `WatchSpec.alertGroupingWindowMs?: number` — batch alerts within a window into one envelope.
- Per-(watch, classification) "same-state suppression" — if last alert was `meaningful-change → priceUsd=99`, don't re-alert until classification or value changes.

**Worker responsibility:** track `lastAlertAt` + `lastAlertedObservationHash` per watch.

### 2. Per-channel routing rules

**Problem:** Today every enabled channel fires identically. Real ops want email at 0.9 confidence, dashboard at 0.5, webhook only on `meaningful-change`.

**Contract changes:**
- Replace `AlertChannels` boolean/array shape with `channelRules: ChannelRule[]`:
  ```ts
  interface ChannelRule {
    channel: "dashboard" | "email" | "webhook" | "slack" | "phraseId";
    destinations?: string[];                // email addrs / URLs
    minConfidence?: number;                 // 0..1, default 0
    classifications?: ObservationClassification[];  // empty = all
    requiresAlertWorthy?: boolean;          // default true
  }
  ```
- Keep current `alertChannels` shape as sugar for the simple case.

### 3. Trust feedback loop

**Problem:** No path for "this alert was wrong." Without it, false-positive alert fatigue kills retention AND the agent can't improve.

**Contract changes:**
- `POST /api/v1/observations/[id]/feedback` with body `{ verdict: "false-positive" | "missed-change" | "correct", note?: string }`.
- New `ObservationFeedback` type, stored alongside the observation.
- Surface feedback button in `WatchDetailView` observation card.
- Aggregate into Vendor Honesty Index when it ships.

### 4. Classification enum expansion

**Problem:** 6 states miss ~5 real failure modes that any production monitor sees daily.

**Add to `ObservationClassification`:**
- `rate-limited` — 429 / `Retry-After`. Today maps to `error` (loses semantic).
- `auth-wall` — 302 to login / paywall. Today blocked as `error: redirect blocked`.
- `consent-gate` — cookie wall / GDPR overlay.
- `geo-blocked` — 200 + "not available in your region."
- `soft-404` — 200 + "page moved" content. The wedge case where the agent is REQUIRED.

---

## P1 — must land before Week-2 freeze

### 5. Maintenance windows + TZ on schedule

- `WatchSpec.timezone?: string` (IANA TZ, default UTC).
- `WatchSpec.quietHours?: { tz?: string; ranges: { start: string; end: string }[] }` — alerts during quiet hours queue up; one summary fires at end of quiet.

### 6. Calibration / grace period

- `WatchSpec.calibrationRuns?: number` (default 3) — agent observes-but-never-alerts for the first N fires.

### 7. Fourth autonomy mode: `auto-confident`

Either add the mode, OR fold per-channel `minConfidence` (P0 #2) which obsoletes it.

### 8. `extractedFields` schema hint

- `WatchSpec.intentCategory?: "pricing" | "status" | "changelog" | "inventory" | "jobs" | "custom"` — per-category typed `extractedFields` schema.
- `WatchSpec.fieldsSchema?: Record<string, "string" | "number" | "boolean" | "url" | "date" | "currency">` — operator-supplied for `custom`.

### 9. Polling politeness

- Honor `Retry-After` on 429 / 503.
- Cache `ETag` per watch; send `If-None-Match`. 304 = `unchanged`, skip agent.
- Check `robots.txt` on first fetch; cache 24h. Disallow → reject the watch at POST.
- Per-target rate-limit (default 1 RPS).

### 10. Stagger / jitter on cron fires

Worker: `(hash(watchId) % jitterWindowMs)` deterministic offset.

### 11. Pluck composition seam (R-Watch2 wedge)

- `WatchSpec.onAlert?: { fireBureauProgram?: StudioPipeline; inputs?: Record<string, unknown> }` (templating: `{{watch.url}}`).
- `WatchSpec.onAlertBudgetUsd?: number` — auto-budget cap.

(This is the **Provocation Probe** in `docs/IDEAS.md` R-Watch2 #1.)

### 12. Internal-host escape hatch

- Org-scoped `hostnameAllowlist?: string[]` (admin-only). When set, the URL guard accepts matching hostnames even if they resolve to RFC1918.

### 13. `always-agent` queue surface

- New `ReviewQueueItem` type: `{ id, observationId, watchId, createdAt, expiresAt, assignedTo?, status: "pending" | "approved" | "rejected" | "expired" }`.
- `GET /api/v1/review-queue` (paginated, filterable).
- `POST /api/v1/review-queue/[id]/resolve` with `{ verdict, note? }`.

---

## P2 — quality + UX

### 14. Diff strategy choice

- `WatchSpec.diffStrategy?: "text-levenshtein" | "dom-hash" | "semantic-cosine" | "none"`.
- `diffThreshold` semantics depend on strategy.

### 15. `lastFiredAt: null` UX

Distinguish `awaiting-first-run` from `failing`. Receipt header: "Awaiting first fire — scheduled for X."

### 16. `intent` onboarding

Template gallery on the create form. "Try one of these" — pricing-page, changelog, status-page. Drives discovery AND constrains the agent prompt template.

### 17. Idempotency hash drops `name`

`name` is mutable post-create; including it in the hash means two operators racing to create the same watch with different names get separate watches.

### 18. Vocabulary disambiguation

`/monitors` (NUCLEI timelines) vs `/watch` (semantic) will collide in support. Recommended: rename `/monitors` → `/timelines` while only 4 callsites point at it.

### 19. Receipt URL plural consistency

Listing is `/watch` (singular), receipt is `/watch/<id>`. REST convention is plural collections. Either rename to `/watches/<id>` or document the choice.

### 20. Per-org budget rollup

Org-scoped daily cap with auto-pause across all watches when exceeded.

---

## What's NOT here

- SSRF / DNS rebinding / HTTPS-downgrade / redirect-walker — **shipped R3**
- GET-side redaction — **shipped R1**
- Per-watch observation FIFO — **shipped R1**
- Cooldown TOCTOU — **shipped R3**
- Phrase-ID slash fix + random suffix — **shipped R3**
- SSE caps, Last-Event-ID clamp, nosniff headers — **shipped R1+R3**
- OpenAPI Watch schemas + paths — **landing R3**

## Open question for the user

**Vocabulary clash is the single biggest week-2 risk.** Decide before the Worker locks the URL space.

Recommendation: rename `/monitors` → `/timelines` while only 4 callsites point at it — the name was minted before Watch existed and is increasingly inaccurate.
