// ---------------------------------------------------------------------------
// CalendarStrip — render the next N fires of a cron expression as pills
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { nextNRuns } from "../../lib/cron/next-runs";

export interface CalendarStripProps {
  cron: string | null | undefined;
  count?: number;
  from?: number;
  heading?: string;
}

const HEAD: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 16,
  marginBottom: 8,
};

const STRIP: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 4,
};

const PILL: CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg)",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  whiteSpace: "nowrap",
};

const MUTED: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  fontStyle: "italic",
  marginTop: 4,
};

const FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function CalendarStrip({
  cron,
  count = 7,
  from,
  heading,
}: CalendarStripProps): ReactNode {
  const headingText = heading ?? `Next ${count} fires`;
  const trimmed = typeof cron === "string" ? cron.trim() : "";
  const fires = trimmed.length === 0 ? [] : nextNRuns(trimmed, count, from);

  return (
    <div data-testid="calendar-strip">
      <p style={HEAD}>{headingText}</p>
      {fires.length === 0 ? (
        <p style={MUTED} data-testid="calendar-empty">
          (no schedule)
        </p>
      ) : (
        <>
          <div style={STRIP}>
            {fires.map((d) => (
              <span
                key={d.toISOString()}
                style={PILL}
                data-testid="calendar-pill"
                title={d.toISOString()}
              >
                {FMT.format(d)} UTC
              </span>
            ))}
          </div>
          {fires.length < count ? (
            <p style={MUTED}>(no further fires within 7 days)</p>
          ) : null}
        </>
      )}
    </div>
  );
}
