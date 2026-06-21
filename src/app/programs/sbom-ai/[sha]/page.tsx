// ---------------------------------------------------------------------------
// Pluck / SBOM-AI / [sha] – per-artifact lookup page
// ---------------------------------------------------------------------------
//
// Phase 1.5 alpha – placeholder. Renders the artifact digest +
// "no entries observed yet" copy. Phase 2 wires the Kite Event Log
// so the lookup resolves against ingested entries.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { notFound } from "next/navigation";

export const metadata = {
  title: "SBOM-AI artifact — Pluck",
};

const SHA256_HEX = /^[0-9a-f]{64}$/;

const SectionHeadingStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default async function SbomAiArtifactPage({
  params,
}: {
  params: Promise<{ sha: string }>;
}): Promise<ReactNode> {
  const { sha } = await params;
  const normalized = sha.toLowerCase();
  if (!SHA256_HEX.test(normalized)) {
    notFound();
  }

  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title" style={{ fontFamily: "var(--studio-mono)", fontSize: 18 }}>
          {normalized}
        </h1>
        <p className="studio-hero-tagline">
          Supply-chain attestations for this artifact digest.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Status</h2>
        <p>
          <em>No SbomEntry/v1 attestations observed yet.</em>
        </p>
        <p>
          Today's release ships the SBOM-AI charter, sign, and verify
          primitives. The public Studio app reads from a local
          registry only — a future cut wires the Kite Event Log so
          any entry posted to <code>rekor.sigstore.dev</code> with
          predicate type{" "}
          <code>https://pluck.run/SbomEntry/v1</code> and matching
          digest appears here within minutes.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verify locally</h2>
        <pre>
          <code>
            pluck sbom-ai verify &lt;rekor-uuid&gt;
          </code>
        </pre>
        <p>
          Cross-check the Rekor uuid you suspect attests this artifact.
          Verification gates: predicate type, schemaVersion=1, signer
          fingerprint match, bounded metadata, strict ISO 8601 publish
          time, Ed25519 signature.
        </p>
      </section>
    </>
  );
}
