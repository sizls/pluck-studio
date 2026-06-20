# Pluck Studio — Full Page Audit

A 7-lens, ship-blocker-rigor audit of `studio.pluck.run` against
public-launch readiness. The rigor bar throughout: *"Would a working
journalist, security researcher, regulator, or first-time integrator
notice this is broken on first contact?"* If the answer is no, the
finding was dropped.

Audit panel: UX / interaction · accessibility (WCAG 2.2 AA) · brand +
positioning · domain expert / practitioner · offensive security · privacy
+ compliance · protocol / wire format. The synthesis below is built from
all seven independent reports.

---

## Executive summary — five verdicts

| Question | Verdict |
|---|---|
| Is the Studio surface **coherent**? | **Mixed.** The activation pattern is genuinely reusable. The hub layer broadcasts "preview / demo data / stub" on three of its most-linked surfaces. |
| Is the activation pattern **reusable**? | **Reusable.** All 11 active program forms share `forms.tsx` primitives, identical auth-ack pattern, identical 401/error/redirect handling, identical idempotency contract. Real strength. |
| Is the **alpha-vs-shipping** signal clear? | **Confusing.** `/today` and `/monitors` admit they're rendering stub data — but every program receipt page also renders stub data while implying it's Rekor-anchored. Two different honesty postures across the surface. |
| Is the **personas → page** mapping clean? | **Mixed.** Journalists, regulators, and researchers all have surfaces (`/programs/custody/verify`, `/what-we-dont-know`, `/programs/nuclei`). But `/` is a redirect to `/programs`, so cold-land has no pitch surface. The 51-tile grid is the first thing every persona sees. |
| Is the **security + privacy** posture defensible? | **Gaps with ship-blockers.** Self-documented IDOR on DELETE/PATCH endpoints, missing Article 13 notice, undisclosed Rekor cross-border transfer, no PHI gate on CUSTODY / TRIAL-SEAL. Architectures are sound; surfaces don't yet meet the bar. |

---

## Consensus findings (≥ 4 of 7 lenses agree)

### 1. The stub-backend / signed-receipt mismatch is the single biggest trust risk

Flagged by **domain-expert · brand · UX · offensive · privacy · protocol** (6/7).

`/api/v1/runs` is an explicit in-memory stub — `run-store.ts:5-9` calls it out — yet 11 program landing pages tell operators "your run produces a DSSE-signed envelope notarized on Sigstore Rekor; verify with `cosign verify-blob`." A working security researcher who clicks the `cosign` command on a receipt page gets nothing. The asymmetry between `/today` and `/search` (which admit stub) and every program receipt (which implies Rekor anchoring) is the gap operators will notice.

### 2. WHISTLE's redaction architecture inverts the operator's mental model

Flagged by **domain-expert · privacy · offensive · brand** (4/7).

`/programs/whistle/run` tells the source the redactor *"runs unconditionally"* before submission. The wire actually fetches the bundle server-side from a URL the source has to host — the source's hosting access log is the deanonymization vector, and the redactor cannot run before that fetch. Worse: the minute-bucketed idempotency key (`whistle:<partner>:<category>:<bundleUrl>:<minute>`) returns `reused: true` if any other client posts the same body within 60s, leaking existence-of-prior-submission to anyone who can guess a bundleUrl.

### 3. Per-program "Phase N alpha" callouts read as launch-day disclaimers

Flagged by **brand · UX · domain-expert** (3/7, surfaces as consensus when combined with finding #1).

Yellow-bordered "Phase 4 alpha" / "Phase 6.5 deferral" / "Phase 1.5 ships local-only" callouts dominate the hero region on 17 landing pages. The phrasing is internal roadmap shorthand leaking into operator-facing copy. A regulator or journalist landing cold reads it as "this isn't ready" before the program establishes capability.

### 4. The cross-cutting hub layer broadcasts stub-data status to first-time visitors

Flagged by **UX · brand · domain-expert · privacy** (4/7).

`/today` ships a banner: *"PREVIEW — this roll-up renders demo activity until pluck-api /v1/runs ships."* `/monitors` ships *"Preview: pluck-api /v1/monitors is not yet wired."* Both routes are in `StudioChrome`'s top nav. The first thing an operator clicks from any program page lands on a screen that admits the data is fake. `/runs` ships *"All 11 alpha programs activated"* with the word "alpha" three times in two sections — celebrating coverage while admitting receipts are stubs.

### 5. `/` (root) is a redirect, not a pitch

Flagged by **brand · domain-expert · UX** (3/7, lands as consensus because it's the single biggest brand call).

`src/app/page.tsx:7` is `redirect("/programs")`. Studio's pitch ("Sigstore for AI lies. Every AI vendor lies. Pluck is the public ledger that catches them.") appears as subtitle text above a 51-tile grid. A journalist or regulator typing `studio.pluck.run` is dumped into the operator surface — half the tiles are 300-word paragraphs about RFID cloning, drone C2 ledgers, SCADA setpoint attestation. They bounce before they see the pitch.

### 6. The four-tone color vocabulary is invented per-program

Flagged by **brand · a11y · UX** (3/7, lands as consensus because every persona has to learn it).

`globals.css` declares four tone colors (green / red / black / yellow — where "black" is actually `#b48bff` violet). No surface explains the vocabulary. Per-program verdict words diverge:

- DRAGNET: `contradict / mirror / shadow / snare`
- FINGERPRINT: `stable / minor / major / swap`
- ROTATE: `before-revocation / during-window / after-replacement / trust-but-flag`
- Vendor index: `green / amber / red / gray`
- Monitors: `green / amber / blue / violet / teal`

A journalist reading a CUSTODY bundle and a DRAGNET dossier the same day sees four color systems and four verdict vocabularies for the same concept.

### 7. Cross-resource authorization is missing on state-mutating /v1 endpoints

Flagged by **offensive · privacy · protocol** (3/7) — and the codebase **self-documents** this at
`src/app/api/v1/runs/[id]/route.ts:117-137` with the comment
*"Today, ANY authenticated caller can cancel ANY run. […] MUST be fixed before public alpha."* The same hole exists on PATCH `/api/v1/watches/[id]` — and PATCH accepts `alertChannels`, so an authed attacker can redirect another operator's webhook / email / Slack alerts to attacker-controlled URLs.

---

## Findings by lens

### UX / interaction (1 of 7)

- **Cycle-pending dead-end** (Critical, 1–2 days). DRAGNET 90-second journey terminates at `ReceiptView` rendering `{status ?? "cycle pending"}` (line 189) — the receipt URL is load-bearing for sharing, and it never resolves on stub data. Gate the CTA behind an "alpha — receipts are stubs" interstitial OR auto-promote to a synthetic `anchored` state so the journey terminates.
- **`/today` and `/monitors` in top nav while admitting preview** (High, 0.5 day). Either pull from nav until pluck-api ships or rewrite the banners so the framing is "live data lands when the API ships — schema, accent palette, and OG card are final."
- **CUSTODY's primary CTA is a stub** (High, 1 day). "Verify a bundle by URL" is filled-green primary; the drag-drop offline verifier (which actually works) is demoted to outlined-secondary. Swap the visual hierarchy.
- **"Phase N alpha" inventory dominates landing-page hero region** (High, 1 day). Strip every `Phase N` reference from rendered prose; move roadmap to a single `/roadmap` page or footer link.
- **`/runs` reads as alpha-vibes, not progress** (Medium, 0.5 day). Word "alpha" appears three times in two sections. Rewrite the success state to lead with what operators can do today.

### A11y / WCAG 2.2 AA (2 of 7)

Contrast ratios pass AA across the board (every token vs `#0a0a0a` clears 4.5:1). The lockouts are structural:

- **No `:focus-visible` styles anywhere** (Critical, 0.5 day, SC 2.4.7). Every nav link, button, summary, radio, checkbox, input falls back to browser defaults. Keyboard-only users lose their cursor on every interaction. Fix is one CSS block:
  ```css
  :focus-visible { outline: 2px solid var(--studio-accent); outline-offset: 2px; }
  ```
- **No skip link** (Critical, 0.5 day, SC 2.4.1). `StudioChrome` exposes 6–17 nav links before `<main>`. A keyboard user re-traverses them on every navigation.
- **Form fields are not programmatically labeled** (Critical, 1.5 days, SC 1.3.1 / 4.1.2 / 3.3.2). `StudioInput` has no `id`, no `aria-describedby` wiring to its sibling `StudioHelpText`. Screen readers hear "edit text" + silence — and miss the error-flip when validation flags a field.
- **`StudioHelpText` error flip is silent** (High, 1 day, SC 4.1.3 / 3.3.1). Only `StudioError` has `role="alert"`. The per-field error flip is invisible to AT. Same gap on `RekorSearch` async result + CUSTODY verify result.
- **No `error.tsx` / `loading.tsx` / `not-found.tsx` boundaries at any level** (High, 1 day, SC 3.3.1 / 4.1.3). Server-component throws fall back to the built-in Next page with no Pluck chrome, no skip link, no operator guidance.

### Brand / positioning (3 of 7)

- **`/` has no pitch** (Critical, 4–6 hours). Replace the redirect with a real home page hosting "Sigstore for AI lies." as `<h1>` + a two-sentence pitch + three audience-segmented entry cards (journalist → CUSTODY, researcher → NUCLEI, regulator → `/what-we-dont-know`). Demote the 51-tile catalog to `/programs`.
- **`@pluckbureau` handle still in prose on two landing pages** (Critical, 15 minutes). `programs/dragnet/page.tsx:86` and `programs/fingerprint/runs/[id]/ReceiptView.tsx:300`. Pick the canonical social handle and replace.
- **"Phase N alpha" yellow callout boxes broadcast "not ready"** (Critical, 2–3 hours). Mechanical Edit across 17 landing pages — demote from hero-adjacent callout to status badge near CTA. Keep the substance, kill the boxed-yellow-warning treatment.
- **Four-tone color vocabulary is invented per-program** (High, 6–8 hours). Pick one canonical 4-tone palette (the green/red/black/yellow `globals.css` ships), one canonical 4-verdict vocabulary, write "How to read a Pluck receipt" explainer. Either rename `tone-black` → `tone-violet` to match the actual color, or change the color to actual black.
- **`/programs` hero over-promises against alpha reality** (High, 1 hour). Hero says "Fifty-one programs, every observation Ed25519-signed, anchored to Sigstore Rekor." Reality: 11 are alpha, 40 are research. Change hero or explicitly distinguish "shipping" vs "in development" tile groups.

### Domain-expert / practitioner (4 of 7)

The single line: **"Studio over-promises across every persona except the journalist offline-verify flow."**

- **Journalist (CUSTODY drag-drop)**: Delivers, with one trust gap. The verifier actually runs `verifyCustodyBundle` from `@sizls/pluck-custody` client-side and emits a real FRE 902(13) verdict. But the result UI shows `ok` + flat `reasons` list with no mapping from each reason → admissibility argument. No "copy sigil" or permanent receipt link.
- **Security researcher (NUCLEI cold land)**: Over-promises. The charter sells a Metasploit-grade signed pack registry; the form requires the researcher to *already have a Rekor UUID from a separate SBOM-AI publish step* with no in-page CTA. POST goes to a stub. A nuclei.io-fluent researcher recognizes within 60 seconds it's a registry UI without a registry behind it.
- **Regulator (`/what-we-dont-know` + `/privacy`)**: Strong narrative, undercut by stub data. Defensible *as a posture statement*. **Cannot be used as a GDPR Article 30 record** — no controller/processor designation, no retention periods, no lawful basis per processing activity, no cross-border transfer disclosure, no DPO contact.
- **Vendor (OATH)**: Over-promises and dead-ends. Landing-page copy is sharp ("robots.txt for AI honesty"); the vendor flow lands on `/programs/oath/manage` which is a verbatim placeholder. Vendor signs up, has no UI, leaves.
- **Whistleblower**: Mostly honest about limits, but the *de-identification claim is misleading* — the form does not de-identify before submit; layered redaction runs server-side after Studio fetches the bundle. See finding #2.
- **General operator (`/runs` vs `/today` vs `/search`)**: Three distinct purposes, two are demo data. Discoverability story is excellent (well cross-linked). Data story is "two of three are theatre."

### Offensive security (5 of 7)

- **IDOR on DELETE `/api/v1/runs/[id]` and PATCH `/api/v1/watches/[id]`** (Critical, 1.5 days). Self-documented. PATCH-watch is materially worse: redirects another operator's `alertChannels` to attacker-controlled URLs. Fix: thread Supabase `session.user.id` to `cancelRun(id, userId)` / `updateWatch(id, update, userId)`. Each store function must `return { kind: "forbidden" }` when `record.ownerId !== userId`.
- **Unauthenticated JSON-parse DoS on `/v1/runs` and 11 legacy POSTs** (High, 0.5 day). Body parsed before auth check. No `Content-Length` cap. Origin spoofable by non-browser clients. Hoist the `readBoundedJson` helper from `watches/route.ts` (where the 64 KB cap exists) into `lib/security/request-guards.ts`.
- **Same-Site CSRF gate trivially bypassed by non-browser clients** (High, 1 day). `isSameSiteRequest` falls back to `Origin`/`Referer` allowlist — both client-set. Add a same-origin double-submit cookie or SameSite=Strict CSRF token. Continue same-site as defense-in-depth.
- **WHISTLE idempotency-key existence oracle** (Medium → High under WHISTLE, 0.5 day after IDOR fix). `reused: true` confirms prior-submission of a guessed body within the minute window. Salt the idempotency hash with the authenticated `userId` so cross-operator replays produce different hashes.
- **Verify SSRF redirect-walk gate on watch trigger** (Medium, 0.5 day). `validatePublicUrl` + `validateResolvedIp` must run on every redirect hop, not just the first URL. Confirm in `lib/watch/store.ts triggerWatch`.

### Privacy / compliance (6 of 7)

- **Article 13/14 notice failure on `/privacy`** (High). Page discloses posture but omits every required Article 13 element: controller identity, DPO contact, lawful basis under Article 6, retention period (24h TTL in `run-store.ts:51` not user-disclosed), recipients (Rekor / Sigstore / newsroom partners), Article 13(1)(f) third-country transfers.
- **Article 49 Rekor cross-border transfer undisclosed** (High). Every signed receipt is appended to US-hosted Sigstore Rekor. `/privacy` does not name it as a cross-border transfer; per-form auth-ack does not constitute "specific, informed, unambiguous" Article 49(1)(a) consent.
- **No PHI/HIPAA gate on CUSTODY / TRIAL-SEAL / CITIZEN-LEDGER** (High). CUSTODY accepts arbitrary `bundleUrl`; runner fetches server-side. The hash + URL get published to Rekor permanently. No checkbox saying "this bundle does not contain PHI or attorney-client material." Operators in HIPAA jurisdictions are exposed; Pluck is processor-shaped — joint controllership under Article 26 plausible.
- **Article 30 RoPA stub: `/privacy` "subpoena posture" exposes processing without a RoPA entry** (Medium-High). `/privacy:103-112` says "we retain the operator-account → phrase-id mapping … for billing + abuse response." That is a core processing activity; no RoPA, no DPIA, no LIA balancing test referenced.
- **WHISTLE idempotency oracle as privacy violation** (Medium). Same finding as offensive #4, framed through the privacy lens — violates the implied anonymity claim on `/what-we-dont-know`. Drop `reused: true` for WHISTLE specifically or salt the key with operator id.

`/what-we-dont-know` claim audit verdict per program:

- **WHISTLE** holds at code with the caveat that IP-presence is processed (rate-limit bucket key in `request-guards.ts:108-113`), even though not persisted. The unqualified "no IP / cookie / fingerprint" claim is overstated.
- **CUSTODY** holds. Validator accepts only `bundleUrl` + `expectedVendor` + auth-ack. But missing the PHI gate (above).
- **MOLE** holds — cleanest claim/code pair. Validator hard-rejects `canaryBody` on the wire.
- **ROTATE** holds at code but the first claim is misleading: full SPKI fingerprint IS stored and echoed; only the URL prefix uses `reason`. Posture-vs-UI contradiction: form tells operator `operatorNote` is "visible to anyone verifying the rotation" while GET-side redactor strips it.

### Protocol / wire format (7 of 7)

- **MCP discovery doc gated same-site** (Critical, 10 minutes). `manifest.json/route.ts:44` calls `isSameSiteRequest`. A third-party MCP bridge fetching from any other origin gets 403. Discovery documents must be reachable by anyone with the URL. Mirror `/openapi.json/route.ts`; drop the gate.
- **No production-grade auth for cross-origin /v1 callers** (Critical, 30 min spec fix OR 1–2 days for real bearer). The OpenAPI spec advertises `bearerAuth` on POST/DELETE/PATCH; runtime only accepts Bearer when `NODE_ENV in {test, development}`. Production rejects all bearer + all cross-origin Supabase-cookie callers. Decision-required: drop the security scheme from the spec, OR ship real Supabase JWT verify + CORS allowlist in production.
- **`Retry-After` header missing on 6 of 7 documented 429 paths** (High, 2 hours). Rate limit is 10/min. Every standard SDK retry layer reads `Retry-After`. Without it, clients fall back to exponential backoff or hard-fail. Add `Retry-After` + `X-RateLimit-Limit/Remaining/Reset` (IETF draft-ietf-httpapi-ratelimit-headers).
- **Per-pipeline payload schemas not in OpenAPI** (High, 4–6 hours). `RunSpec.payload: { type: object, additionalProperties: true }` + prose "see docs/V1_API.md." Code-generated clients produce useless `payload: Record<string, unknown>`. Translate the 11 `PIPELINE_VALIDATORS` into OpenAPI 3.1 `oneOf` with `discriminator.propertyName: "pipeline"`. Add a parallel `RedactedRunRecord` schema reflecting the GET-side strip.
- **`Deprecation: true` is the abandoned draft syntax** (Medium, 30 min). RFC 9745 (2024) replaced literal `true` with a `Date`/structured field. Production clients increasingly expect the date form.

---

## Four ranked recommendation lists

### Critical — fix before public-launch (≤ 1 week total)

1. **Wire ownership before public launch — close the IDOR.** `runs.ownerId` + `watches.ownerId` + every state-mutating endpoint checks `record.ownerId === session.user.id`. Closes the self-documented "MUST be fixed before public alpha" comment. **1.5 days.**
2. **Replace `/` redirect with a real home page.** Hero pitch + three audience-segmented entry cards. The single biggest brand call; without it Studio has no pitch surface for non-operator audiences. **0.5 day.**
3. **Strip "Phase N alpha" yellow callouts across 17 landing pages.** Mechanical Edit. Replace with one-line status badge near CTA. **2–3 hours.**
4. **Add `:focus-visible` styles, skip link, and form `aria-describedby` wiring.** A11y lockouts. **2 days.**
5. **Add the WHISTLE redaction-architecture honesty fix.** Either client-side redaction (paste-the-bundle-text, run TRIPWIRE-scrub in WASM, post the redacted blob) OR change the copy to "Studio's redactor runs at routing time, *after* we fetch your bundle — host on an anonymous venue." The current framing is the inverse of the truth. **1 day for copy fix; 3–4 days for client-side redaction.**
6. **Salt WHISTLE idempotency key with operator userId — close the existence oracle.** Drops cross-user oracle to zero after IDOR fix lands. **0.5 day.**
7. **Body-size cap on ALL POST routes, applied before auth.** 30-minute lift sharing `readBoundedJson` out of `watches/route.ts`. **0.5 day.**
8. **Add ALPHA banner on every program receipt page until pluck-api ships.** Either gate every "signed receipt" claim behind a visible banner (parallel to `/today` PREVIEW) OR auto-promote to a synthetic `anchored` state. The current asymmetry (`/today` admits stub; receipts imply Rekor anchoring) is the largest trust risk. **1 day.**
9. **Article 13 notice rewrite on `/privacy` + Article 49 Rekor cross-border disclosure on every activation form auth-ack.** Add controller identity + DPO email + Article 6 basis per program + Rekor-as-US-processor statement. **1.5 days.**
10. **Update `@pluckbureau` social-handle prose on `dragnet/page.tsx:86` and `fingerprint/runs/[id]/ReceiptView.tsx:300`.** Pick canonical handle. **15 minutes.**

**Total critical: ~7–8 dev-days.**

### High-value polish (1–3 days each)

11. **Add real CSRF token (double-submit cookie).** Same-site is soft. **1 day.**
12. **Wire form-level error announcement (`role="alert"` on `StudioHelpText` error variant).** Closes the silent validation-error gap. **0.5 day.**
13. **Add `error.tsx` / `loading.tsx` / `not-found.tsx` boundaries at root + per-program receipt routes.** **1 day.**
14. **Canonical 4-tone palette + verdict vocabulary explainer page.** Pick canonical, write "How to read a Pluck receipt." **1 day.**
15. **CUSTODY verify result: map each `reasons[]` code to a one-line admissibility argument; add "copy verification permalink".** **1 day.**
16. **Hide `/today` and `/monitors` from top nav until pluck-api ships, OR rewrite banners.** **2 hours.**
17. **`Retry-After` + `X-RateLimit-*` headers on all 429 paths.** **2 hours.**
18. **CUSTODY landing: swap visual hierarchy so drag-drop (working) is primary CTA, "Verify by URL" (stub) is secondary.** **1 hour.**
19. **OATH flow: hide `/manage` from landing CTA, route vendor to CLI quick-start + badge-embed snippet.** **1 day.**
20. **Demote `Deprecation: true` → RFC 9745 `Deprecation: <date>`.** **30 minutes.** Extract to shared constant across 11 routes.

### Bigger lifts (> 1 week)

- **Per-pipeline payload schemas in OpenAPI with `oneOf` discriminator + parallel `RedactedRunRecord`.** SDK-generation enabler. **4–6 hours per pipeline × 11 = 4–6 days.**
- **Production Supabase JWT bearer-token validation + CORS allowlisting for /v1.** If the answer is "real MCP clients can talk to /v1 in production." Otherwise drop the security scheme from the spec. **1 week.**
- **PHI gate architecture for CUSTODY / TRIAL-SEAL / CITIZEN-LEDGER**: operator attestation + jurisdiction gate + BAA program OR refuse PHI bundles. **2 weeks for the policy + UI + legal review.**
- **Client-side WHISTLE redaction in WASM** if you choose architecture over copy. **1 week.**
- **Article 30 RoPA `/privacy/processing-activities` page + Article 35 DPIA.** **1 week including legal review.**
- **MCP manifest cross-origin public-discoverable + CORS preflight + auth-gating restructured.** **3–5 days.**

### Decision-required (user owns these calls)

1. **Same-site only, or production bearer?** If "Studio is a same-origin browser surface and the @sizls/pluck-mcp bridge is the only sanctioned cross-origin caller" — say that loudly in OpenAPI `info.description`, drop `bearerAuth` from security schemes, document `/api/mcp/manifest.json` as bridge-proxied. If "real MCP clients can talk to /v1 in production" — ship CORS + real Bearer + per-token rate-limit. **1-day vs 1-week fork.**
2. **WHISTLE: client-side redaction (3–4 days) or honest copy (1 day)?** Today's copy implies client-side; the wire does server-side. An actual whistleblower comparing to SecureDrop will spot the gap.
3. **OATH vendor flow: hide `/manage` (1 day, delivers something — CLI + badge-embed) or hold OATH launch until in-browser claim editor exists (multi-week)?** Don't ship a polished landing → placeholder dead-end on a launch day.
4. **Joint controllership stance on CUSTODY / TRIAL-SEAL / CITIZEN-LEDGER:** BAA before public launch, attestation refusal, or geographic gating? Highest individual liability surface in the audit.
5. **Inline per-pipeline payload schemas in OpenAPI, or hard-redirect to `docs/V1_API.md`?** If inlined: SDK generation works on day one. If kept in markdown: change `RunSpec.payload.description` to a single hard pointer and stop advertising a machine-generable client. The middle ground is the worst of both.
6. **Idempotency: body field or `Idempotency-Key` header?** Industry-standard is the header. Studio uses a body field. Match the industry or stay body-only and document explicitly.

---

## Decision criteria — what would change each verdict

- **"Mixed → Coherent" on surface coherence:** strip the "Phase N alpha" callouts, pull `/today` + `/monitors` out of top nav until they're real, add the ALPHA banner on every receipt page. Three mechanical fixes.
- **"Reusable → Reusable" on activation pattern: already there.** No change needed; preserve the discipline. Resist letting individual programs invent their own form primitives.
- **"Confusing → Clear" on alpha signal:** adopt one honesty posture. Either every stub-data surface admits it (parallel to `/today`'s PREVIEW banner) OR none do (auto-promote to synthetic anchored state). The current asymmetry is the worst path.
- **"Mixed → Clean" on personas:** build `/` as a real pitch surface with three audience-segmented entry cards. Demote `/programs` to the operator-catalog page.
- **"Gaps with ship-blockers → Defensible" on security + privacy:** ship the four critical findings above (IDOR, body cap, Article 13 notice, WHISTLE oracle). Adds ~4 dev-days plus the privacy-rewrite review cycle.

---

## Out-of-scope findings (captured for the record)

Findings raised by lenses that didn't meet the ship-blocker bar, recorded so future polish rounds have them:

- Add `prefers-reduced-motion` stub (a11y; codebase has no actual motion to reduce)
- Snapshot test for OpenAPI spec parity with PIPELINE_VALIDATORS
- Demote footer `<h3>` to `<h4>` to fix heading-hierarchy nit
- Add JSON-LD structured data on receipt pages for social share
- Audit mobile responsiveness at narrower-than-768px breakpoints
- Add `Idempotency-Key` HTTP header alongside the body field
- Add CORS allowlist for OpenAPI route
- Add `If-Modified-Since` on OpenAPI route
- `Last-Event-ID` parse parity between runs and watches SSE (runs unclamped, watches clamped)
- Watch SSE `observation` event redaction parity (watch out for future `alertSentTo` field)
- Per-program README pre-flight check for stale "Pluck Bureau" wording (the rename sweep cleared the live surface; future-program prose may regress)

---

## Page-by-page notes (active surfaces)

### Landing + cross-cutting hubs

| Page | Status | Top finding | Recommended action |
|---|---|---|---|
| `/` | Production (redirect) | No pitch surface | Replace redirect with real home page (Critical, 0.5d) |
| `/programs` | Production (stub-program-data) | Hero over-promises 51 programs | Hero pivots to "Eleven shipping, fifty-one in the roadmap" (1h) |
| `/runs` | Production | "Alpha" appears 3× in success state | Rewrite success state to lead with what works today (0.5d) |
| `/today` | Alpha placeholder | Top-nav admits PREVIEW data | Hide from nav or rewrite banner (2h) |
| `/search` | Alpha placeholder | Stub data, honest banner | Acceptable — leave or hide from cross-links until real |
| `/vendor`, `/vendor/[slug]` | Alpha placeholder | Stub data, less-honest banner | Add explicit PREVIEW banner parallel to `/today` (1h) |
| `/watch`, `/watch/new` | Beta | Watch IDOR (see offensive #1) | Wire ownership (1.5d) |
| `/monitors` | Alpha placeholder | Top-nav admits PREVIEW data | Hide from nav until pluck-api lands (1h) |
| `/mcp` | Production | MCP manifest gated same-site | Drop same-site gate on manifest route (10m) |
| `/extract` | Alpha stub | Not in top nav, hidden in body copy | Add to `CROSS_CUTTING_LINKS` (15m) |
| `/what-we-dont-know` | Production | Cleanest page on the site — keep as-is | Optional: per-program PHI flag for CUSTODY / TRIAL-SEAL |
| `/privacy` | Production posture | Missing Article 13 notice | Rewrite for public launch (1.5d) |
| `/sign-in` | Alpha stub | Acceptable as-is | Hide auth-actions until launch |

### Per-program active flows (11 programs × 3-route pattern)

For each program: landing → run form → receipt view. All 11 forms share `forms.tsx` primitives — the activation pattern is reusable across the board. **One shared receipt-page finding applies to all 11**: the receipt copy implies Rekor anchoring while the backend is a stub. Apply the ALPHA banner fix once (item #8 in Critical list) and it lands across all 11 programs.

| Program | Top finding | Recommended action |
|---|---|---|
| DRAGNET | Cycle-pending dead-end; `@pluckbureau` handle leak | ALPHA banner + handle update |
| OATH | `/manage` is a placeholder dead-end | Hide `/manage`; route to CLI + badge-embed (1d) |
| FINGERPRINT | Cycle-pending dead-end; `@pluckbureau` handle leak on receipt | ALPHA banner + handle update |
| CUSTODY | Primary CTA is a stub; drag-drop offline verifier is working | Swap CTA hierarchy (1h) + map reasons to admissibility (1d) |
| NUCLEI | Promised registry without a registry; pack requires SBOM-AI UUID with no CTA | ALPHA banner + add in-page "Publish to SBOM-AI first" CTA |
| WHISTLE | Redaction-architecture honesty fix (consensus #2) | Pick the copy fix (1d) or client-side redaction (3–4d) |
| BOUNTY | `/inbox` is a stub; otherwise consistent with pattern | Hide `/inbox` from CTAs until status polling lands |
| SBOM-AI | Cycle-pending dead-end | ALPHA banner |
| ROTATE | `operatorNote` copy vs redactor contradiction | Either visible-to-verifiers OR redact — pick one (15m copy fix) |
| TRIPWIRE | Cycle-pending dead-end | ALPHA banner |
| MOLE | Cycle-pending dead-end; clean code/claim pair otherwise | ALPHA banner |

### Stub / future-phase programs (~40 routes)

These render mostly read-only landing pages with no activation surface. Single-row treatment per phase group:

- **Phase 7+** (RAVEN, reputation, leaderboard, monitors detail): static landing pages, Kite Event Log integration deferred. No ship-blocker — they don't promise activation. Optional: add an explicit "Roadmap" badge.
- **Phase 9 / 10** (ACOUSTIC-SCRIBE, AVAP): single landing pages, no activation. Same as above.
- **Composite dossiers** (ELECTION-DAY-WATCH, SCIF-AUDIT, PHARMA-MIRROR, AUTONOMY-LEDGER): listed in the program catalog with full taglines. Verify the prose doesn't imply they're activatable today.

---

## Appendix — auditor confidence

Each finding above was raised by ≥ 1 of the 7 lenses; consensus findings (≥ 4 of 7) are flagged in the Consensus section and represent the highest-confidence calls. Contested findings (a lens raised them but other lenses disagreed) appear in the per-lens sections without consensus flagging.

Each finding meets the ship-blocker rigor bar: a working journalist, security researcher, regulator, or first-time integrator would notice the gap on first contact. Findings raised by lenses that did not meet that bar are captured in the **Out-of-scope** section for the record.
