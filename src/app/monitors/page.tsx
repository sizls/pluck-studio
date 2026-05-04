// ---------------------------------------------------------------------------
// /monitors — 24h aggregate timeline of every NUCLEI pack's fires
// ---------------------------------------------------------------------------
// Phase-stub: pluck-api /v1/monitors not yet live. Data lives in
// lib/programs/monitors-preview.ts and gets swapped for a fetch when
// the endpoint lands. Server-rendered, UTC, single anchor per request.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { nextNRuns } from "../../lib/cron/next-runs";
import {
  MONITORS_PREVIEW,
  type MonitorEntry,
} from "../../lib/programs/monitors-preview";

export const metadata = {
  title: "Monitors — Pluck Bureau",
  description: "Aggregate 24h timeline of every published NUCLEI pack's fires.",
};

const TONE_COLORS: Record<MonitorEntry["tone"], string> = {
  green: "#1f7a3a",
  amber: "#a78a1f",
  blue: "#2f6fad",
  violet: "#7d4fa4",
  teal: "#2f8c91",
};

const HEAD: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
  marginBottom: 8,
};

const BANNER: CSSProperties = {
  marginTop: 16,
  padding: "10px 14px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  background: "rgba(167, 138, 31, 0.06)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
};

const WRAP: CSSProperties = {
  marginTop: 24,
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 16,
  background: "rgba(255, 255, 255, 0.02)",
};

const TIMELINE_HEAD: CSSProperties = {
  position: "relative",
  height: 18,
  marginLeft: 220,
  borderBottom: "1px dashed var(--bureau-fg-dim)",
};

const TICK: CSSProperties = {
  position: "absolute",
  top: 0,
  fontFamily: "var(--bureau-mono)",
  fontSize: 10,
  color: "var(--bureau-fg-dim)",
  transform: "translateX(-50%)",
};

const ROW: CSSProperties = { display: "flex", alignItems: "center", marginTop: 10 };

const ROW_LABEL: CSSProperties = {
  flex: "0 0 220px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg)",
  paddingRight: 12,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const TRACK: CSSProperties = {
  position: "relative",
  flex: 1,
  height: 14,
  background: "rgba(255, 255, 255, 0.03)",
  borderRadius: 2,
};

const LI: CSSProperties = {
  borderBottom: "1px solid var(--bureau-fg-dim)",
  padding: "12px 0",
};

const HOUR_TICKS = [0, 4, 8, 12, 16, 20, 24];
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function fireDots(
  entry: MonitorEntry,
  from: number,
): Array<{ leftPct: number; time: Date }> {
  // 200 caps `*/15` (96 fires / 24h) with headroom; nextNRuns walks
  // forward and we slice at the 24h horizon below.
  const all = nextNRuns(entry.recommendedInterval, 200, from);
  const horizon = from + ONE_DAY_MS;
  const out: Array<{ leftPct: number; time: Date }> = [];
  for (const t of all) {
    const ms = t.getTime();
    if (ms >= horizon) {
      break;
    }
    out.push({ leftPct: ((ms - from) / ONE_DAY_MS) * 100, time: t });
  }

  return out;
}

export default function MonitorsPage(): ReactNode {
  const from = Date.now();

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">NUCLEI monitors</h1>
        <p className="bureau-hero-tagline">
          Every published NUCLEI pack's upcoming fires, plotted on a 24-hour
          timeline. Paste a cron; see the future. The registry is now a TV
          guide for AI vendor probes.
        </p>
        <p style={BANNER} data-testid="monitors-preview-banner">
          <strong>Preview:</strong> <code>pluck-api /v1/monitors</code> is
          not yet wired. The view below renders a hand-curated set of
          representative packs so you can see the shape — once the endpoint
          lights up, this page swaps to live data with no other changes.
        </p>
      </section>

      <section>
        <h2 style={HEAD}>Next 24 hours (UTC)</h2>
        {/* Narrow viewports collapse the timeline (220px label + ticks
            crush the dot row into an unreadable smear under ~720px).
            We hide the timeline and surface a note pointing at the list
            view, which is already mobile-friendly. */}
        <style>{`
          .monitors-mobile-note { display: none; }
          @media (max-width: 720px) {
            .monitors-timeline { display: none !important; }
            .monitors-mobile-note { display: block; }
          }
        `}</style>
        <p
          className="monitors-mobile-note"
          data-testid="monitors-mobile-note"
          style={BANNER}
        >
          Timeline view is desktop-only — the list view below shows the same
          data on narrow screens.
        </p>
        <div
          className="monitors-timeline"
          style={WRAP}
          data-testid="monitors-timeline"
          aria-label="24-hour pack-fire timeline"
        >
          <div style={TIMELINE_HEAD}>
            {HOUR_TICKS.map((h) => (
              <span key={h} style={{ ...TICK, left: `${(h / 24) * 100}%` }}>
                +{h}h
              </span>
            ))}
          </div>
          {MONITORS_PREVIEW.map((entry) => {
            const fires = fireDots(entry, from);
            const color = TONE_COLORS[entry.tone];

            return (
              <div
                key={`${entry.author}/${entry.packName}`}
                style={ROW}
                data-testid="monitors-row"
              >
                <div style={ROW_LABEL}>
                  <code>{entry.author}</code>/<code>{entry.packName}</code>
                </div>
                <div style={TRACK}>
                  {fires.map((f) => (
                    <span
                      key={f.time.toISOString()}
                      title={`${f.time.toISOString()} — ${entry.recommendedInterval}`}
                      style={{
                        position: "absolute",
                        left: `${f.leftPct}%`,
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: color,
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 style={HEAD}>List view</h2>
        <ul
          style={{ marginTop: 8, padding: 0, listStyle: "none" }}
          data-testid="monitors-list"
        >
          {MONITORS_PREVIEW.map((entry) => (
            <li key={`list-${entry.author}/${entry.packName}`} style={LI}>
              <strong style={{ fontFamily: "var(--bureau-mono)" }}>
                <code>{entry.author}</code>/<code>{entry.packName}</code>
              </strong>{" "}
              <span style={{ color: "var(--bureau-fg-dim)", fontSize: 13 }}>
                — interval <code>{entry.recommendedInterval}</code>
              </span>
              <p
                style={{
                  fontFamily: "var(--bureau-mono)",
                  fontSize: 12,
                  color: "var(--bureau-fg-dim)",
                  marginTop: 4,
                }}
              >
                Predicate: <code>{entry.predicateUri}</code>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={HEAD}>Adjacent</h2>
        <p>
          <a href="/runs">Activations directory</a> ·{" "}
          <a href="/bureau/nuclei">About NUCLEI</a> ·{" "}
          <a href="/bureau/nuclei/run">Publish a pack</a>
        </p>
      </section>
    </>
  );
}
