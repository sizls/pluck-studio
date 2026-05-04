// ---------------------------------------------------------------------------
// /vendor/_ui — shared atoms for index + profile
// ---------------------------------------------------------------------------
//
// _ui prefix keeps these out of Next's page-routing tree. Both the
// vendor index and the per-vendor profile lean on the same dot strip,
// preview banner, and relative-time formatter — single source so the
// two surfaces never visually drift.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import type { VendorVerdict } from "../../lib/programs/vendor-preview";

export const VENDOR_PAGE_DESCRIPTION =
  "Per-vendor live profile across all 11 Bureau programs. Every receipt that names a vendor enriches that vendor's permanent URL — bookmark it, cite it, watch it.";

export const VERDICT_COLORS: Readonly<Record<VendorVerdict, string>> = {
  green: "#4ade80",
  amber: "#fbbf24",
  red: "#ef4444",
  gray: "#6b7280",
};

const PreviewBannerStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderLeft: "3px solid #fbbf24",
  background: "rgba(251, 191, 36, 0.06)",
  padding: "12px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  margin: "16px 0",
  lineHeight: 1.6,
};

export function PreviewBanner(): ReactNode {
  return (
    <p style={PreviewBannerStyle} data-testid="vendor-preview-banner">
      <strong style={{ color: "#fbbf24" }}>PREVIEW</strong> — these
      profiles render hand-curated demo activity until{" "}
      <code>pluck-api /v1/runs</code> ships. The shape and URLs are
      final; only the receipt source swaps over.
    </p>
  );
}

const DotStripStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 8,
  flexWrap: "wrap",
};

const DotGroupStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
};

interface VerdictBreakdown {
  readonly green: number;
  readonly amber: number;
  readonly red: number;
  readonly gray: number;
}

export function VerdictDots({
  breakdown,
}: {
  breakdown: VerdictBreakdown;
}): ReactNode {
  const groups: Array<[VendorVerdict, number]> = [
    ["green", breakdown.green],
    ["amber", breakdown.amber],
    ["red", breakdown.red],
    ["gray", breakdown.gray],
  ];

  return (
    <div style={DotStripStyle} data-testid="verdict-dots">
      {groups.map(([verdict, count]) => {
        if (count === 0) {
          return null;
        }

        return (
          <span
            key={verdict}
            style={DotGroupStyle}
            data-testid={`verdict-${verdict}`}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: VERDICT_COLORS[verdict],
              }}
            />
            {count}
          </span>
        );
      })}
    </div>
  );
}

const MS_PER_MINUTE = 60 * 1000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Render `then` relative to `now`. Pure-function so server-rendering
 * stays deterministic; both args come from the caller. No "just now" /
 * "in the future" — preview activity is always in the past.
 */
export function formatRelative(then: Date, now: Date): string {
  const delta = Math.max(0, now.getTime() - then.getTime());

  if (delta < MS_PER_HOUR) {
    const mins = Math.max(1, Math.floor(delta / MS_PER_MINUTE));

    return `${mins}m ago`;
  }
  if (delta < MS_PER_DAY) {
    const hours = Math.floor(delta / MS_PER_HOUR);

    return `${hours}h ago`;
  }
  const days = Math.floor(delta / MS_PER_DAY);

  return `${days}d ago`;
}
