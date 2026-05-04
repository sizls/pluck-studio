// ---------------------------------------------------------------------------
// CalendarStrip — render the next N fires of a cron expression as pills
// ---------------------------------------------------------------------------
//
// Three empty states (operators must be able to tell them apart):
//   1. cron is null/empty           → "(no schedule)"
//   2. cron is provided but invalid → "(invalid schedule)"
//   3. cron is valid but no fires   → "(pattern too sparse — no fires
//      within 5 years)" — only reachable if the walker exhausts its
//      iteration ceiling (effectively pathological input).
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { nextNRuns } from "../../lib/cron/next-runs";
import { validateCron } from "../../lib/cron/validate";

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
  const trimmed = typeof cron === "string" ? cron.trim() : "";
  const hasInput = trimmed.length > 0;
  const isValid = hasInput && validateCron(trimmed);
  const fires = isValid ? nextNRuns(trimmed, count, from) : [];
  const headingText = heading ?? `Next ${fires.length || count} fires (UTC)`;

  let emptyCopy: string | null = null;
  if (!hasInput) {
    emptyCopy = "(no schedule)";
  } else if (!isValid) {
    emptyCopy = "(invalid schedule)";
  } else if (fires.length === 0) {
    emptyCopy = "(pattern too sparse — no fires within 5 years)";
  }

  return (
    <div data-testid="calendar-strip">
      <p style={HEAD}>{headingText}</p>
      {emptyCopy !== null ? (
        <p style={MUTED} data-testid="calendar-empty">
          {emptyCopy}
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
            <p style={MUTED}>
              (only {fires.length} fire{fires.length === 1 ? "" : "s"} within
              the 5-year horizon)
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
