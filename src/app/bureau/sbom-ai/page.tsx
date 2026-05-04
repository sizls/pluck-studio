// ---------------------------------------------------------------------------
// Bureau / SBOM-AI – program landing page
// ---------------------------------------------------------------------------
//
// Phase 1.5 alpha. Renders the SBOM-AI charter + a search box for
// `pluck.run/bureau/sbom-ai/<sha256>`. Phase 2+ wires the Kite Event
// Log so the search resolves against ingested entries; Phase 1.5 just
// renders the charter.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "SBOM-AI — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function SbomAiIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">SBOM-AI</h1>
        <p className="bureau-hero-tagline">
          Sigstore-anchored AI supply-chain registry. Every probe-pack,
          every model card, every MCP-server release publishes an
          in-toto attestation to Rekor. Consumers verify provenance
          before running anything.
        </p>
        <p style={{ marginTop: 16 }}>
          <a
            href="/bureau/sbom-ai/run"
            data-testid="run-cta"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontFamily: "var(--bureau-mono)",
              fontSize: 14,
              background: "var(--bureau-fg)",
              color: "var(--bureau-bg)",
              textDecoration: "none",
              borderRadius: 4,
            }}
          >
            Publish provenance →
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Why SBOM-AI ships before NUCLEI</h2>
        <p>
          NUCLEI's community probe-pack ecosystem opens once SBOM-AI is
          operational. Without a public supply-chain ledger, the first
          poisoned community pack would compromise every DRAGNET
          consumer downstream. Phase 1.5 lands SBOM-AI + ROTATE
          together — these are the existential foundations.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Three artifact kinds</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>probe-pack</strong> — every signed
            <code> @sizls/pluck-bureau-core ProbePack</code> body. The
            packHash IS the artifact digest.
          </li>
          <li>
            <strong>model-card</strong> — Hugging Face / OpenAI ModelCard
            JSON, canonical-JSON-hashed.
          </li>
          <li>
            <strong>mcp-server</strong> — MCP server release tarball
            (sha256 of raw bytes — interoperable with{" "}
            <code>cosign sign-blob</code>).
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Lookup an artifact</h2>
        <p>
          Phase 1.5 ships local-only. Phase 2 wires the Kite Event Log
          so this search resolves against ingested entries. For now,
          paste a sha256 to see the URL pattern:
        </p>
        <pre>
          <code>
            studio.pluck.run/bureau/sbom-ai/&lt;sha256&gt;
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            {`# publish
pluck bureau sbom-ai publish probe-pack ./pack.json --keys ./keys --accept-public

# verify
pluck bureau sbom-ai verify <rekor-uuid>

# lookup (Phase 1.5 — Phase 2+ wires Kite)
pluck bureau sbom-ai lookup <sha256> --seed <uuid>`}
          </code>
        </pre>
      </section>
    </>
  );
}
