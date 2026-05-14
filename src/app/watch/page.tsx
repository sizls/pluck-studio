// ---------------------------------------------------------------------------
// /watch — Landing + Watch list
// ---------------------------------------------------------------------------
//
// Standalone surface, peer to Bureau. Lists active watches for the
// caller's org (Week-1 stub: lists every active watch; ownership lands
// with pluck-api). "Create watch" CTA → /watch/new.
// ---------------------------------------------------------------------------

import Link from "next/link";
import type { ReactNode } from "react";

import { redactWatchForGet } from "../../lib/v1/redact";
import { listWatches } from "../../lib/watch/store";

// Read latest watch list on every request — the in-memory store mutates
// outside the request cycle (SSE pub/sub, manual triggers) and Next's
// default RSC cache would otherwise serve stale snapshots.
export const dynamic = "force-dynamic";
// Watch store uses node:crypto; lock the runtime so a future config flip
// to edge can't silently break this page.
export const runtime = "nodejs";

export const metadata = {
  title: "Watch — Pluck Studio",
  description:
    "Periodic semantic monitoring. Describe what to watch in plain language; the agent decides what changed.",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const CardStyle = {
  display: "block",
  padding: "16px 20px",
  marginTop: 12,
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  textDecoration: "none",
  color: "var(--bureau-fg)",
  background: "rgba(255,255,255,0.02)",
};

const STATUS_COLOR: Record<string, string> = {
  active: "#7ee787",
  paused: "#e3a548",
  running: "#79c0ff",
  failed: "#ff8888",
  archived: "var(--bureau-fg-dim)",
};

export default function WatchLandingPage(): ReactNode {
  const { watches: raw, totalCount } = listWatches({ limit: 50 });
  // Defense-in-depth — every WatchRecord that reaches the RSC tree goes
  // through redaction, so address arrays cannot accidentally land in
  // a future card or debug payload. The current list cards don't read
  // alertChannels addresses, but a casual `JSON.stringify(w)` debug line
  // would leak them without this gate.
  const watches = raw.map((w) => redactWatchForGet(w));

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Watch</h1>
        <p className="bureau-hero-tagline">
          Periodic semantic monitoring. Describe what to watch in plain
          language; the agent decides what changed. No CSS selectors. When
          the page is redesigned, your watches keep working.
        </p>
        <p style={{ marginTop: 16 }}>
          <Link
            href="/watch/new"
            data-testid="watch-create-cta"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontFamily: "var(--bureau-mono)",
              fontSize: 14,
              color: "var(--bureau-bg)",
              background: "var(--bureau-fg)",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            Create a watch →
          </Link>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>
          Active watches ({totalCount})
        </h2>
        {watches.length === 0 ? (
          <p
            data-testid="watch-list-empty"
            style={{ color: "var(--bureau-fg-dim)", marginTop: 12 }}
          >
            No watches yet. Create one to start monitoring.
          </p>
        ) : (
          <ul
            data-testid="watch-list"
            style={{ listStyle: "none", padding: 0 }}
          >
            {watches.map((w) => (
              <li key={w.watchId}>
                <Link
                  href={w.receiptUrl}
                  style={CardStyle}
                  data-testid={`watch-card-${w.watchId}`}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                    }}
                  >
                    <strong
                      style={{ fontSize: 16 }}
                      data-testid={`watch-name-${w.watchId}`}
                    >
                      {w.name}
                    </strong>
                    <span
                      style={{
                        fontFamily: "var(--bureau-mono)",
                        fontSize: 12,
                        color: STATUS_COLOR[w.status] ?? "var(--bureau-fg)",
                      }}
                      data-testid={`watch-status-${w.watchId}`}
                    >
                      {w.status}
                    </span>
                  </div>
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: 13,
                      color: "var(--bureau-fg-dim)",
                    }}
                  >
                    {w.intent.length > 200
                      ? `${w.intent.slice(0, 200)}…`
                      : w.intent}
                  </p>
                  <p
                    style={{
                      marginTop: 8,
                      fontFamily: "var(--bureau-mono)",
                      fontSize: 11,
                      color: "var(--bureau-fg-dim)",
                    }}
                  >
                    {w.url} · {w.cron} · {w.autonomyMode}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>How Watch is different</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>The agent IS the selector.</strong> No CSS scraping —
            describe what to watch in English, the agent reads the page
            the way a human does.
          </li>
          <li>
            <strong>Causal diff explanations.</strong> Alerts say{" "}
            <em>why</em> something changed, quoted from the page itself —
            not just &quot;the number went from X to Y.&quot;
          </li>
          <li>
            <strong>Self-healing on layout change.</strong> When the page
            is rebuilt, the watch keeps working — no broken-selector
            outages.
          </li>
        </ul>
      </section>
    </>
  );
}
