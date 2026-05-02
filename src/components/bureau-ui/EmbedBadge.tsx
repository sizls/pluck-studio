// ---------------------------------------------------------------------------
// Pluck Bureau UI – EmbedBadge
// ---------------------------------------------------------------------------
//
// Vendors with a clean DRAGNET timeline can embed a green badge. The
// badge is itself a public-good signal – when the timeline goes red,
// the embedded badge automatically flips. Vendors who refuse the
// embed look like they have something to hide. Asymmetric pressure.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export interface EmbedBadgeProps {
  vendor: string;
  model: string;
  tone: "green" | "red" | "black" | "unknown";
  /** SSR root for the public bureau (defaults to studio.pluck.run). */
  origin?: string;
  /** Optional last-checked timestamp (ISO 8601). */
  lastChecked?: string;
  /** Optional className wrapper for additional styling. */
  className?: string;
}

const COPY: Record<EmbedBadgeProps["tone"], string> = {
  green: "Clean ✓",
  red: "Falsification",
  black: "Quorum split",
  unknown: "Not monitored",
};

export function EmbedBadge({
  vendor,
  model,
  tone,
  origin = "https://studio.pluck.run",
  lastChecked,
  className,
}: EmbedBadgeProps): ReactNode {
  const href = `${origin}/dragnet/${encodeURIComponent(vendor)}/${encodeURIComponent(model)}`;
  const label = `${vendor}/${model} — ${COPY[tone]}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={
        className
          ? `bureau-embed-badge bureau-tone-${tone} ${className}`
          : `bureau-embed-badge bureau-tone-${tone}`
      }
      aria-label={label}
      title={lastChecked ? `${label} • last checked ${lastChecked}` : label}
    >
      <span className="bureau-embed-badge-prefix">Pluck Bureau</span>
      <span className="bureau-embed-badge-divider">|</span>
      <span className="bureau-embed-badge-target">
        {vendor}/{model}
      </span>
      <span className="bureau-embed-badge-tone">{COPY[tone]}</span>
    </a>
  );
}
