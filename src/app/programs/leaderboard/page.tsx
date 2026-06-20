import { VendorLeaderboard } from "@/components/programs-ui";
import type { LeaderboardEntry } from "@/components/programs-ui";
import type { ReactNode } from "react";

export const metadata = {
  title: "Vendor Leaderboard — Pluck",
};

// Phase 0 placeholder – Phase 7+ Kite Event Log replaces this with
// live entries derived via `computeVendorReputation` over the public
// Rekor log. Real numbers are byte-stable across machines because
// reputation is a pure projection over already-Rekored predicates.
const PLACEHOLDER_ENTRIES: LeaderboardEntry[] = [];

export default function LeaderboardPage(): ReactNode {
  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title">Vendor Leaderboard</h1>
        <p className="studio-hero-tagline">
          Public ranking by Pluck reputation — auto-decaying
          trust score derived from green / red / black dots, OATH
          honored / broken windows, and key compromise events. Anyone
          can re-derive the number with{" "}
          <code>pluck reputation &lt;vendor&gt;</code>. Updated
          hourly once the Kite Event Log goes live.
        </p>
      </section>
      <VendorLeaderboard entries={PLACEHOLDER_ENTRIES} program="all" />
    </>
  );
}
