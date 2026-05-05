// ---------------------------------------------------------------------------
// /today — Daily Roll-Up across all 11 Bureau programs
// ---------------------------------------------------------------------------
//
// Server-rendered, no client JS. Renders one tile per program (in
// registry order) plus an inline preview of the OG card the route
// emits at /today/opengraph-image. Operators paste the URL into
// Slack / X / Discord and the daily honesty signal auto-unfurls.
//
// Data source: `getDailyRollup()` — counts only, no payload bytes.
// Today the helper folds vendor-preview activity + a hand-curated
// stub for non-vendor-bearing programs; when pluck-api `/v1/runs`
// lands, the helper swaps to a real "since 24h ago" query and this
// page is unchanged.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { getDailyRollup } from "../../lib/programs/today-rollup.js";
import { ACTIVE_PROGRAMS } from "../../lib/programs/registry.js";
import { VERDICT_COLORS } from "../vendor/_ui";

const PAGE_DESCRIPTION =
  "Today on Pluck — one tile per Bureau program showing the last 24h verdict density. The shareable daily honesty card.";

export const metadata: Metadata = {
  title: "Today on Pluck — Daily Honesty Signal",
  description: PAGE_DESCRIPTION,
  openGraph: {
    title: "Today on Pluck — Daily Honesty Signal",
    description: PAGE_DESCRIPTION,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Today on Pluck",
    description: PAGE_DESCRIPTION,
  },
};

const HeaderStyle: CSSProperties = {
  borderBottom: "1px solid var(--bureau-fg-dim)",
  paddingBottom: 16,
  marginBottom: 24,
};

const HeaderDateStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginTop: 8,
};

const PreviewBannerStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderLeft: "3px solid #fbbf24",
  background: "rgba(251, 191, 36, 0.06)",
  padding: "12px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  margin: "16px 0 24px",
  lineHeight: 1.6,
};

const GridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const TileWrapperStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 16,
  background: "rgba(255, 255, 255, 0.02)",
};

const TileNameStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  letterSpacing: "0.08em",
  color: "var(--bureau-fg)",
};

const TileTotalStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
  marginTop: 6,
};

const BarRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  marginTop: 8,
  height: 8,
  borderRadius: 2,
  overflow: "hidden",
  background: "rgba(255, 255, 255, 0.04)",
};

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
};

const OgPreviewStyle: CSSProperties = {
  display: "block",
  width: "100%",
  maxWidth: 720,
  height: "auto",
  marginTop: 16,
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
};

const ShareLinkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 16,
  padding: "8px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  background: "transparent",
  color: "var(--bureau-fg)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  textDecoration: "none",
};

const VERDICT_ORDER: ReadonlyArray<keyof typeof VERDICT_COLORS> = [
  "green",
  "amber",
  "red",
  "gray",
];

interface TileProps {
  readonly slug: string;
  readonly name: string;
  readonly accent: string;
  readonly verdictCounts: { green: number; amber: number; red: number; gray: number };
  readonly totalReceipts: number;
  readonly landingPath: string;
}

function ProgramTile({
  slug,
  name,
  accent,
  verdictCounts,
  totalReceipts,
  landingPath,
}: TileProps): ReactNode {
  const max = Math.max(1, totalReceipts);
  const wrapperStyle: CSSProperties = {
    ...TileWrapperStyle,
    borderLeft: `3px solid ${accent}`,
  };

  return (
    <a
      href={landingPath}
      style={{ textDecoration: "none", color: "inherit" }}
      data-testid={`today-program-tile-${slug}`}
    >
      <article style={wrapperStyle}>
        <h3 style={TileNameStyle}>{name}</h3>
        <div style={BarRowStyle} aria-hidden="true">
          {VERDICT_ORDER.map((verdict) => {
            const count = verdictCounts[verdict];

            if (count === 0) {
              return null;
            }
            const widthPct = (count / max) * 100;

            return (
              <span
                key={verdict}
                style={{
                  width: `${widthPct}%`,
                  height: "100%",
                  background: VERDICT_COLORS[verdict],
                  display: "block",
                }}
              />
            );
          })}
        </div>
        <p style={TileTotalStyle} data-testid={`today-program-total-${slug}`}>
          {totalReceipts === 0
            ? "0 receipts today"
            : `${totalReceipts} receipt${totalReceipts === 1 ? "" : "s"} today`}
        </p>
      </article>
    </a>
  );
}

export default function TodayPage(): ReactNode {
  const rollup = getDailyRollup();
  const landingFor = (slug: string): string => {
    const program = ACTIVE_PROGRAMS.find((p) => p.slug === slug);

    return program?.landingPath ?? "/runs";
  };

  return (
    <div data-testid="today-page">
      <section className="bureau-hero" style={HeaderStyle}>
        <h1 className="bureau-hero-title">Today on Pluck</h1>
        <p className="bureau-hero-tagline">
          Daily honesty signal across all 11 Bureau programs. One tile
          per program, color-coded by today&apos;s verdict density. The
          card below auto-unfurls when this URL is pasted into Slack /
          X / Discord / iMessage.
        </p>
        <p style={HeaderDateStyle} data-testid="today-date">
          UTC date: {rollup.date} · {rollup.totalReceipts} total receipts
        </p>
      </section>

      <p style={PreviewBannerStyle} data-testid="today-preview-banner">
        <strong style={{ color: "#fbbf24" }}>PREVIEW</strong> — this
        roll-up renders demo activity until <code>pluck-api /v1/runs</code>{" "}
        ships. Tile shape, accent colors, and the OG card are final;
        only the receipt source swaps over.
      </p>

      <section>
        <h2 style={SectionHeadingStyle}>
          All 11 programs ({rollup.programs.length})
        </h2>
        <div style={GridStyle}>
          {rollup.programs.map((program) => (
            <ProgramTile
              key={program.slug}
              slug={program.slug}
              name={program.name}
              accent={program.accent}
              verdictCounts={program.verdictCounts}
              totalReceipts={program.totalReceipts}
              landingPath={landingFor(program.slug)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Daily share card</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          The 1200×630 PNG below is what Slack / X / Discord render when
          this URL is pasted. Right-click → save, or copy the share
          link.
        </p>
        {/* Inline preview of the OG card. Cache-busted by date so the
            tile reflects the current day's snapshot. */}
        <img
          src={`/today/opengraph-image?d=${rollup.date}`}
          alt="Pluck daily honesty card preview"
          style={OgPreviewStyle}
          data-testid="today-og-preview"
        />
        <div>
          <a
            href="/today"
            style={ShareLinkStyle}
            data-testid="today-share-link"
          >
            Copy share URL → /today
          </a>
        </div>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Where to go next</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <a href="/runs">/runs</a> — the cross-program activations
            directory. Pick a program, fill in the form, get a signed
            receipt URL.
          </li>
          <li>
            <a href="/vendor">/vendor</a> — the Vendor Honesty Index.
            Per-vendor profiles across all 11 programs.
          </li>
          <li>
            <a href="/monitors">/monitors</a> — the next 24h timeline of
            every published NUCLEI pack&apos;s upcoming fires.
          </li>
          <li>
            <a href="/what-we-dont-know">/what-we-dont-know</a> — the
            negative-knowledge page. What Studio refuses to know.
          </li>
        </ul>
      </section>
    </div>
  );
}
