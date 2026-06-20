import type { ReactNode } from "react";

import { RekorSearch } from "@/components/programs-ui";

import { PROGRAM_TILES, type ProgramTile } from "./_data/programs.js";

export const metadata = {
  title: "Pluck — Sigstore for AI lies",
};

export default function ProgramsIndexPage(): ReactNode {
  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title">Sigstore for AI lies.</h1>
        <p className="studio-hero-tagline">
          Every AI vendor lies. Pluck is the public ledger that catches
          them — and the offensive toolkit that proves it. Fifty-one
          programs, every observation Ed25519-signed, anchored to Sigstore
          Rekor, and verifiable with{" "}
          <code>cosign verify-attestation</code>.
        </p>
      </section>

      <RekorSearch placeholder="Verify a Rekor uuid or logIndex…" />

      <section>
        <h2
          style={{
            fontFamily: "var(--studio-mono)",
            fontSize: 14,
            color: "var(--studio-fg-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 32,
          }}
        >
          Programs
        </h2>
        <div className="studio-tile-grid">
          {PROGRAM_TILES.map((tile) => (
            <ProgramTileLink key={tile.id} tile={tile} />
          ))}
        </div>
      </section>

      <section data-testid="studio-studio-surfaces">
        <h2
          style={{
            fontFamily: "var(--studio-mono)",
            fontSize: 14,
            color: "var(--studio-fg-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 48,
          }}
        >
          Studio surfaces
        </h2>
        <p style={{ marginTop: 8, color: "var(--studio-fg-dim)", fontSize: 13 }}>
          Cross-cutting views over the Pluck program catalog.
        </p>
        <ul
          style={{
            marginTop: 12,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            fontFamily: "var(--studio-mono)",
            fontSize: 13,
          }}
        >
          <li>
            <a href="/runs">/runs →</a>{" "}
            <span style={{ color: "var(--studio-fg-dim)" }}>
              activations directory
            </span>
          </li>
          <li>
            <a href="/vendor">/vendor →</a>{" "}
            <span style={{ color: "var(--studio-fg-dim)" }}>
              vendor honesty index
            </span>
          </li>
          <li>
            <a href="/monitors">/monitors →</a>{" "}
            <span style={{ color: "var(--studio-fg-dim)" }}>
              24h pack-fire timeline
            </span>
          </li>
          <li>
            <a href="/what-we-dont-know">/what-we-dont-know →</a>{" "}
            <span style={{ color: "var(--studio-fg-dim)" }}>
              negative-knowledge disclosure
            </span>
          </li>
        </ul>
      </section>
    </>
  );
}

function ProgramTileLink({ tile }: { tile: ProgramTile }): ReactNode {
  return (
    <a href={`/programs/${tile.id}`} className="studio-tile">
      <div className="studio-tile-name">{tile.name}</div>
      <div className="studio-tile-status">{tile.status}</div>
      <p className="studio-tile-tagline">{tile.tagline}</p>
    </a>
  );
}
