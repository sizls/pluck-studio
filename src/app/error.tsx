"use client";

// ---------------------------------------------------------------------------
// Root error boundary
// ---------------------------------------------------------------------------
//
// Next.js mounts this component when a server / client render below the
// root layout throws. Without it, an uncaught render error renders a
// blank page (because the chunk that errored never paints) and Studio
// looks broken.
//
// Per-program receipt pages and the API route handlers have their own
// error surfaces, but the root boundary catches anything not covered
// downstream — broken Directive module load, a thrown selector, an
// unexpected null from a fact, etc.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

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

const DigestStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 12,
  color: "var(--studio-fg-dim)",
  padding: "8px 12px",
  background: "#0d0d0d",
  border: "1px solid var(--studio-border)",
  borderRadius: 4,
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
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
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

/**
 * The root error boundary. Surfaces a clear apology, a try-again
 * button (Next.js's `reset()`), a link back to `/programs`, and the
 * error digest so operators reporting the issue can quote a stable
 * identifier instead of describing the visual symptom.
 */
export default function RootError({ error, reset }: RootErrorProps): ReactNode {
  return (
    <div style={ContainerStyle} data-testid="root-error">
      <h1 style={HeadingStyle}>Something went wrong.</h1>
      <p style={BodyStyle}>
        Studio hit an unexpected error while rendering this page. The error
        was recorded; if it keeps happening, share the digest below in your
        bug report and we&apos;ll trace it back to a specific code path.
      </p>
      {error.digest !== undefined ? (
        <p style={DigestStyle} data-testid="root-error-digest">
          digest: {error.digest}
        </p>
      ) : null}
      <div style={ButtonRowStyle}>
        <button
          type="button"
          onClick={() => reset()}
          style={PrimaryButtonStyle}
          data-testid="root-error-retry"
        >
          Try again
        </button>
        <a href="/programs" style={SecondaryButtonStyle}>
          Back to programs
        </a>
      </div>
    </div>
  );
}
