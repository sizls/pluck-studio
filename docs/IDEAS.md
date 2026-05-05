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

1. **Phrase Crest** — procedural SVG sigil per phrase ID
   - Why: every receipt URL gets its own coat of arms (`midnight-raven`'s sigil = animal silhouette + adjective gradient + serial number).
   - Compound: massive — renders into og:image, X cards, MCP citation, Discord embed, leaderboard avatar, MP4 burn-in.
   - Buildable in: 1 day (needs ~80 SVG animal silhouettes — single-path, MIT-licensed).
   - Status: deferred to R3 — pairs with #2 below for a coordinated "brand asset" drop.

2. **Dynamic OG Card with Live Contradict-Count** — `/runs/{phrase}/opengraph-image` returns 1200×630 PNG **(SHIPPED R2)**
   - Why: every paste of a receipt URL into Slack/X/Discord/iMessage now auto-unfurls into self-marketing. Vendor name + cycle status + brand chrome.
   - Compound: high — every link-paste in any platform becomes free marketing.
   - Buildable in: 1 day.
   - Status: shipped in `src/app/bureau/dragnet/runs/[id]/opengraph-image.tsx` with stub status (real classification counts come when the runner lands).

3. **Receipt Diff** — `?since=<phrase-id>` shows what changed between two cycles for the same vendor
   - Why: turns DRAGNET into a vendor-honesty time machine. Karpathy-quote-tweet candidate: "OpenAI's pricing claim said X on swift-falcon-3742, now says Y on calm-otter-0918."
   - Compound: high — every future receipt diffs against every previous receipt for the same vendor.
   - Buildable in: 2 days.
   - Status: deferred to R3 — needs two real receipts of the same vendor first.

4. **Phrase-ID Speed-Dial** — `pluck open swift-falcon-3742` + `pf:swift-falcon-3742` URL bar handler
   - Why: phrase ID becomes a global namespace. `pluck open swift-falcon-3742` beats every UUID-based tool.
   - Compound: medium-high — habit-forming.
   - Buildable in: hours (URL bar handler) / 1 day (CLI).
   - Status: deferred to R3 — cheap polish.

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

2. **Phrase-ID Auto-Stitch Search** — paste any phrase ID, see the receipt graph
   - Why: single search bar; paste `openai-swift-falcon-3742`; get every related receipt across all 11 programs (same vendor, same operator, BOUNTY/DRAGNET parent-child links).
   - Compound: high — every new program inherits search for free. Becomes the default landing page when someone receives a phrase ID cold.
   - Buildable in: 1 day. Index implicit in prefix scheme; `/search?q=swift-falcon-3742` does prefix decomposition + fan-out.
   - Status: **FUCK YES tier — pairs with #1.**

3. **NUCLEI ↔ SBOM-AI Auto-Link CTA** — supply-chain loop close
   - Why: SBOM-AI receipts show "Publish to NUCLEI registry →" with rekor-uuid pre-filled. NUCLEI receipts back-link the SBOM-AI parent.
   - Compound: medium — strengthens supply-chain narrative; necessary but not viral solo.
   - Buildable in: 1 day. Both programs ship; just CTA + back-link section.
   - Status: BUILD — closes the unblocked supply-chain story.

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

3. **Verdict-Verbose Badge** — registry-fence visibility per pack
   - Pitch: R1 added `published-ingested-only` (NUCLEI) and `re-witnessed` (MOLE) as load-bearing distinctions, currently visible only on individual receipts. Add a public `<VerdictBadge variant="registry-fenced" />` component; surface it on `/runs`, on (future) `/vendor/openai`, and on the NUCLEI registry index. Any pack that's published-but-fenced renders an amber pill linking to a classifications explainer.
   - Tweet: *"NUCLEI's amber 'registry-fenced' badge: 'this pack is in the registry, but consumers refuse to honor it until the SBOM-AI cross-reference clears.' transparent supply-chain trust state, one pixel."*
   - Compound: medium-high — multiplies VHI / Auto-Stitch when those land. Polish on its own; load-bearing combined.
   - Buildable in: hours.
   - Status: BUILD third (or fold into VHI when that ships).

### Recommended sequence

1. **Negative-Knowledge Page** (hours) — keystone, ship first
2. **Cron Calendar Strip** (1 day)
3. **Verdict-Verbose Badge** (hours) — fold into next viral compound

All three pass the filter. The Negative-Knowledge Page is the round's standout — TechCrunch headline writes itself ("The first AI-monitoring tool that brags about its own ignorance").

## R0 (plan-doc) — already captured in `mighty-gliding-swan.md`

These are part of the plan, not surfaced this round:
- Auto-MP4 receipt generator (15s screen-recording with receipt URL burned in)
- Live-vendor takedown stunt at launch
- MCP-first integration ("one line in MCP config and Claude can read the live web with cryptographic receipts")
- Twitter/X card image for receipt URLs
- Public Discord with `#receipts` auto-feed
- Replay last week's incident with a different LLM (Kite's flagship demo)
