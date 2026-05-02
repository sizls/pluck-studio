// ---------------------------------------------------------------------------
// Bureau / RAVEN – program landing page
// ---------------------------------------------------------------------------
//
// Phase 7 alpha. Renders a static description of RAVEN, the four
// downstream RF programs that compose its substrate, and a stub
// linking to per-sweep timeline pages (filled in once Phase 7+
// pipelines wire real sweep data into the SSR app).
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "RAVEN — Pluck Bureau",
};

const DOWNSTREAM: ReadonlyArray<{ name: string; lane: string; tagline: string }> = [
  {
    name: "STINGRAY",
    lane: "Cellular",
    tagline:
      "Equivocation proofs for cell towers — two receivers in the same geohash + band reporting different Welch digests means at least one is lying.",
  },
  {
    name: "KARMA",
    lane: "Wi-Fi",
    tagline:
      "Evil-twin AP detection by Welch-distance against a known-good monitor in the same geohash + 2.4/5 GHz band.",
  },
  {
    name: "CELESTE",
    lane: "GNSS",
    tagline:
      "GPS-spoofing detection — operator-declared baseline of expected GNSS bands diffed against current sweeps.",
  },
  {
    name: "COSMOS",
    lane: "LEO satellite",
    tagline:
      "Discontinuity detection across multi-receiver passes; a re-broadcast / relay attack surfaces as a Welch-distance gap.",
  },
];

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function RavenIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">RAVEN</h1>
        <p className="bureau-hero-tagline">
          Passive RF spectrum chain-of-custody. The substrate every Phase 7+
          RF Bureau program rides on. Without it, each wireless program
          reinvents IQ → canonicalization → Merkle → Rekor.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>How RAVEN works</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            An operator captures IQ samples from any SDR (rtl_sdr, HackRF,
            USRP) into a <code>cu8</code> or <code>cf32</code> file.
          </li>
          <li>
            <code>pluck bureau raven sweep</code> runs a deterministic
            32-bin Welch PSD over the IQ buffer per (geohash × time × band)
            tile, signs each tile with the receiver's Ed25519 key, and
            commits the tile-set as a Merkle forest.
          </li>
          <li>
            The substation operator signs the sweep root and posts the
            in-toto Statement under predicate{" "}
            <code>https://pluck.run/Raven.Sweep/v1</code> to the public
            Sigstore Rekor log.
          </li>
          <li>
            Downstream programs (STINGRAY / KARMA / CELESTE / COSMOS) layer
            protocol-specific decoders on top — they share the same Welch
            digest, the same Merkle leaf shape, and the same predicate URI
            namespace.
          </li>
          <li>
            <code>pluck bureau raven anomaly</code> diffs a current sweep
            against a baseline; tiles whose Welch-distance crosses
            threshold land as signed{" "}
            <code>https://pluck.run/Raven.Anomaly/v1</code> markers.
          </li>
        </ol>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Determinism contract</h2>
        <p>
          Same IQ buffer + same sample rate + same window + same segment
          length + same overlap → byte-identical Welch digest. Tests lock
          this. Cross-receiver equivocation proofs are the entire
          substrate value; they are useless if two honest receivers can
          not produce the same digest from the same RF.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Programs riding the substrate</h2>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {DOWNSTREAM.map((d) => (
            <li key={d.name} style={{ marginBottom: 16 }}>
              <strong style={{ fontFamily: "var(--bureau-mono)" }}>
                {d.name}
              </strong>{" "}
              <span style={{ color: "var(--bureau-fg-dim)" }}>· {d.lane}</span>
              <div>{d.tagline}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Quorum compounds the value</h2>
        <p>
          Single-receiver sweeps are tamper-evident records. But all the
          contradiction proofs above require ≥ 2 distinct receivers in the
          same band + time window. RAVEN's <code>quorum</code> field
          (k-of-n) makes that requirement machine-checkable.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Phase 7 alpha vs 7.5</h2>
        <p>
          Alpha ships file-input only (cu8 / cf32 IQ files). Live SDR
          streaming (<code>rtl_tcp</code>, librtlsdr, USRP) defers to
          Phase 7.5 — same JS-layer-first pattern as TRIPWIRE Phase 2.
        </p>
      </section>
    </>
  );
}
