// ---------------------------------------------------------------------------
// Bureau / NUCLEI – global leaderboard
// ---------------------------------------------------------------------------
//
// Phase 3 alpha – static placeholder until the Kite Event Log feeds
// hydrate the scoreboard. Renders the ranking convention + tie-break
// rules so authors know what counts.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "NUCLEI Leaderboard — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function NucleiLeaderboardPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">NUCLEI Leaderboard</h1>
        <p className="bureau-hero-tagline">
          Pack-author ranking. First-to-red-dot count primary; total
          verified red dots tie-break; deterministic on every render.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Ranking</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            <strong>First-to-red-dot count</strong> (desc) — distinct
            (vendor, model, claim) triples where this author's pack was the
            EARLIEST emitter against a vendor's signed claim.
          </li>
          <li>
            <strong>Total verified red dots</strong> (desc) — broader signal-
            to-noise.
          </li>
          <li>
            <strong>Packs published</strong> (desc).
          </li>
          <li>
            <strong>Last activity</strong> (desc) — recent first.
          </li>
          <li>
            <strong>Author fingerprint</strong> (asc) — deterministic
            tie-break across two independent renders of the same snapshot.
          </li>
        </ol>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verified-only</h2>
        <p>
          Only verified red dots count. A red dot is "verified" when its
          underlying probe-pack landed in the SBOM-AI registry with{" "}
          <code>trustTier: &quot;verified&quot;</code> (signer was on a
          trust roster) AND the dossier dot itself was witnessed by a
          quorum at or above the bureau-default threshold. Ingested-only
          dots do not count toward leaderboard standing.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Hydration</h2>
        <p>
          Phase 3 alpha — pull a snapshot from the bureau{" "}
          <code>pluck bureau nuclei leaderboard --input counts.json</code>.
          Phase 3+ wires Kite Event Log so this page hydrates from the
          public ledger.
        </p>
      </section>
    </>
  );
}
