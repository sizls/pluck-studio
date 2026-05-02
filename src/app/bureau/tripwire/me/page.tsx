// ---------------------------------------------------------------------------
// Bureau / TRIPWIRE / me – per-machine timeline placeholder
// ---------------------------------------------------------------------------
//
// Phase 2 alpha. Reads no real data – the dossier lives on the
// operator's local disk and never auto-publishes. Phase 1+ wires the
// Kite Event Log so an operator who explicitly opts in can stream
// dossier dots to the bureau backend; for now this page is the
// landing surface that explains the local-only contract + the path
// to read the local dossier.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "TRIPWIRE / me — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function TripwireMePage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">TRIPWIRE / me</h1>
        <p className="bureau-hero-tagline">
          Per-machine outbound LLM timeline. The dossier lives on YOUR
          machine — Pluck Bureau never sees the bodies. This page is a
          placeholder that explains how to read your local dossier;
          Phase 2.5 wires the Kite Event Log so opted-in operators can
          publish their dossier hash here.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Where to find your dossier</h2>
        <pre>
          <code>cat ./.tripwire/me-dossier.json</code>
        </pre>
        <p>
          Replace the path with whatever you passed to{" "}
          <code>pluck bureau tripwire install --out</code>. The
          dossier is a JSON file with a list of <code>TimelineDot</code>{" "}
          entries — each one a single intercepted (request, response)
          pair, classified against your policy.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Inspect a captured cassette</h2>
        <pre>
          <code>
            cosign verify-attestation \
              --key public.pem \
              --type https://pluck.run/AgentRun/v1 \
              ./.tripwire/cassettes/&lt;envelopeHash&gt;.json
          </code>
        </pre>
        <p>
          Same verification surface as DRAGNET — TRIPWIRE cassettes
          follow the in-toto Statement v1 + DSSE wrapping convention
          every Pluck verb-module emits.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What stays local</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>Request bodies — never leave your disk by default.</li>
          <li>Response bodies — never leave your disk by default.</li>
          <li>
            Cassette envelopes — never leave your disk by default.
          </li>
        </ul>
        <p>
          Pass <code>--notarize</code> to publish non-green cassettes
          to the public Sigstore Rekor log. That's the operator's
          opt-in, never the default.
        </p>
      </section>
    </>
  );
}
