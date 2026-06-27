// ---------------------------------------------------------------------------
// Pluck Studio — root home page
// ---------------------------------------------------------------------------
//
// The root used to be a 6-line `redirect("/programs")`, which meant
// every cold visitor landed on a 51-tile grid regardless of why they
// arrived. Journalists trying to verify a receipt, regulators looking
// for the compliance narrative, and security researchers hunting for
// an attack surface all got the same operator-catalog page.
//
// The new root surface presents a one-line pitch + three audience-
// segmented entry cards so each persona reaches the surface they came
// for in one click instead of skimming a 51-cell grid for the
// matching keyword.
// ---------------------------------------------------------------------------

import { StudioChrome } from "@/components/programs-ui";
import type { ReactNode } from "react";

const HeroSectionStyle = {
  marginBottom: 48,
  textAlign: "center" as const,
};

const HeroTaglineStyle = {
  fontSize: 18,
  color: "var(--studio-fg-dim)",
  maxWidth: 720,
  margin: "16px auto 0",
  lineHeight: 1.6,
};

const HeroCtaRowStyle = {
  display: "flex",
  gap: 12,
  justifyContent: "center" as const,
  flexWrap: "wrap" as const,
  marginTop: 24,
};

const PrimaryCtaStyle = {
  display: "inline-block",
  padding: "10px 20px",
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  background: "var(--studio-accent)",
  color: "#000",
  textDecoration: "none",
  borderRadius: 4,
  fontWeight: 700,
};

const SecondaryCtaStyle = {
  display: "inline-block",
  padding: "10px 20px",
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  background: "transparent",
  color: "var(--studio-fg)",
  textDecoration: "none",
  borderRadius: 4,
  border: "1px solid var(--studio-fg-dim)",
};

const CardsRowStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 20,
  marginBottom: 48,
};

const CardStyle = {
  display: "block",
  padding: "24px 20px",
  border: "1px solid var(--studio-border)",
  background: "#0d0d0d",
  borderRadius: 6,
  textDecoration: "none",
  color: "var(--studio-fg)",
  transition: "border-color 0.15s ease",
};

const CardLabelStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--studio-fg-dim)",
  marginBottom: 8,
};

const CardTitleStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 18,
  fontWeight: 700,
  margin: "0 0 12px",
};

const CardBodyStyle = {
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  lineHeight: 1.55,
  margin: 0,
};

const CardHintStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 12,
  color: "var(--studio-accent)",
  marginTop: 16,
};

const FooterPitchStyle = {
  borderTop: "1px solid var(--studio-border)",
  paddingTop: 32,
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  lineHeight: 1.6,
  textAlign: "center" as const,
};

interface AudienceCardProps {
  label: string;
  href: string;
  title: string;
  body: string;
  hint: string;
}

function AudienceCard({
  label,
  href,
  title,
  body,
  hint,
}: AudienceCardProps): ReactNode {
  return (
    <a href={href} style={CardStyle} data-testid={`audience-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div style={CardLabelStyle}>{label}</div>
      <h2 style={CardTitleStyle}>{title}</h2>
      <p style={CardBodyStyle}>{body}</p>
      <p style={CardHintStyle}>{hint} →</p>
    </a>
  );
}

export const metadata = {
  title: "Pluck Studio — public ledger of AI-vendor trust",
};

export default function HomePage(): ReactNode {
  return (
    <StudioChrome active="home">
      <section className="studio-hero" style={HeroSectionStyle}>
        <h1 className="studio-hero-title">Pluck Studio</h1>
        <p style={HeroTaglineStyle}>
          A Sigstore-anchored public ledger for AI-vendor trust. Every
          probe, contradiction, and key rotation lands as a signed
          DSSE envelope — verifiable from a 60-second journalist drop
          to a regulator&apos;s formal audit.
        </p>
        <div style={HeroCtaRowStyle}>
          <a href="/programs" style={PrimaryCtaStyle} data-testid="hero-cta-programs">
            Browse programs
          </a>
          <a href="/runs" style={SecondaryCtaStyle} data-testid="hero-cta-runs">
            Recent runs
          </a>
        </div>
      </section>

      <section aria-labelledby="audiences-heading">
        <h2
          id="audiences-heading"
          style={{
            fontFamily: "var(--studio-mono)",
            fontSize: 12,
            color: "var(--studio-fg-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 16,
            textAlign: "center",
          }}
        >
          Pick the surface for your role
        </h2>
        <div style={CardsRowStyle}>
          <AudienceCard
            label="Journalist"
            href="/programs/custody/verify"
            title="Verify a custody bundle"
            body="Drag a CustodyBundle JSON file onto Studio. The offline verifier walks the Merkle chain, checks every signature, and tells you whether the bundle holds — no server round-trip, no shared key, no log entry. Built for the 60-second deadline."
            hint="Drop a bundle"
          />
          <AudienceCard
            label="Regulator"
            href="/what-we-dont-know"
            title="What Pluck refuses to know"
            body="Explicit, written-out list of facts Studio actively refuses to log — IPs, fingerprints, operator notes for some programs. Pairs with the privacy posture page; together they're the compliance narrative an auditor can quote."
            hint="Read the posture"
          />
          <AudienceCard
            label="Security researcher"
            href="/programs/nuclei"
            title="Publish a NUCLEI probe-pack"
            body="Author a signed probe-pack, attach a license, and anchor it to Rekor. Every consumer who runs the pack writes their cassettes against the packHash — so the receipt chain leads back to the author whether the pack catches a contradiction or a green dot."
            hint="See the registry"
          />
        </div>
      </section>

      <p style={FooterPitchStyle}>
        Operators run programs locally with the{" "}
        <code>pluck</code> CLI. Studio is the public read-side: every
        signed receipt, every contradiction graph, every vendor
        leaderboard. Press <kbd>Tab</kbd> to navigate, then{" "}
        <a href="/mcp">connect via MCP</a> for programmatic access.
      </p>
    </StudioChrome>
  );
}
