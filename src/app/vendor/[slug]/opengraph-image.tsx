// ---------------------------------------------------------------------------
// /vendor/[slug]/opengraph-image — auto-generated 1200×630 PNG
// ---------------------------------------------------------------------------
//
// Every paste of /vendor/<slug> in Slack / X / Discord / iMessage now
// auto-unfurls into a self-marketing card. Vendor display name is the
// headline; verdict breakdown renders as three colored bars; total
// receipt count anchors the subhead. Turns the vendor profile URL into
// a one-click receipt-of-the-receipts: "openai's pluck profile right
// now: 12 contradictions this week, 1 silent model swap."
//
// Unknown slugs render a neutral placeholder rather than 404 — the
// social-platform crawler shouldn't see a JSON 404 + image; it should
// see a rendered, generic Bureau card.
// ---------------------------------------------------------------------------

import { ImageResponse } from "next/og";
import type { ReactElement } from "react";

import { VENDOR_BEARING_PROGRAMS } from "../../../lib/programs/registry";
import { lookupVendor } from "../../../lib/programs/vendor-registry";
import { getVendorPreview } from "../../../lib/programs/vendor-preview";

export const runtime = "edge";
export const alt = "Vendor honesty profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface OgProps {
  params: Promise<{ slug: string }>;
}

const FG = "#e4dccd";
const FG_DIM = "#888273";
const BG = "#1a1a1a";
const ACCENT = "#a3201d";
// Demo-data watermark — must be readable at Slack/X thumbnail size
// (~600×314 effective). Amber background + dark mono text + all-caps
// makes the chip unmistakable to anyone screenshotting the unfurl.
const WATERMARK_BG = "#ffd166";
const WATERMARK_FG = "#1a1a1a";
const WATERMARK_TEXT = "DEMO DATA — PREVIEW";

// Count of vendor-bearing programs is derived from the registry — adding
// a new vendor-bearing entry to ACTIVE_PROGRAMS auto-flows through here.
const VENDOR_BEARING_COUNT = VENDOR_BEARING_PROGRAMS.length;

const VERDICT_COLORS = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#ef4444",
  gray: "#6b7280",
} as const;

// Same shape-validation posture as the DRAGNET OG route — slug is
// untrusted user input. We allowlist via lookupVendor, but defence in
// depth caps slug length up front.
const MAX_SLUG_LENGTH = 32;

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
        fontSize: 22,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "8px 14px",
        borderRadius: 4,
      }}
    >
      {WATERMARK_TEXT}
    </div>
  );
}

function renderPlaceholder(): Response {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: BG,
          color: FG_DIM,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
          fontSize: 36,
          letterSpacing: "0.08em",
        }}
      >
        <WatermarkChip />
        <span>Pluck Bureau · Vendor Honesty Index</span>
      </div>
    ),
    { ...size },
  );
}

export default async function Image({ params }: OgProps): Promise<Response> {
  const { slug } = await params;

  if (slug.length === 0 || slug.length > MAX_SLUG_LENGTH) {
    return renderPlaceholder();
  }
  const vendor = lookupVendor(slug);

  if (vendor === null) {
    return renderPlaceholder();
  }
  const preview = getVendorPreview(vendor.slug);
  const total = preview?.totalReceipts ?? 0;
  const breakdown = preview?.verdictBreakdown ?? {
    green: 0,
    amber: 0,
    red: 0,
    gray: 0,
  };
  const max = Math.max(1, breakdown.green, breakdown.amber, breakdown.red);
  const greenW = (breakdown.green / max) * 600;
  const amberW = (breakdown.amber / max) * 600;
  const redW = (breakdown.red / max) * 600;

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
          padding: "60px 80px",
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
            fontSize: 24,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ color: ACCENT }}>●</span>
            <span style={{ marginLeft: 16 }}>
              Pluck Bureau · Vendor Honesty Index
            </span>
          </div>
          <WatermarkChip />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            marginTop: 12,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.05,
              color: FG,
            }}
          >
            {vendor.displayName}
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 28,
              color: FG_DIM,
              letterSpacing: "0.04em",
            }}
          >
            Pluck honesty profile · /vendor/{vendor.slug}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 36,
            }}
          >
            <BarRow
              label="green"
              count={breakdown.green}
              width={greenW}
              color={VERDICT_COLORS.green}
            />
            <BarRow
              label="amber"
              count={breakdown.amber}
              width={amberW}
              color={VERDICT_COLORS.amber}
            />
            <BarRow
              label="red"
              count={breakdown.red}
              width={redW}
              color={VERDICT_COLORS.red}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: FG_DIM,
            fontSize: 20,
          }}
        >
          <span>
            {total} total receipts · across {VENDOR_BEARING_COUNT} Bureau programs
          </span>
          <span style={{ letterSpacing: "0.08em" }}>studio.pluck.run</span>
        </div>
      </div>
    ),
    { ...size },
  );
}

function BarRow({
  label,
  count,
  width,
  color,
}: {
  label: string;
  count: number;
  width: number;
  color: string;
}): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span
        style={{
          width: 90,
          fontSize: 20,
          color: FG_DIM,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          width: Math.max(8, width),
          height: 28,
          background: color,
          borderRadius: 3,
          display: "block",
        }}
      />
      <span
        style={{
          fontSize: 22,
          color: FG,
          fontWeight: 700,
          marginLeft: 8,
        }}
      >
        {count}
      </span>
    </div>
  );
}
