import type { ReactNode } from "react";

import { NucleiRunForm } from "./RunForm";

export const metadata = {
  title: "Publish to NUCLEI registry — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function NucleiRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Publish to the NUCLEI registry</h1>
        <p className="bureau-hero-tagline">
          Wraps a probe-pack you've already published to SBOM-AI in a
          signed <code>NucleiPackEntry/v1</code> and registers it for
          DRAGNET subscribers. Trust model is TOFU — every entry MUST
          cross-reference an SBOM-AI Rekor uuid; without it, the
          entry lands at <code>trustTier: "ingested"</code> and
          consumers refuse to honor it.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Registry parameters</h2>
        <NucleiRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Two-step publish</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Publish the probe-pack body to SBOM-AI first via{" "}
            <a href="/bureau/sbom-ai/run">/bureau/sbom-ai/run</a> →
            note the Rekor UUID on that receipt.
          </li>
          <li>
            Paste that UUID into the SBOM-AI Rekor UUID field above —
            this is the load-bearing trust hook.
          </li>
          <li>
            On <code>published</code>: green dot if{" "}
            <code>trustTier=verified</code>, amber if{" "}
            <code>trustTier=ingested</code> (consumers refuse).
          </li>
        </ol>
      </section>
    </>
  );
}
