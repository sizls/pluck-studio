"use client";

// ---------------------------------------------------------------------------
// V1RunStatusBanner — surfaces /v1/runs meta-status above a ReceiptView
// ---------------------------------------------------------------------------
//
// Each per-program ReceiptView renders a per-program ReceiptStatus union
// (`cycle-pending`, `dispatched`, `anchored`, …) — that union is the
// program's verdict surface and intentionally does NOT include
// `cancelled`. Cancellation is a META-status: the run never completed,
// so the program's own verdict has nothing to say. We surface it here,
// above the program-specific content, with a muted-but-clear visual
// treatment that's distinct from the green/amber/red verdict colors.
//
// Why a shared component (Option B) instead of inlining state into each
// of the 11 ReceiptViews:
//   - Single source of truth for the cancelled-detection logic. If the
//     v1 record shape evolves (e.g. an `actor` or `reason` field lands
//     on cancel), one file changes instead of eleven.
//   - The viaV1 useEffect in each ReceiptView already probes
//     /api/v1/runs/[id]; we deliberately do NOT share that fetch — the
//     banner ships independently and the cosmetic via-v1 indicator
//     stays where it is. The double-fetch is one cheap GET; the cleaner
//     coupling story is worth it.
//   - One wire-in point (one import + one JSX line) per ReceiptView.
//
// Failure mode is graceful — fetch errors or non-cancelled responses
// render nothing. The banner is additive: omitting it leaves the page
// looking exactly like it did before.
// ---------------------------------------------------------------------------

import { useEffect, useState, type ReactNode } from "react";

interface V1RunStatusBannerProps {
  /** The runId from the route — `params.id` in the receipt page. */
  id: string;
}

interface V1RecordShape {
  status?: unknown;
  updatedAt?: unknown;
}

const BannerStyle = {
  marginTop: 16,
  marginBottom: 16,
  padding: "10px 14px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  // Muted-but-clear treatment: a thin amber-leaning border + a dim text
  // color. Deliberately NOT green/amber/red (those are verdict colors).
  // Cancelled is a meta-status, not a verdict.
  color: "var(--bureau-fg-dim)",
  background: "transparent",
  border: "1px dashed var(--bureau-fg-dim)",
  borderRadius: 4,
};

const TimestampStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  opacity: 0.85,
};

/**
 * Banner that fetches `/api/v1/runs/[id]` and renders a "this run was
 * cancelled at <updatedAt>" notice when the v1 record's status is
 * `cancelled`. Renders nothing for any other status, for fetch failures,
 * or while the fetch is in flight.
 */
export function V1RunStatusBanner({ id }: V1RunStatusBannerProps): ReactNode {
  const [status, setStatus] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/runs/${encodeURIComponent(id)}`, {
      headers: { "content-type": "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((record: V1RecordShape | null) => {
        if (cancelled || record === null) {
          return;
        }
        // Defensive shape-check — the route's GET handler returns a
        // RunRecord but a future swap (Supabase) might tweak fields. We
        // only consume `status` + `updatedAt` and only when both are
        // strings. Any other shape → no banner (graceful degradation).
        const recordStatus =
          typeof record.status === "string" ? record.status : null;
        const recordUpdatedAt =
          typeof record.updatedAt === "string" ? record.updatedAt : null;

        setStatus(recordStatus);
        setUpdatedAt(recordUpdatedAt);
      })
      .catch(() => {
        // Network or 404 — fall back to no-banner. No-op.
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status !== "cancelled") {
    return null;
  }

  return <V1CancelledBannerView updatedAt={updatedAt} />;
}

/**
 * Pure presentation slice — given a status interpretation, render the
 * cancellation banner. Split from the data-fetching shell so the visual
 * surface can be unit-tested without spinning up a DOM. The shell does
 * the conditional return; this view ALWAYS renders the banner element.
 *
 * Exported for tests (and any future caller that already knows the run
 * is cancelled — e.g. a server component that could pre-fetch and skip
 * the client-side round trip).
 */
export function V1CancelledBannerView({
  updatedAt,
}: {
  updatedAt: string | null;
}): ReactNode {
  return (
    <div
      data-testid="v1-cancelled-banner"
      role="status"
      aria-live="polite"
      style={BannerStyle}
    >
      This run was cancelled
      {updatedAt !== null ? (
        <>
          {" at "}
          <time dateTime={updatedAt} style={TimestampStyle}>
            {updatedAt}
          </time>
        </>
      ) : null}
      .
    </div>
  );
}
