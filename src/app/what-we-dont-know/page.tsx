// ---------------------------------------------------------------------------
// /what-we-dont-know — the negative-knowledge page
// ---------------------------------------------------------------------------
//
// The inversion. Most security tools brag about what they collect; this
// page is everything Pluck Studio refuses to know about an operator's
// operation, listed by program, by design.
//
// Driven verbatim from `PROGRAM_PRIVACY_POSTURE` in
// `lib/programs/registry.ts`. Pure server-render — no client state, no
// Directive system, no fetch. Adding a program means adding a posture
// entry; the registry test suite blocks PRs that skip the disclosure.
//
// The phrase-ID schema is the proof. If Studio knew it, it would be in
// the URL.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import {
  ACTIVE_PROGRAMS,
  PROGRAM_PRIVACY_POSTURE,
  PHRASE_ID_PREFIX_CONVENTIONS,
} from "../../lib/programs/registry";

export const metadata = {
  title: "What we don't know about your operation — Pluck Studio",
  description:
    "Most security tools brag about what they collect. This page is everything Pluck Studio refuses to know about your operation, by program, by design.",
  openGraph: {
    title: "What we don't know about your operation",
    description:
      "The first AI-monitoring tool that brags about its own ignorance. Per-program negative-knowledge disclosure for Pluck Studio.",
  },
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
  border: "1px solid var(--bureau-border)",
  borderRadius: 6,
  padding: 24,
  marginTop: 16,
  background: "rgba(255, 255, 255, 0.02)",
};

const CardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const SlugDotStyle: CSSProperties = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: "var(--bureau-accent)",
  flex: "none",
};

const ProgramNameStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 18,
  letterSpacing: "0.06em",
  color: "var(--bureau-fg)",
  margin: 0,
};

const SlugStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  marginLeft: "auto",
};

const TwoColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 20,
  marginTop: 16,
};

const ColumnLabelKnowsNotStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const ColumnLabelKnowsStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const ListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

const KnowsNotItemStyle: CSSProperties = {
  fontSize: 14,
  color: "var(--bureau-fg)",
  lineHeight: 1.6,
  paddingLeft: 18,
  position: "relative",
  marginTop: 6,
};

const KnowsItemStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  lineHeight: 1.6,
  paddingLeft: 18,
  position: "relative",
  marginTop: 4,
};

const PrefixStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  fontFamily: "var(--bureau-mono)",
};

const PrefixSourceLineStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
  marginTop: 16,
  paddingTop: 12,
  borderTop: "1px solid var(--bureau-border)",
  lineHeight: 1.5,
};

const FooterStyle: CSSProperties = {
  marginTop: 48,
  paddingTop: 24,
  borderTop: "1px solid var(--bureau-border)",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  lineHeight: 1.7,
};

interface PostureCardProps {
  slug: string;
  name: string;
  knowsNot: ReadonlyArray<string>;
  knows: ReadonlyArray<string>;
  prefixSource: string | undefined;
}

function PostureCard({
  slug,
  name,
  knowsNot,
  knows,
  prefixSource,
}: PostureCardProps): ReactNode {
  return (
    <article style={CardStyle} data-testid={`posture-${slug}`}>
      <header style={CardHeaderStyle}>
        <span style={SlugDotStyle} aria-hidden="true" />
        <h3 style={ProgramNameStyle}>{name}</h3>
        <span style={SlugStyle}>{slug}</span>
      </header>

      <div style={TwoColumnStyle}>
        <div data-testid={`posture-${slug}-knowsNot`}>
          <p style={ColumnLabelKnowsNotStyle}>We do not know</p>
          <ul style={ListStyle}>
            {knowsNot.map((claim) => (
              <li key={claim} style={KnowsNotItemStyle}>
                <span style={PrefixStyle} aria-hidden="true">
                  —
                </span>
                {claim}
              </li>
            ))}
          </ul>
        </div>

        <div data-testid={`posture-${slug}-knows`}>
          <p style={ColumnLabelKnowsStyle}>We do know</p>
          <ul style={ListStyle}>
            {knows.map((claim) => (
              <li key={claim} style={KnowsItemStyle}>
                <span style={PrefixStyle} aria-hidden="true">
                  +
                </span>
                {claim}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {prefixSource ? (
        <p style={PrefixSourceLineStyle}>
          <strong>Phrase-ID prefix:</strong> {prefixSource}
        </p>
      ) : null}
    </article>
  );
}

export default function WhatWeDontKnowPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">
          What we don't know about your operation
        </h1>
        <p className="bureau-hero-tagline">
          Most security tools brag about what they collect. This page is
          everything Pluck Studio refuses to know about your operation,
          by program, by design. Each card lists what stays out of
          Studio's reach (load-bearing) and the necessary trust-tradeoff
          (what we do see). The phrase-ID schema is the proof — if
          Studio knew it, it would be in the URL.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>
          Per-program posture ({ACTIVE_PROGRAMS.length})
        </h2>
        {ACTIVE_PROGRAMS.map((program) => {
          const posture = PROGRAM_PRIVACY_POSTURE[program.slug];
          const convention = PHRASE_ID_PREFIX_CONVENTIONS[program.slug];

          if (!posture) {
            return null;
          }

          return (
            <PostureCard
              key={program.slug}
              slug={program.slug}
              name={program.name}
              knowsNot={posture.knowsNot}
              knows={posture.knows}
              prefixSource={convention?.prefixSource}
            />
          );
        })}
      </section>

      <p style={FooterStyle} data-testid="negative-knowledge-footer">
        The phrase-ID schema is the proof — if Studio knew it, it would
        be in the URL. Read{" "}
        <a href="/runs">the activations directory</a> for what Studio
        does anchor, and <a href="/privacy">/privacy</a> for the broader
        posture statement.
      </p>
    </>
  );
}
