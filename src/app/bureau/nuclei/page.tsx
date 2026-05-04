// ---------------------------------------------------------------------------
// Bureau / NUCLEI – program landing page
// ---------------------------------------------------------------------------
//
// Phase 3 alpha. Renders the NUCLEI charter + a leaderboard preview
// link + the registry concept. Phase 3+ wires Kite Event Log so the
// public registry resolves against ingested entries.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "NUCLEI — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function NucleiIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">NUCLEI</h1>
        <p className="bureau-hero-tagline">
          Signed probe-pack registry — Metasploit / Nuclei templates for the
          AI honesty era. Authors sign + publish probe-packs to Rekor; DRAGNET
          subscribers run them automatically (gated by SBOM-AI provenance);
          leaderboards rank "first probe to red-dot vendor X."
        </p>
        <p style={{ marginTop: 16 }}>
          <a
            href="/bureau/nuclei/run"
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
            Publish to registry →
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What lands on Rekor</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>NucleiPackEntry/v1</strong> — the registry envelope
            wrapping a signed{" "}
            <code>@sizls/pluck-bureau-core ProbePack</code> with NUCLEI
            metadata (vendor scope, tags, recommended interval, license).
            ALWAYS rides on top of an SBOM-AI <code>SbomEntry/v1</code>
            cross-reference.
          </li>
          <li>
            <strong>BountyOffer/v1</strong> — sponsor stakes payout for
            "first probe to red-dot <code>vendor/model</code> against a
            specific signed claim." Quorum threshold expressed N-of-M.
          </li>
          <li>
            <strong>BountyClaim/v1</strong> — claimant points at a Rekor uuid
            for a red dot AND a Rekor uuid for a quorum vote that satisfies
            the offer's threshold. Adjudication is off-platform; Pluck
            records the cryptographic chain.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Trust model — registry ingest is TOFU</h2>
        <p>
          NUCLEI is a registry, not an oracle. Consumers MUST verify
          <code> sbomRekorUuid</code> against the SBOM-AI registry's
          <code> findByDigestVerifiedOnly()</code> before treating any pack
          as authoritative. Without an authoritative SBOM-AI cross-reference
          a pack lands at <code>trustTier: &quot;ingested&quot;</code> and
          downstream verifiers MUST refuse to honor it.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Browse the registry</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <a href="/bureau/nuclei/leaderboard">Leaderboard</a> — top
            authors by first-to-red-dot count + total verified red dots.
          </li>
          <li>
            <code>studio.pluck.run/bureau/nuclei/&lt;author&gt;/&lt;pack&gt;</code>
            {" "}— per-pack page (alpha).
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            {`# scaffold a pack stub
pluck bureau nuclei init ./packs/honesty \\
  --name canon-honesty-v0.1 \\
  --vendor-scope "openai/gpt-4o,anthropic/claude-3-5-sonnet" \\
  --license MIT

# attest to SBOM-AI first, capture the rekor uuid, THEN publish to NUCLEI
pluck bureau sbom-ai publish probe-pack ./packs/honesty/pack.json \\
  --keys ./keys --accept-public

pluck bureau nuclei publish ./packs/honesty/pack.json \\
  --keys ./keys --sbom-rekor-uuid <uuid> --accept-public

# operators subscribe + thread output into a DRAGNET runner
pluck bureau nuclei subscribe --tag training-data --vendor openai --seed <uuid>`}
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Bounties</h2>
        <p>
          Vendors and third-parties stake payout for the first
          quorum-witnessed contradiction against a vendor's signed{" "}
          <code>Disclosure/v1</code> claim. Adjudication / payout is
          off-platform; this layer just records the offer + claim
          predicates so a third-party arbiter can walk the chain.
        </p>
      </section>
    </>
  );
}
