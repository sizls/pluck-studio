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

3. **Paste-a-screenshot probe extractor** — drop a screenshot of a vendor's marketing claim, vision-LLM extracts testable assertion
   - Why it's a game changer: "I screenshotted OpenAI's homepage and DRAGNET caught them in 12 seconds." Best-in-building demo. Zero-friction onboarding for non-CLI users.
   - Compound effect: medium — opens consumer surface, but the extractor lives outside core engine.
   - Buildable in: 2 days.
   - Status: deferred — gate behind human-confirmation step to avoid hallucinated probes / defamation. Probably the #1 acquisition loop once core works.

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

## R0 (plan-doc) — already captured in `mighty-gliding-swan.md`

These are part of the plan, not surfaced this round:
- Auto-MP4 receipt generator (15s screen-recording with receipt URL burned in)
- Live-vendor takedown stunt at launch
- MCP-first integration ("one line in MCP config and Claude can read the live web with cryptographic receipts")
- Twitter/X card image for receipt URLs
- Public Discord with `#receipts` auto-feed
- Replay last week's incident with a different LLM (Kite's flagship demo)
