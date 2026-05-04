import type { ReactNode } from "react";

import { RekorSearch } from "@/components/bureau-ui";

import { PROGRAM_TILES, type ProgramTile } from "./_data/programs.js";

export const metadata = {
  title: "Pluck Bureau — Sigstore for AI lies",
};

export default function BureauIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Sigstore for AI lies.</h1>
        <p className="bureau-hero-tagline">
          Every AI vendor lies. The Pluck Bureau is the public ledger that
          catches them — and the offensive toolkit that proves it. Eleven
          programs, every observation Ed25519-signed, anchored to Sigstore
          Rekor, and verifiable with{" "}
          <code>cosign verify-attestation</code>.
        </p>
      </section>

      <RekorSearch placeholder="Verify a Rekor uuid or logIndex…" />

      <section>
        <h2
          style={{
            fontFamily: "var(--bureau-mono)",
            fontSize: 14,
            color: "var(--bureau-fg-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 32,
          }}
        >
          Programs
        </h2>
        <div className="bureau-tile-grid">
          {PROGRAM_TILES.map((tile) => (
            <ProgramTileLink key={tile.id} tile={tile} />
          ))}
        </div>
      </section>

      <section data-testid="bureau-studio-surfaces">
        <h2
          style={{
            fontFamily: "var(--bureau-mono)",
            fontSize: 14,
            color: "var(--bureau-fg-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: 48,
          }}
        >
          Studio surfaces
        </h2>
        <p style={{ marginTop: 8, color: "var(--bureau-fg-dim)", fontSize: 13 }}>
          Cross-cutting views over the Bureau program library.
        </p>
        <ul
          style={{
            marginTop: 12,
            padding: 0,
            listStyle: "none",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            fontFamily: "var(--bureau-mono)",
            fontSize: 13,
          }}
        >
          <li>
            <a href="/runs">/runs →</a>{" "}
            <span style={{ color: "var(--bureau-fg-dim)" }}>
              activations directory
            </span>
          </li>
          <li>
            <a href="/vendor">/vendor →</a>{" "}
            <span style={{ color: "var(--bureau-fg-dim)" }}>
              vendor honesty index
            </span>
          </li>
          <li>
            <a href="/monitors">/monitors →</a>{" "}
            <span style={{ color: "var(--bureau-fg-dim)" }}>
              24h pack-fire timeline
            </span>
          </li>
          <li>
            <a href="/what-we-dont-know">/what-we-dont-know →</a>{" "}
            <span style={{ color: "var(--bureau-fg-dim)" }}>
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
    <a href={`/bureau/${tile.id}`} className="bureau-tile">
      <div className="bureau-tile-name">{tile.name}</div>
      <div className="bureau-tile-status">{tile.status}</div>
      <p className="bureau-tile-tagline">{tile.tagline}</p>
    </a>
  );
}
