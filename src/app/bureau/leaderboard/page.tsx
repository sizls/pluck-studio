import { VendorLeaderboard } from "@/components/bureau-ui";
import type { LeaderboardEntry } from "@/components/bureau-ui";
import type { ReactNode } from "react";

export const metadata = {
  title: "Vendor Leaderboard — Pluck Bureau",
};

// Phase 0 placeholder – Phase 7+ Kite Event Log replaces this with
// live entries derived via `computeVendorReputation` over the public
// Rekor log. Real numbers are byte-stable across machines because
// reputation is a pure projection over already-Rekored predicates.
const PLACEHOLDER_ENTRIES: LeaderboardEntry[] = [];

export default function LeaderboardPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Vendor Leaderboard</h1>
        <p className="bureau-hero-tagline">
          Public ranking by Pluck Bureau reputation — auto-decaying
          trust score derived from green / red / black dots, OATH
          honored / broken windows, and key compromise events. Anyone
          can re-derive the number with{" "}
          <code>pluck bureau reputation &lt;vendor&gt;</code>. Updated
          hourly once the Kite Event Log goes live.
        </p>
      </section>
      <VendorLeaderboard entries={PLACEHOLDER_ENTRIES} program="all" />
    </>
  );
}
