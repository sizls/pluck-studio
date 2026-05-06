// ---------------------------------------------------------------------------
// /runs — cross-program activations directory
// ---------------------------------------------------------------------------
//
// One-stop hub for "what can I run from Studio right now." All 11 alpha
// programs are wired through the unified activation pattern: DRAGNET,
// OATH, FINGERPRINT, CUSTODY, WHISTLE, BOUNTY, SBOM-AI, ROTATE,
// TRIPWIRE, NUCLEI, and MOLE. New programs land in
// `lib/programs/registry.ts` and auto-render here.
//
// The coming-soon section gracefully handles the empty case — when no
// programs are pending, it renders an "all activated" callout instead.
// When the pluck-api /v1/runs backend lands, this page extends to also
// list the operator's recent activations ("My runs").
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
        <h2 style={SectionHeadingStyle}>Search by phrase ID</h2>
        <p style={{ marginTop: 8 }} data-testid="search-cross-link">
          Paste any phrase ID at <a href="/search">/search</a> and see
          every related receipt across all 11 programs — same vendor,
          same partner, same platform. The keystone search experience.
        </p>
        <p
          style={{ marginTop: 8, color: "var(--bureau-fg-dim)", fontSize: 13 }}
          data-testid="open-cross-link"
        >
          Speed-dial: paste any phrase ID into <a href="/open">/open/&lt;phrase&gt;</a>{" "}
          (or the short-form <code>/o/&lt;phrase&gt;</code>) and you'll
          jump straight to the canonical receipt.
        </p>
        <p
          style={{ marginTop: 8, color: "var(--bureau-fg-dim)", fontSize: 13 }}
          data-testid="diff-cross-link"
        >
          Compare receipts: open{" "}
          <a href="/diff">/diff/&lt;base&gt;?since=&lt;target&gt;</a> to
          see what changed between two cycles of the same vendor.
          Vendor-honesty time machine.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Daily roll-up</h2>
        <p style={{ marginTop: 8 }} data-testid="today-cross-link">
          The shareable daily honesty card.{" "}
          <a href="/today">/today</a> renders one tile per program with
          the last 24h verdict density — paste the URL into Slack / X /
          Discord and the 1200×630 OG card auto-unfurls.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Screenshot probe extractor</h2>
        <p style={{ marginTop: 8 }} data-testid="extract-cross-link">
          New: paste a screenshot of a vendor's marketing claim and Studio
          will extract testable assertions, one click pre-fills DRAGNET.
          Your screenshot stays in your browser —{" "}
          <a href="/extract">try the screenshot extractor</a>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Supply-chain loop: SBOM-AI → NUCLEI</h2>
        <p style={{ marginTop: 8 }} data-testid="sbom-ai-nuclei-loop-cross-link">
          Publish a probe-pack via{" "}
          <a href="/bureau/sbom-ai/run">/bureau/sbom-ai/run</a> and the
          receipt surfaces a "Publish to NUCLEI registry →" CTA with
          your rekor UUID pre-filled. NUCLEI receipts back-link the
          SBOM-AI source artifact so the provenance chain is one
          click away in either direction.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>NUCLEI monitors</h2>
        <p style={{ marginTop: 8 }} data-testid="monitors-cross-link">
          Watch upcoming fires across the registry —{" "}
          <a href="/monitors">/monitors</a> renders every published pack's
          next 24 hours of fires on a single timeline.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Per-vendor profiles</h2>
        <p style={{ marginTop: 8 }} data-testid="vendor-index-cross-link">
          Every receipt that names a vendor enriches that vendor's
          permanent URL. <a href="/vendor">/vendor</a> renders the
          honesty index across all 11 programs — bookmark a vendor, cite
          a vendor, watch a vendor.
        </p>
      </section>

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
          What we refuse to know about your operation. The phrase-ID
          schema is the proof — read{" "}
          <a
            href="/what-we-dont-know"
            title="Per-program negative-knowledge disclosure"
          >
            /what-we-dont-know
          </a>{" "}
          for the per-program list. Receipts are public by default —
          phrase IDs disclose the probed target via the URL slug; read{" "}
          <a href="/privacy">/privacy</a> before submitting your first
          activation.
        </p>
      </section>
    </>
  );
}
