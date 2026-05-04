// ---------------------------------------------------------------------------
// /runs — cross-program activations directory
// ---------------------------------------------------------------------------
//
// One-stop hub for "what can I run from Studio right now." Lists every
// program activated through the v2 pattern + a "coming soon" rail for
// programs that still need their /run wiring (TRIPWIRE, MOLE, WHISTLE,
// BOUNTY, SBOM-AI, ROTATE) or that don't fit the activation pattern at
// all (NUCLEI registry).
//
// When the pluck-api /v1/runs backend lands, this page extends to also
// list the operator's recent activations across programs ("My runs").
// Today it's directory-only — every fact rendered is static metadata
// from the registry.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import {
  ACTIVE_PROGRAMS,
  COMING_SOON_PROGRAMS,
  type ActiveProgram,
} from "../../lib/programs/registry";

export const metadata = {
  title: "Activations — Pluck Studio",
};

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
};

const CardStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 24,
  marginTop: 16,
  background: "rgba(255, 255, 255, 0.02)",
};

const ProgramNameStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 18,
  letterSpacing: "0.06em",
  color: "var(--bureau-fg)",
};

const SummaryStyle: CSSProperties = {
  marginTop: 8,
  lineHeight: 1.6,
};

const MetaLineStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  marginTop: 8,
  wordBreak: "break-all",
};

const CTAButtonStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 16,
  marginRight: 12,
  padding: "8px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  background: "var(--bureau-fg)",
  color: "var(--bureau-bg)",
  textDecoration: "none",
  borderRadius: 4,
};

const SecondaryButtonStyle: CSSProperties = {
  ...CTAButtonStyle,
  background: "transparent",
  color: "var(--bureau-fg)",
  border: "1px solid var(--bureau-fg-dim)",
};

const ComingSoonRowStyle: CSSProperties = {
  borderBottom: "1px solid var(--bureau-fg-dim)",
  padding: "12px 0",
};

function ProgramCard({ program }: { program: ActiveProgram }): ReactNode {
  return (
    <article style={CardStyle} data-testid={`program-${program.slug}`}>
      <h3 style={ProgramNameStyle}>{program.name}</h3>
      <p style={SummaryStyle}>{program.summary}</p>
      <p style={MetaLineStyle}>
        <strong>Output:</strong> {program.outputShape}
      </p>
      <p style={MetaLineStyle}>
        <strong>Predicate:</strong> <code>{program.predicateUri}</code>
      </p>
      <p>
        <a
          href={program.runPath}
          style={CTAButtonStyle}
          data-testid={`run-cta-${program.slug}`}
        >
          {program.actionVerb} →
        </a>
        <a
          href={program.landingPath}
          style={SecondaryButtonStyle}
          data-testid={`landing-cta-${program.slug}`}
        >
          About {program.name}
        </a>
      </p>
    </article>
  );
}

export default function RunsPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Activations</h1>
        <p className="bureau-hero-tagline">
          Every Bureau program wired through the Studio activation
          pattern lands here. Pick a program, fill in the form, get a
          signed Sigstore-Rekor-anchored receipt URL. Each program's
          domain shape differs — but the run → receipt → share loop is
          the same across all of them.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>
          Active programs ({ACTIVE_PROGRAMS.length})
        </h2>
        <p style={{ marginTop: 8 }} data-testid="active-count">
          {ACTIVE_PROGRAMS.length} of{" "}
          {ACTIVE_PROGRAMS.length + COMING_SOON_PROGRAMS.length} alpha
          programs are wired through the v2 activation pattern.
          {COMING_SOON_PROGRAMS.length === 0
            ? " (Full coverage — every alpha program activated.)"
            : ""}
        </p>
        {ACTIVE_PROGRAMS.map((program) => (
          <ProgramCard key={program.slug} program={program} />
        ))}
      </section>

      {COMING_SOON_PROGRAMS.length > 0 ? (
        <section>
          <h2 style={SectionHeadingStyle}>Coming soon</h2>
          <p style={{ marginTop: 8 }}>
            These programs have landing pages but aren't yet wired
            through the activation pattern — most need scaffolding
            distinct from the verify-and-sign one-shot shape.
          </p>
          <ul style={{ marginTop: 16, padding: 0, listStyle: "none" }}>
            {COMING_SOON_PROGRAMS.map((p) => (
              <li
                key={p.slug}
                style={ComingSoonRowStyle}
                data-testid={`coming-soon-${p.slug}`}
              >
                <strong style={{ ...ProgramNameStyle, fontSize: 14 }}>
                  {p.name}
                </strong>{" "}
                <a
                  href={p.landingPath}
                  style={{
                    marginLeft: 12,
                    fontSize: 12,
                    color: "var(--bureau-fg-dim)",
                  }}
                >
                  landing →
                </a>
                <p
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "var(--bureau-fg-dim)",
                    lineHeight: 1.6,
                  }}
                >
                  {p.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section>
          <h2 style={SectionHeadingStyle}>All 11 alpha programs activated</h2>
          <p
            style={{ marginTop: 8 }}
            data-testid="all-active-callout"
          >
            Every alpha program is wired through the v2 activation
            pattern. The next surface area is the real{" "}
            <code>pluck-api /v1</code> backend that turns the stub
            receipts into anchored Sigstore Rekor entries.
          </p>
        </section>
      )}

      <section>
        <h2 style={SectionHeadingStyle}>What every receipt gets you</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>A permanent vendor-scoped URL</strong> — phrase ID
            like <code>openai-swift-falcon-3742</code> that
            self-discloses the target. Bookmark it; it never moves.
          </li>
          <li>
            <strong>A DSSE-signed envelope</strong> — verify offline
            with <code>cosign verify-blob</code> against{" "}
            <a href="/.well-known/pluck-keys.json">
              <code>/.well-known/pluck-keys.json</code>
            </a>
            .
          </li>
          <li>
            <strong>A Sigstore Rekor anchor</strong> — public
            transparency-log entry. Once anchored, it's permanent.
          </li>
          <li>
            <strong>An auto-rendered share card</strong> — Slack / X /
            Discord / iMessage paste auto-unfurls into a 1200×630 PNG
            with the program's accent color + vendor + cycle status.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Privacy posture</h2>
        <p>
          Receipts are public by default — phrase IDs disclose the
          probed target via the URL slug. Read{" "}
          <a href="/privacy">/privacy</a> before submitting your first
          activation.
        </p>
      </section>
    </>
  );
}
