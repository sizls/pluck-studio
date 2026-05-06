# Pluck Studio — Innovation Ideas

Captured by the AE Review Loop. Game changers that pass the "FUCK YES, build that NOW" filter ship in the round they were surfaced. The rest live here for future rounds.

## R1 Game-Changer Ideas (Sherlock Moments)

### Top 5 Ranked

1. **Receipt Phrase IDs** — `dragnet-falcon-3742` instead of UUID **(SHIPPED R1)**
   - Why it's a game changer: every shared receipt URL is self-marketing. UUIDs are a brand killer; "swift-falcon-7-contradicts-claude" is a tweet before anyone clicks.
   - Compound effect: every future receipt, share button, MCP citation, X card, leaderboard row inherits memorable identity. URL-irreversible if deferred.
   - Buildable in: hours.
   - Status: shipped in `src/lib/phrase-id.ts` + receipt routes resolve `/runs/{phrase}` and `/runs/{uuid}`.

2. **Live "probe prep" stream on the pending receipt** — terminal-style live feed during the wait
   - Why it's a game changer: turns dead-air "pending" wait into screenshot bait. The bureau-mono terminal aesthetic IS the brand. Operators will record the wait.
   - Compound effect: same component renders real engine events when pluck-api lands. Free instrumentation surface.
   - Buildable in: 1 day.
   - Status: deferred to R2 — needs SSE endpoint + typewriter component, lands when pluck-api stub events are real.

3. **Paste-a-screenshot probe extractor** — drop a screenshot of a vendor's marketing claim, vision-LLM extracts testable assertion **(SHIPPED v3-R1 Backlog #8)**
   - Why it's a game changer: "I screenshotted OpenAI's homepage and DRAGNET caught them in 12 seconds." Best-in-building demo. Zero-friction onboarding for non-CLI users.
   - Compound effect: medium — opens consumer surface, but the extractor lives outside core engine.
   - Buildable in: 2 days.
   - Status: shipped at `/extract` — UI shell + hand-curated stub extractor (real vision-LLM swap is a follow-on commit; same pattern as `/vendor` preview data). Defamation guard locked: every claim renders `(illustrative — verify before probing)`, "Probe with DRAGNET" CTA pre-fills the run form via `?vendor=&assertion=` query params and the operator must still review + click submit (auth-ack required). Privacy posture: screenshot processed CLIENT-SIDE — no upload, no /api/* call, surfaced verbatim on the page.

4. **"Second this receipt" co-signing** — any visitor with a Sigstore identity co-signs your receipt
   - Why it's a game changer: turns receipts into social objects. Sigstore + social proof has never been combined. Karpathy co-signs one → it trends.
   - Compound effect: high long-term — every receipt becomes a growth loop.
   - Buildable in: 1 week.
   - Status: deferred to month 2 — too heavy until receipts exist.

5. **Tournament leaderboard** — public ranking by red-dots-found this week
   - Why it's a game changer: gamification of vendor honesty.
   - Compound effect: medium. Plan already has a leaderboard hook so it's not a day-1 differentiator.
   - Buildable in: 2 days.
   - Status: deferred — derivative of plan's existing leaderboard.

## R2 Game-Changer Ideas

### Top 4 Ranked

1. **Phrase Crest** — procedural SVG sigil per phrase ID **(SHIPPED R2)**
   - Why: every receipt URL gets its own coat of arms — adjective-hashed HSL fill + noun-hashed shape (one of 10 hand-built primitives) + serial-number badge + program-accent border.
   - Compound: massive — renders into /search results (64px), /vendor receipt rows (40px), every receipt-page header (96px). OG cards + RSS embeds + MP4 burn-ins follow as later phases when next/og + dynamic SVG plumbing matures.
   - Buildable in: shipped in 1 round. No external silhouette assets — all 10 shapes hand-built from SVG primitives, no font loads (system mono only), pure-deterministic generator at `src/lib/sigil/phrase-sigil.ts`.
   - Status: shipped. `<PhraseSigil>` exported from `@sizls/pluck-bureau-ui`; deterministic SVG output snapshotted for byte-stability lock.

2. **Dynamic OG Card with Live Contradict-Count** — `/runs/{phrase}/opengraph-image` returns 1200×630 PNG **(SHIPPED R2)**
   - Why: every paste of a receipt URL into Slack/X/Discord/iMessage now auto-unfurls into self-marketing. Vendor name + cycle status + brand chrome.
   - Compound: high — every link-paste in any platform becomes free marketing.
   - Buildable in: 1 day.
   - Status: shipped in `src/app/bureau/dragnet/runs/[id]/opengraph-image.tsx` with stub status (real classification counts come when the runner lands).

3. **Receipt Diff** — `?since=<phrase-id>` shows what changed between two cycles for the same vendor **(SHIPPED R2)**
   - Why: turns DRAGNET into a vendor-honesty time machine. Karpathy-quote-tweet candidate: "OpenAI's pricing claim said X on swift-falcon-3742, now says Y on calm-otter-0918."
   - Compound: high — every future receipt diffs against every previous receipt for the same vendor.
   - Buildable in: 2 days.
   - Status: shipped. Diff aggregator at `src/lib/diff/receipt-diff.ts` — pure + deterministic, v1 store first then `searchPhraseId` directMatch (same swap-target pattern as `/search` and `/open`). Page at `src/app/diff/[id]/page.tsx` with the discriminated `DiffResult` union driving five UI states (instructions / ok / invalid-phrase / not-found / different-vendors). Index at `src/app/diff/page.tsx`. Cross-program comparison ALLOWED when same vendor — `sameProgram: false` flag triggers cross-program corroboration copy. DRAGNET ReceiptView gains a "Compare with another cycle →" CTA that lands on `/diff/<phrase-id>` (no `?since=` so the operator hits the instructions state and pastes the second phrase ID); the other 10 ReceiptViews migrate as a follow-on track. Tests: `src/lib/diff/__tests__/receipt-diff.test.ts` (28 unit), `src/app/diff/[id]/__tests__/page.test.tsx` (13 server-render), `e2e/receipt-diff.spec.ts` (6 e2e).

4. **Phrase-ID Speed-Dial** — `studio.pluck.run/open/<phrase>` + `/o/<phrase>` URL-bar handler **(SHIPPED R2)**
   - Why: phrase ID becomes a global namespace. `/open/openai-bold-marlin-1188` redirects to whichever program owns the receipt — no UUID lookup, no menu navigation, paste-and-go.
   - Compound: medium-high — habit-forming. Every receipt URL ever shared inherits this addressing model.
   - Buildable in: hours.
   - Status: shipped. `/open/<phrase>` route handler at `src/app/open/[phrase]/route.ts`, short-form `/o/<phrase>` re-exports the same GET (no behavioral drift). Resolution pure-fn `resolvePhraseSpeedDial` at `src/lib/speed-dial.ts` checks the v1 store first, then `searchPhraseId` directMatch, then falls back to `/search?q=<input>` (graceful — operator sees decomposition + related-by-scope grid). `/open` index page at `src/app/open/page.tsx` explains the speed-dial with sample links. Cache-Control `private, no-store` + X-Robots-Tag noindex on every redirect. Sitemap lists only the `/open` index. Tests: `src/app/open/[phrase]/__tests__/route.test.ts`, `src/app/open/__tests__/page.test.tsx`, `e2e/open-speed-dial.spec.ts`.

## R3 Deferred Items (tracked, not built this round)

These came out of R3's domain review but require breaking changes / external work / legal-design — captured here so they don't get forgotten.

1. **Phrase-ID legibility v2 — verb-of-action format** (`swift-falcon-3742-vs-openai`)
   - Current `openai-swift-falcon-3742` reads as possessive ("openai's swift falcon"). Reordering to `<adj>-<noun>-<NNNN>-vs-<vendor>` reads as "DRAGNET probed openai".
   - Breaking change to all existing receipt URLs — handle via /old-format → /new-format redirect for back-compat.
   - Defer until v0.5 or until we have data on user confusion.

2. **Probe-pack provenance preview** (signer fingerprint, probe count, summary)
   - Bureau practitioners flag this as TOFU red flag — running an unvetted pack against production is the cardinal sin.
   - Blocked on NUCLEI registry. When NUCLEI ships, the form's probe-pack ID input becomes a picker that fetches manifest metadata before submit.
   - Defer to NUCLEI integration milestone.

3. **Tiered authorization-acknowledgement** (pre-existing-ToS / public-claims / fair-use-research)
   - Single checkbox conflates legal basis. A tiered ack improves defensibility under regulator scrutiny.
   - Blocked on legal-design pass — needs counsel review of the three-tier model.
   - Defer until pre-public-alpha.

4. **Classification taxonomy doc page** (`/docs/dragnet/classifications`)
   - Receipt's inline taxonomy paragraph should lift to a standalone reference page so receipts can link, not repeat.
   - Build alongside the public docs site (pluck-docs sibling repo).

5. **Vendor-prefix vetted allowlist for OG card**
   - Currently any phrase prefix renders in the OG card. A vetted allowlist would strengthen the brand-safety story for shared receipts. Trade-off: gates new vendors behind a manual review step.
   - Defer until first abuse signal.

## v3-R1 Game-Changer Ideas (post-Phase-11 ship)

Surfaced after all 11 alpha programs activated through the unified pattern. Compound on the 11-program × phrase-ID-prefix surface. All deferred this round (1 critical + 8 majors had to land first); revisit when the loop converges.

### Top 5 Ranked

1. **Vendor Honesty Index** — `studio.pluck.run/vendor/openai`
   - Why: every vendor gets a permanent live URL aggregating ALL 11 programs' receipts (DRAGNET reds, FINGERPRINT swaps, OATH expirations, MOLE verdicts, ROTATE notices) into one scrolling timeline.
   - Tweet: *"openai's pluck profile right now: 12 contradictions this week, 1 silent model swap, oath expired 3 days ago. Permanent URL. Updates live."*
   - Compound: massive — every future receipt across every program auto-enriches every vendor page. Permanent SEO + share surface per vendor. Karpathy bookmarks `/vendor/openai`.
   - Buildable in: 2 days. Server-side groupBy on phrase-ID prefix is the entire query (prefixes already vendor-scoped: `openai-...`, `nyt20240115-...`, etc.).
   - Risk: defamation surface for unverified prefixes — gate to vetted prefix allowlist (R3 deferred item — pull forward).
   - Status: **FUCK YES tier — top priority for next build phase.**

2. **Phrase-ID Auto-Stitch Search** — paste any phrase ID, see the receipt graph **(SHIPPED v3-R1 Backlog #2)**
   - Why: single search bar; paste `openai-swift-falcon-3742`; get every related receipt across all 11 programs (same vendor, same operator, BOUNTY/DRAGNET parent-child links).
   - Compound: high — every new program inherits search for free. Becomes the default landing page when someone receives a phrase ID cold.
   - Buildable in: 1 day. Index implicit in prefix scheme; `/search?q=swift-falcon-3742` does prefix decomposition + fan-out.
   - Status: **SHIPPED — `/search` page renders form + decomposition + direct match + related-by-scope grid; runs against vendor-preview today, swaps to `pluck-api /v1/runs?phraseIdPrefix=` when live data lands. Pure aggregator at `src/lib/search/phrase-stitch.ts`; parser at `src/lib/phrase-id.ts` exports `parsePhraseId`.**

3. **NUCLEI ↔ SBOM-AI Auto-Link CTA** — supply-chain loop close **(SHIPPED v3-R1 Backlog #3)**
   - Why: SBOM-AI receipts show "Publish to NUCLEI registry →" with rekor-uuid pre-filled. NUCLEI receipts back-link the SBOM-AI parent.
   - Compound: medium — strengthens supply-chain narrative; necessary but not viral solo.
   - Buildable in: 1 day. Both programs ship; just CTA + back-link section.
   - Status: **SHIPPED — `NucleiPublishCta` on SBOM-AI receipt (gated to `artifactKind === "probe-pack"`, greyed-out while pending), `?sbomRekorUuid=&packName=` query-param prefill on NUCLEI RunForm with banner, "Source artifact" section on NUCLEI receipt with rekor UUID + cosign verify-blob command. `/runs` callout. E2E in `e2e/nuclei-sbom-ai-loop.spec.ts`. See `docs/ARCHITECTURE.md` → "Cross-program flows" and `docs/V1_API.md` → "Cross-publish to NUCLEI" / "Pre-fill via query params".**

4. **Daily Roll-Up OG Card** — `/today/opengraph-image` shows one tile per program color-coded by today's verdict density **(SHIPPED v3-R1 Backlog #3)**
   - Why: the daily-tweet asset; one shareable image summarizes Pluck's last 24h across all 11 programs.
   - Compound: medium-high — pairs with #1 + #2 as the daily distribution arm.
   - Buildable in: 1 day. Reuses existing OG infrastructure.
   - Risk: empty days look sad — pre-seed with stub-status colors.
   - Status: SHIPPED — `/today` page + `/today/opengraph-image` 1200×630 PNG. Aggregation helper at `src/lib/programs/today-rollup.ts` covers all 11 programs (vendor-bearing programs fold from vendor-preview, non-vendor-bearing programs use a deterministic stub). Watermark "DEMO DATA — PREVIEW" carried on the OG card per VHI pattern. Public `getDailyRollup(now?)` API stays stable — the swap to pluck-api `/v1/runs?since=24h` is one private function.

5. **Receipt Subscription Feed** — RSS/Atom per vendor (`/vendor/openai/feed.xml`) **(SHIPPED v3-R1 Backlog #4)**
   - Why: free passive distribution. Journalists subscribe; every new red dot lands in their RSS reader.
   - Compound: high long-tail. Atom is read-only XML, no security surface.
   - Buildable in: 1 day after #1 (depends on the vendor-aggregation query).
   - Status: SHIPPED — Atom 1.0 emitter at `/vendor/[slug]/feed.xml`, payload-redacted at the feed boundary (`redactPayloadForGet`), 5min cache, RSS-reader auto-discovery `<link>` in `/vendor/<slug>` `<head>`. See `src/app/vendor/[slug]/feed.xml/route.ts`.

### Recommended sequence

1. **Vendor Honesty Index** (2d) — keystone
2. **Auto-Stitch Search** (1d) — multiplies #1
3. **Daily Roll-Up OG** (1d) — daily-tweet asset
4. **NUCLEI↔SBOM-AI Link** (1d) — supply-chain loop
5. **Subscription Feed** (1d) — passive distribution

Total: 6 days for the full v3-R1 viral compounds bundle.

## v3-R2 Game-Changer Ideas (post-R1-fixes ship)

Surfaced after R1 hardened the activation surface (D1 license tightening, D3 cron validation, D2/D4 verdict semantics, A2 derivation composition). Three new ideas — all pass the FUCK YES filter, all compound on what R1 introduced. Deferred this round (2 majors had to land first).

### Top 3 Ranked

1. **The Negative-Knowledge Page** — `/what-we-dont-know`
   - Pitch: public page, one row per program: "MOLE — we will never see your canary body. WHISTLE — we will never see your source. ROTATE — we will never see your key fingerprint." Powered by `PHRASE_ID_PREFIX_CONVENTIONS` rationales (R1 introduced) — load-bearing privacy invariants rendered as a marketing asset.
   - Tweet: *"Most security tools brag about what they collect. Here's everything pluck refuses to know about your operation. One row per program. The phrase-ID schema is the proof — if we knew it, it'd be in the URL."*
   - Compound: massive. Becomes the URL pasted into every regulator/SOC2 conversation. Every new program adds a row automatically. Inverts the entire surveillance-tooling genre — Karpathy quote-tweet candidate.
   - Buildable in: hours. Data exists in `registry.ts` (`PHRASE_ID_PREFIX_CONVENTIONS`); it's a new route + a styled table.
   - Status: **FUCK YES tier — keystone of v3-R2. Ship before Vendor Honesty Index.**

2. **Cron Calendar Strip** — visualize next 7 fires of every monitor
   - Pitch: R1's `validateCron` knows the grammar parses. Add `nextNRuns(cron, n=7)` and render a calendar strip on every NUCLEI receipt: "Next 7 fires: Mon 04:00 · Mon 08:00 · Mon 12:00…". Aggregate view at `/monitors` becomes a 24h timeline of every published pack's upcoming fires.
   - Tweet: *"every NUCLEI pack now shows when it'll fire next. paste a cron, see the future. the registry just became a TV guide for AI vendor probes."*
   - Compound: high — pairs with Subscription Feed (v3-R1 backlog) to become a "what's about to happen" daily digest.
   - Buildable in: 1 day (`cron-parser` does next-N).
   - Status: BUILD second — exposes the value of R1's grammar work.

3. **Verdict-Verbose Badge** — registry-fence visibility per pack **(SHIPPED v3-R2)**
   - Pitch: R1 added `published-ingested-only` (NUCLEI) and `re-witnessed` (MOLE) as load-bearing distinctions, currently visible only on individual receipts. Add a public `<VerdictBadge variant="registry-fenced" />` component; surface it on `/runs`, on (future) `/vendor/openai`, and on the NUCLEI registry index. Any pack that's published-but-fenced renders an amber pill linking to a classifications explainer.
   - Tweet: *"NUCLEI's amber 'registry-fenced' badge: 'this pack is in the registry, but consumers refuse to honor it until the SBOM-AI cross-reference clears.' transparent supply-chain trust state, one pixel."*
   - Compound: medium-high — multiplies VHI / Auto-Stitch when those land. Polish on its own; load-bearing combined.
   - Buildable in: hours.
   - Status: shipped. `<VerdictBadge>` server component at `src/components/bureau-ui/VerdictBadge.tsx` with 6 variants (verified / registry-fenced / re-witnessed / expired / failed / pending). `verdictToBadgeVariant()` mapping at `src/lib/programs/verdict-mapping.ts`. Wired into /search results, /vendor receipt rows, and the NUCLEI + MOLE receipt headers — load-bearing trust tiers are now a system-wide visual primitive instead of per-receipt callouts.

### Recommended sequence

1. **Negative-Knowledge Page** (hours) — keystone, ship first
2. **Cron Calendar Strip** (1 day)
3. **Verdict-Verbose Badge** (hours) — fold into next viral compound

All three pass the filter. The Negative-Knowledge Page is the round's standout — TechCrunch headline writes itself ("The first AI-monitoring tool that brags about its own ignorance").

## v4-R1 Game-Changer Ideas (post-MCP-scaffold review)

Surfaced after Receipt Diff + MCP scaffold landed. R1 review found 5 majors (fixed); innovation review surfaced 3 FUCK YES candidates. Deferred — fix-first rule applied. All three remain available as session-scope picks.

### Top 3 Ranked

1. **`/proof` — DSSE-signed attestation of the privacy invariant** (1 day, **HIGH** compound, HIGHEST viral)
   - Pitch: a signed, timestamped, machine-checkable artifact at `/proof` (HTML page + `/proof.json` + `/proof.svg` badge) that runs the redact-boundary tests live against the deployed build, hashes the 7 boundary test results into a Merkle root, and emits a DSSE-signed `application/vnd.in-toto+attestation` envelope. Uses the existing `redact.ts` test corpus — zero new logic.
   - Tweet: *"Most companies say they redact PII. We just shipped /proof — a DSSE-signed attestation, regenerated on every build, that proves all 7 redaction boundaries hold. Verify it yourself: `curl pluck.studio/proof.json | dsse verify`. Receipts for the receipt machine."*
   - Why FUCK YES: Karpathy reposts cryptographic-proof artifacts. Journalists can verify in 30 seconds. Turns the existing privacy invariants into a *shareable cryptographic object*, not a claim. Compounds with every future boundary added.
   - Compound: every new payload-echoing surface gets enrolled in the proof bundle for free.
   - Status: **DEFERRED** — fix-first rule (5 R1 majors had to land first); ready to build next round if user picks.

2. **`pluck://` Resolver Protocol Handler + `/r/<uri>` Web Bridge** (1 day, HIGH compound, HIGH viral)
   - Pitch: the MCP manifest mints `pluck://program/<slug>`, `pluck://run/<id>`, `pluck://phrase/{id}`, `pluck://diff/{base}/{target}` URIs but nothing dereferences them on the web. Ship `/r/[...uri]/page.tsx` that resolves any `pluck://` URI → the human receipt + the DSSE bytes via `Accept` negotiation, plus a `registerProtocolHandler('pluck', ...)` button.
   - Tweet: *"AI agents now speak pluck://. Paste pluck://run/abc123 into Claude, Cursor, or your terminal and the Bureau resolves it. The first protocol handler for AI-audit receipts. /mcp wired the agents — pluck:// wires the rest of the world."*
   - Why FUCK YES: first-class URI scheme is a category-creating move (think `magnet:`, `did:`). MCP folks will quote-tweet. Compounds with /diff, /open, Crest — every existing surface gets a canonical address overnight.
   - Compound: every existing URL primitive (phraseId / diff / vendor / program) gets a stable cite-able machine address.
   - Status: **DEFERRED** — same fix-first rule.

3. **Crest-as-OG: `/og/crest/<phraseId>.png`** (hours, MEDIUM compound, HIGH viral)
   - Pitch: the Phrase Crest sigil is currently DOM-only. Mint a Satori/`@vercel/og` route that renders the Crest as a 1200×630 PNG with the verdict color, vendor scope, and phrase ID. Wire it as the default OG image on every receipt, /diff, /search, /vendor page (~6 lines of metadata each).
   - Tweet: *"Every Pluck phrase ID now has a unique procedural sigil — and now it ships as the OG card. Paste any receipt link in Slack, Discord, X — the Crest shows up. Receipts you can recognize at a glance."*
   - Why FUCK YES: hours of work, multiplies share-conversion across every existing page, makes the under-leveraged Crest visible everywhere links travel. Sherlock-clever because the *same deterministic sigil* a journalist saw in their feed matches the one on the page they land on — visual continuity = trust.
   - Compound: medium — every share surface gets richer; existing OG cards already hand-rendered, so this is a recipe upgrade.
   - Status: **DEFERRED** — same fix-first rule.

### Session-cap recommendation

If the loop converges with 0 critical / 0 major after R2, all three are buildable in <2 days each. Recommend **#1 `/proof`** first — the cryptographic-proof artifact is the strongest viral candidate AND retroactively justifies every "we don't log that" claim across the existing 7 redaction boundaries.

## R0 (plan-doc) — already captured in `mighty-gliding-swan.md`

These are part of the plan, not surfaced this round:
- Auto-MP4 receipt generator (15s screen-recording with receipt URL burned in)
- Live-vendor takedown stunt at launch
- MCP-first integration ("one line in MCP config and Claude can read the live web with cryptographic receipts")
- Twitter/X card image for receipt URLs
- Public Discord with `#receipts` auto-feed
- Replay last week's incident with a different LLM (Kite's flagship demo)
