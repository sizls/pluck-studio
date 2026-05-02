// ---------------------------------------------------------------------------
// Bureau / RAVEN – per-sweep view (placeholder)
// ---------------------------------------------------------------------------
//
// Phase 7 alpha placeholder. Once the SSR app is wired to ingest real
// RAVEN sweep cassettes (Phase 7.5+), this page will render:
//
//   - sweep metadata (geohash, band, window, quorum)
//   - tile grid (geohash × band × time) with Welch-PSD heatmap
//   - merkle inclusion path
//   - downstream Kite Event Log entries citing this sweep
//
// For alpha, we surface the path parameters as a "this is what would
// be rendered" diagnostic so operators can sanity-check link routing.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "RAVEN sweep — Pluck Bureau",
};

interface PageProps {
  params: Promise<{ sweepId: string }>;
}

export default async function RavenSweepPage({ params }: PageProps): Promise<ReactNode> {
  const { sweepId } = await params;

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Sweep {sweepId.slice(0, 8)}…</h1>
        <p className="bureau-hero-tagline">
          Phase 7 alpha placeholder. Per-sweep timeline + tile grid +
          Kite Event Log integration land in Phase 7.5.
        </p>
      </section>

      <section>
        <p>
          Sweep id (full): <code>{sweepId}</code>
        </p>
        <p>
          For now, fetch the cassette from your local{" "}
          <code>--out</code> directory or query Rekor by{" "}
          <code>logIndex</code>:
        </p>
        <pre>
          <code>
            pluck bureau raven verify ./.raven/{sweepId}.sweep.json
          </code>
        </pre>
      </section>
    </>
  );
}
