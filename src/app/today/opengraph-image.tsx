// ---------------------------------------------------------------------------
// /today/opengraph-image — auto-generated 1200×630 daily honesty card
// ---------------------------------------------------------------------------
//
// The daily-tweet asset. Operators paste `studio.pluck.run/today` into
// Slack / X / Discord and the unfurl shows all 11 Bureau programs'
// last-24h verdict density in a single card.
//
// Layout: 4×3 grid (12 cells, one empty) — each tile carries program
// name, accent strip, and a green/amber/red proportion bar.
// Watermark "DEMO DATA — PREVIEW" in the top-right is required while
// the rollup helper aggregates stub data.
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

import {
  getDailyRollup,
  type ProgramRollup,
  type VerdictCounts,
} from "../../lib/programs/today-rollup.js";

export const runtime = "edge";
export const alt = "Pluck — today's honesty signal across 11 Bureau programs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FG = "#e4dccd";
const FG_DIM = "#888273";
const BG = "#1a1a1a";
const ACCENT = "#a3201d";

const WATERMARK_BG = "#ffd166";
const WATERMARK_FG = "#1a1a1a";
const WATERMARK_TEXT = "DEMO DATA — PREVIEW";

const VERDICT_COLORS = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#ef4444",
  gray: "#6b7280",
} as const;

function WatermarkChip(): ReactElement {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: WATERMARK_BG,
        color: WATERMARK_FG,
        fontFamily:
          "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "6px 12px",
        borderRadius: 4,
      }}
    >
      {WATERMARK_TEXT}
    </div>
  );
}

function ProgramTile({ program }: { program: ProgramRollup }): ReactElement {
  const counts: VerdictCounts = program.verdictCounts;
  const total = program.totalReceipts;
  const max = Math.max(1, total);
  const barWidth = 220;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid #333",
        borderLeft: `4px solid ${program.accent}`,
        borderRadius: 6,
        padding: "12px 14px",
        width: 250,
        height: 110,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: FG,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "0.06em",
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        }}
      >
        <span>{program.name}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 12,
          height: 10,
          width: barWidth,
          background: "#222",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {(["green", "amber", "red", "gray"] as const).map((verdict) => {
          const count = counts[verdict];

          if (count === 0) {
            return null;
          }
          const w = (count / max) * barWidth;

          return (
            <div
              key={verdict}
              style={{
                display: "flex",
                width: w,
                height: "100%",
                background: VERDICT_COLORS[verdict],
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 10,
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          fontSize: 13,
          color: FG_DIM,
          letterSpacing: "0.04em",
        }}
      >
        {total === 0 ? "0 today" : `${total} today`}
      </div>
    </div>
  );
}

export default function Image(): Response {
  const rollup = getDailyRollup();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: FG,
          display: "flex",
          flexDirection: "column",
          padding: "32px 48px",
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color: FG_DIM,
            fontSize: 20,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ color: ACCENT }}>●</span>
            <span style={{ marginLeft: 14 }}>
              Pluck — Today&apos;s Honesty Signal
            </span>
          </div>
          <WatermarkChip />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 8,
            color: FG_DIM,
            fontSize: 18,
          }}
        >
          <span style={{ letterSpacing: "0.06em" }}>UTC {rollup.date}</span>
          <span style={{ marginLeft: 16 }}>
            · {rollup.programs.length} programs · {rollup.totalReceipts} receipts
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 24,
            justifyContent: "flex-start",
          }}
        >
          {rollup.programs.map((program) => (
            <ProgramTile key={program.slug} program={program} />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: FG_DIM,
            fontSize: 16,
            marginTop: "auto",
          }}
        >
          <span>
            {rollup.verdictBreakdown.green} green ·{" "}
            {rollup.verdictBreakdown.amber} amber ·{" "}
            {rollup.verdictBreakdown.red} red ·{" "}
            {rollup.verdictBreakdown.gray} gray
          </span>
          <span style={{ letterSpacing: "0.08em" }}>
            studio.pluck.run/today
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
