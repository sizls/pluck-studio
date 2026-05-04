import type { ReactNode } from "react";

import { SbomAiRunForm } from "./RunForm";

export const metadata = {
  title: "Publish provenance — SBOM-AI — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function SbomAiRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Publish provenance</h1>
        <p className="bureau-hero-tagline">
          Hand a probe-pack, model card, or MCP server tarball URL to
          Studio. We fetch (HTTPS-only, ≤ 256 KiB, 10s, no redirects),
          hash per the artifact kind's canonical wire format, sign an
          in-toto attestation, and anchor it to Sigstore Rekor.
          Consumers verify provenance before running anything.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Publish parameters</h2>
        <SbomAiRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the publish to the SBOM-AI runner. Today
            this is a stub — fetch + canonical-hash + sign + anchor
            wire up when <code>pluck-api /v1/sbom-ai/publish</code>{" "}
            ships.
          </li>
          <li>
            You're redirected to the receipt page, then forward to{" "}
            <code>/bureau/sbom-ai/&lt;sha256&gt;</code> once the
            artifact's canonical digest is known.
          </li>
          <li>
            On <code>published</code>: green dot + Rekor entry +
            kind-specific predicate URI. On any failure
            (<code>hash-mismatch</code>, <code>kind-mismatch</code>,
            …): red dot + reason.
          </li>
        </ol>
      </section>
    </>
  );
}
