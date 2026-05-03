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

## R0 (plan-doc) — already captured in `mighty-gliding-swan.md`

These are part of the plan, not surfaced this round:
- Auto-MP4 receipt generator (15s screen-recording with receipt URL burned in)
- Live-vendor takedown stunt at launch
- MCP-first integration ("one line in MCP config and Claude can read the live web with cryptographic receipts")
- Twitter/X card image for receipt URLs
- Public Discord with `#receipts` auto-feed
- Replay last week's incident with a different LLM (Kite's flagship demo)
