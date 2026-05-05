// ---------------------------------------------------------------------------
// Pluck Bureau UI – VerdictBadge
// ---------------------------------------------------------------------------
//
// Shared visual primitive for trust-tier distinctions. R1 surfaced the
// load-bearing 'published-ingested-only' (NUCLEI) and 're-witnessed'
// (MOLE) verdicts as colored callouts on individual receipts; this
// component lifts them into a system-wide pill that every surface
// (search results, vendor rows, RSS / OG copy) can reuse.
//
// Server component — no client JS, deterministic SSR output. The badge
// SUPPLEMENTS the verdict-color dot for tiers that need extra nuance;
// programs with simple green/red verdicts keep the bare dot.
//
// Bureau aesthetic: muted HSL-derived backgrounds, bureau-mono font,
// no emoji (unicode glyphs only).
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

export type VerdictBadgeVariant =
  | "verified"
  | "registry-fenced"
  | "re-witnessed"
  | "expired"
  | "failed"
  | "pending";

export type VerdictBadgeSize = "sm" | "md";

export interface VerdictBadgeProps {
  readonly variant: VerdictBadgeVariant;
  readonly size?: VerdictBadgeSize;
  /** Optional title/aria-label override; defaults to the variant's label. */
  readonly title?: string;
}

interface VariantSpec {
  readonly label: string;
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  /** Optional unicode glyph rendered before the label. */
  readonly glyph?: string;
}

// Muted HSL palette — saturation 38%, lightness 42% on the foreground;
// background is the same hue at 12% alpha so the pill blends with the
// bureau dark surface without screaming for attention.
const VARIANT_SPECS: Readonly<Record<VerdictBadgeVariant, VariantSpec>> =
  Object.freeze({
    verified: {
      label: "Verified",
      bg: "hsla(140, 38%, 42%, 0.16)",
      fg: "hsl(140, 38%, 62%)",
      border: "hsla(140, 38%, 42%, 0.55)",
      glyph: "✓", // ✓
    },
    "registry-fenced": {
      label: "Registry-fenced",
      bg: "hsla(40, 38%, 42%, 0.16)",
      fg: "hsl(40, 50%, 62%)",
      border: "hsla(40, 38%, 42%, 0.55)",
      glyph: "⚠", // ⚠
    },
    "re-witnessed": {
      label: "Re-witnessed",
      bg: "hsla(140, 38%, 42%, 0.16)",
      fg: "hsl(140, 38%, 62%)",
      border: "hsla(140, 38%, 42%, 0.55)",
      glyph: "↻", // ↻
    },
    expired: {
      label: "Expired",
      bg: "hsla(40, 38%, 42%, 0.16)",
      fg: "hsl(40, 50%, 62%)",
      border: "hsla(40, 38%, 42%, 0.55)",
      glyph: "⦵", // ⦵ (slashed circle — quiet "stale")
    },
    failed: {
      label: "Failed",
      bg: "hsla(0, 38%, 42%, 0.16)",
      fg: "hsl(0, 50%, 65%)",
      border: "hsla(0, 38%, 42%, 0.55)",
      glyph: "✕", // ✕
    },
    pending: {
      label: "Pending",
      bg: "hsla(0, 0%, 42%, 0.16)",
      fg: "hsl(0, 0%, 70%)",
      border: "hsla(0, 0%, 42%, 0.55)",
      glyph: "…", // …
    },
  });

interface SizeSpec {
  readonly height: number;
  readonly fontSize: number;
  readonly paddingX: number;
  readonly gap: number;
}

const SIZE_SPECS: Readonly<Record<VerdictBadgeSize, SizeSpec>> = Object.freeze({
  sm: { height: 20, fontSize: 11, paddingX: 8, gap: 4 },
  md: { height: 28, fontSize: 12, paddingX: 12, gap: 6 },
});

export function VerdictBadge({
  variant,
  size = "md",
  title,
}: VerdictBadgeProps): ReactNode {
  const spec = VARIANT_SPECS[variant];
  const sz = SIZE_SPECS[size];

  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: sz.gap,
    height: sz.height,
    padding: `0 ${sz.paddingX}px`,
    fontFamily: "var(--bureau-mono)",
    fontSize: sz.fontSize,
    fontWeight: 600,
    letterSpacing: "0.04em",
    lineHeight: 1,
    background: spec.bg,
    color: spec.fg,
    border: `1px solid ${spec.border}`,
    borderRadius: sz.height / 2,
    whiteSpace: "nowrap",
    verticalAlign: "middle",
  };

  return (
    <span
      style={style}
      data-testid="verdict-badge"
      data-variant={variant}
      data-size={size}
      title={title ?? spec.label}
      aria-label={title ?? spec.label}
    >
      {spec.glyph ? (
        <span aria-hidden="true" style={{ fontSize: sz.fontSize }}>
          {spec.glyph}
        </span>
      ) : null}
      <span>{spec.label}</span>
    </span>
  );
}

/** Variant labels exported for tests + docs. */
export function verdictBadgeLabel(variant: VerdictBadgeVariant): string {
  return VARIANT_SPECS[variant].label;
}
