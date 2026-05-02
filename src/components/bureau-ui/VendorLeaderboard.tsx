// ---------------------------------------------------------------------------
// Pluck Bureau UI – VendorLeaderboard
// ---------------------------------------------------------------------------
//
// Public-good ranking of vendors by their bureau honesty score.
// Distribution mechanic: every share-link is a Pluck Bureau ad, every
// red entry pressures the vendor publicly.
// ---------------------------------------------------------------------------

import type { BureauProgramId } from "@sizls/pluck-bureau-core";
import type { ReactNode } from "react";

export interface LeaderboardEntry {
  vendor: string;
  model: string;
  /** Honesty score [0..1] derived from green/red ratio, recency, quorum. */
  score: number;
  greenCount: number;
  redCount: number;
  blackCount: number;
  /** Most recent dot timestamp (ISO 8601). */
  lastDotAt?: string;
  /** Optional pinned program for filtering display. */
  program?: BureauProgramId;
}

export interface VendorLeaderboardProps {
  entries: LeaderboardEntry[];
  /** Optional program filter heading. */
  program?: BureauProgramId | "all";
}

export function VendorLeaderboard({
  entries,
  program = "all",
}: VendorLeaderboardProps): ReactNode {
  const filtered = entries
    .filter((e) => program === "all" || e.program === program)
    .slice()
    .sort((a, b) => b.score - a.score);

  return (
    <table className="bureau-leaderboard">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Vendor / Model</th>
          <th scope="col">Score</th>
          <th scope="col">
            <span className="bureau-tone-green">●</span>
          </th>
          <th scope="col">
            <span className="bureau-tone-red">●</span>
          </th>
          <th scope="col">
            <span className="bureau-tone-black">◆</span>
          </th>
          <th scope="col">Last Dot</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map((entry, idx) => {
          const tone =
            entry.score >= 0.9
              ? "green"
              : entry.score >= 0.6
                ? "yellow"
                : "red";

          return (
            <tr
              key={`${entry.vendor}/${entry.model}`}
              className={`bureau-leaderboard-row bureau-tone-${tone}`}
            >
              <td>{idx + 1}</td>
              <td>
                <a
                  href={`/bureau/dragnet/${encodeURIComponent(entry.vendor)}/${encodeURIComponent(entry.model)}`}
                >
                  {entry.vendor}/{entry.model}
                </a>
              </td>
              <td>{(entry.score * 100).toFixed(1)}</td>
              <td>{entry.greenCount}</td>
              <td>{entry.redCount}</td>
              <td>{entry.blackCount}</td>
              <td>{entry.lastDotAt ?? "—"}</td>
            </tr>
          );
        })}
        {filtered.length === 0 && (
          <tr>
            <td colSpan={7} className="bureau-leaderboard-empty">
              No vendors on the leaderboard yet.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
