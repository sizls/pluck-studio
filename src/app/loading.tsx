// ---------------------------------------------------------------------------
// Root loading state
// ---------------------------------------------------------------------------
//
// Next.js renders this component during the streaming gap between the
// route's server start and its first paint. Without it, the user sees
// a blank page until the route's HTML arrives.
//
// Studio's app router pages are mostly static or RSC-served so the gap
// is short — but a slow API GET (e.g. `/api/v1/runs/[id]` over a flaky
// connection) keeps the receipt page invisible for seconds. The loading
// indicator at least signals "we received your request, just wait."
//
// Single dim line + `aria-busy` so screen readers announce the load
// state instead of guessing the page is broken.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

const ContainerStyle = {
  maxWidth: 720,
  margin: "64px auto",
  padding: "32px 24px",
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  color: "var(--studio-fg-dim)",
};

export default function RootLoading(): ReactNode {
  return (
    <div
      style={ContainerStyle}
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-testid="root-loading"
    >
      Loading…
    </div>
  );
}
