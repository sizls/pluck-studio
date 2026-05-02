// ---------------------------------------------------------------------------
// Pluck Bureau UI – ReputationBadge
// ---------------------------------------------------------------------------
//
// Innovation game-changer #2 surface – embeddable vendor reputation
// badge. Renders a self-contained 320×40 SVG: vendor name, optional
// model, score color-coded (green ≥ 80, yellow ≥ 60, red < 60), tiny
// "via Pluck Bureau" footer.
//
// Embed via the public Studio image URL:
//
//   <img src="https://studio.pluck.run/api/reputation/<vendor>.svg">
//
// (the API route is a Phase 7+ stub – for now the badge is rendered
// inline in the Studio /bureau/reputation/[vendor] route).
//
// All operator-controlled strings are escape-rendered into the SVG –
// no `dangerouslySetInnerHTML` and no attacker-controlled bytes can
// break the SVG envelope.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export interface ReputationBadgeProps {
  vendor: string;
  /** Optional – when set, the badge shows "vendor / model". */
  model?: string;
  /** 0..100. Out-of-range coerced to nearest bound. */
  score: number;
  /** SSR origin for the badge link target. Default: studio.pluck.run. */
  origin?: string;
}

const WIDTH = 320;
const HEIGHT = 40;

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }

  return Math.round(value * 10) / 10;
}

function pickFill(score: number): string {
  if (score >= 80) {
    return "#1f7a3a"; // green
  }
  if (score >= 60) {
    return "#a78a1f"; // yellow
  }

  return "#a3201d"; // red
}

function sanitiseId(value: string): string {
  // Match the Bureau vendor regex but applied for display – strip
  // controls, cap at 80 chars (badge has limited horizontal space),
  // never echo bytes that would break SVG parsing.
  // eslint-disable-next-line no-control-regex
  const cleaned = (value || "").replace(/[\x00-\x1f\x7f-\x9f]/g, "");

  return cleaned.slice(0, 80);
}

/**
 * Component form. The Studio /bureau/reputation/[vendor] route uses
 * this to render the badge inline. Same component renders identically
 * server-side so an `<img src="...badge.svg">` API stub can serialise
 * the output via React-DOM/server.
 */
export function ReputationBadge({
  vendor,
  model,
  score,
  origin = "https://studio.pluck.run",
}: ReputationBadgeProps): ReactNode {
  const safeVendor = sanitiseId(vendor);
  const safeModel = model !== undefined ? sanitiseId(model) : undefined;
  const value = clampScore(score);
  const fill = pickFill(value);
  const target = safeModel ? `${safeVendor} / ${safeModel}` : safeVendor;
  const href = `${origin}/bureau/reputation/${encodeURIComponent(safeVendor)}`;
  const label = `${target} reputation: ${value.toFixed(1)} / 100`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="bureau-reputation-badge-link"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={WIDTH}
        height={HEIGHT}
        role="img"
        aria-label={label}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <title>{label}</title>
        <rect width={WIDTH} height={HEIGHT} rx={4} fill="#1a1a1a" />
        <rect x={WIDTH - 80} width={80} height={HEIGHT} rx={4} fill={fill} />
        <g
          fill="#fff"
          fontFamily="DejaVu Sans, Verdana, Geneva, sans-serif"
          fontSize={12}
        >
          <text x={12} y={16}>
            Pluck Bureau
          </text>
          <text x={12} y={32} fontSize={14} fontWeight="bold">
            {target}
          </text>
          <text
            x={WIDTH - 40}
            y={20}
            fontSize={16}
            fontWeight="bold"
            textAnchor="middle"
          >
            {value.toFixed(0)}
          </text>
          <text
            x={WIDTH - 40}
            y={32}
            fontSize={9}
            textAnchor="middle"
            opacity={0.85}
          >
            / 100
          </text>
        </g>
      </svg>
    </a>
  );
}

/**
 * Pure-string SVG renderer for cases where the consumer needs the SVG
 * bytes (e.g. the Phase 7+ API route at
 * `/api/reputation/<vendor>.svg`). React-DOM/server is overkill for
 * a 320×40 badge – this concatenates the same shape the component
 * renders, with the same input validation.
 */
export function renderReputationBadgeSvg(props: ReputationBadgeProps): string {
  const safeVendor = sanitiseId(props.vendor);
  const safeModel = props.model !== undefined ? sanitiseId(props.model) : undefined;
  const value = clampScore(props.score);
  const fill = pickFill(value);
  const target = safeModel ? `${safeVendor} / ${safeModel}` : safeVendor;
  const label = `${target} reputation: ${value.toFixed(1)} / 100`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="${escAttr(label)}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<title>${escText(label)}</title>`,
    `<rect width="${WIDTH}" height="${HEIGHT}" rx="4" fill="#1a1a1a"/>`,
    `<rect x="${WIDTH - 80}" width="80" height="${HEIGHT}" rx="4" fill="${fill}"/>`,
    `<g fill="#fff" font-family="DejaVu Sans, Verdana, Geneva, sans-serif" font-size="12">`,
    `<text x="12" y="16">Pluck Bureau</text>`,
    `<text x="12" y="32" font-size="14" font-weight="bold">${escText(target)}</text>`,
    `<text x="${WIDTH - 40}" y="20" font-size="16" font-weight="bold" text-anchor="middle">${value.toFixed(0)}</text>`,
    `<text x="${WIDTH - 40}" y="32" font-size="9" text-anchor="middle" opacity="0.85">/ 100</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
}

function escAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
