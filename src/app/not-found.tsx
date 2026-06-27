// ---------------------------------------------------------------------------
// Root 404
// ---------------------------------------------------------------------------
//
// Next.js renders this component for any route that doesn't match a
// page.tsx or that explicitly throws `notFound()`. Without it, Studio
// shows Next's default 404 styling — a white page on the dark theme,
// which looks broken.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

const ContainerStyle = {
  maxWidth: 720,
  margin: "64px auto",
  padding: "32px 24px",
  fontFamily: "var(--studio-sans)",
};

const HeadingStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 28,
  fontWeight: 700,
  margin: "0 0 16px",
};

const BodyStyle = {
  color: "var(--studio-fg-dim)",
  lineHeight: 1.6,
  marginBottom: 24,
};

const ButtonRowStyle = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap" as const,
};

const PrimaryButtonStyle = {
  display: "inline-block",
  padding: "10px 20px",
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  background: "var(--studio-fg)",
  color: "var(--studio-bg)",
  textDecoration: "none",
  borderRadius: 4,
};

const SecondaryButtonStyle = {
  display: "inline-block",
  padding: "10px 20px",
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  background: "transparent",
  color: "var(--studio-fg)",
  textDecoration: "none",
  border: "1px solid var(--studio-fg-dim)",
  borderRadius: 4,
};

export default function RootNotFound(): ReactNode {
  return (
    <div style={ContainerStyle} data-testid="root-not-found">
      <h1 style={HeadingStyle}>This URL doesn&apos;t exist.</h1>
      <p style={BodyStyle}>
        Either the link you followed is stale, the program moved, or the
        page hasn&apos;t shipped yet. Run <code>pluck --help</code> for the
        canonical program list, or pick one below.
      </p>
      <div style={ButtonRowStyle}>
        <a href="/programs" style={PrimaryButtonStyle}>
          Browse programs
        </a>
        <a href="/runs" style={SecondaryButtonStyle}>
          Recent runs
        </a>
        <a href="/search" style={SecondaryButtonStyle}>
          Search
        </a>
      </div>
    </div>
  );
}
