// ---------------------------------------------------------------------------
// Bureau / DRAGNET – program landing page
// ---------------------------------------------------------------------------
//
// Phase 1 alpha. Renders a static description of DRAGNET, a sample
// probe-pack download link (placeholder until NUCLEI ships), and the
// list of monitored vendors. Per-vendor timelines live at
// /bureau/dragnet/[vendor]/[model].
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "DRAGNET — Pluck Bureau",
};

const MONITORED: ReadonlyArray<{ vendor: string; model: string }> = [
  { vendor: "openai", model: "gpt-4o" },
  { vendor: "anthropic", model: "claude-3-5-sonnet" },
  { vendor: "google", model: "gemini-1.5-pro" },
  { vendor: "meta", model: "llama-3.1-70b" },
];

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function DragnetIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">DRAGNET</h1>
        <p className="bureau-hero-tagline">
          Continuous AI-vendor honesty monitor. A signed probe-pack runs
          against the target every <code>--interval</code>, every cassette
          is Sigstore-anchored to Rekor, every contradiction lands as a
          public red dot. Operate it on your own vendors, watch others
          operate it on theirs.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>How DRAGNET works</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Author a probe-pack — list of probes the runner replays against
            the vendor on every cycle.
          </li>
          <li>
            <code>pluck bureau dragnet pack-sign</code> signs it with your
            Ed25519 operator key.
          </li>
          <li>
            <code>pluck bureau dragnet run</code> hunts the target.
            Every probe → cassette → in-toto attestation → Rekor entry.
          </li>
          <li>
            Each cycle classifies the response (contradict / mirror /
            shadow / snare / pack matchers) and emits a TimelineDot into
            the per-target dossier.
          </li>
          <li>
            Red dots auto-broadcast to the @pluckbureau social bot, RSS
            feeds, and the public leaderboard.
          </li>
        </ol>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Monitored vendors</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {MONITORED.map((m) => (
            <li key={`${m.vendor}/${m.model}`}>
              <a href={`/bureau/dragnet/${m.vendor}/${m.model}`}>
                {m.vendor}/{m.model}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Sample probe-pack</h2>
        <p>
          The <code>canon-honesty</code> probe-pack ships with the
          DRAGNET CLI:
        </p>
        <pre>
          <code>
            pluck bureau dragnet pack-init ./packs/canon --name canon-honesty-v0.1
          </code>
        </pre>
        <p>
          NUCLEI (Phase 3) will host the public registry of community-
          authored packs.
        </p>
      </section>
    </>
  );
}
