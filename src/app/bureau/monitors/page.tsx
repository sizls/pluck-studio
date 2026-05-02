import type { ReactNode } from "react";

export const metadata = {
  title: "Monitors — Pluck Bureau",
};

export default function MonitorsPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Quorum Monitors</h1>
        <p className="bureau-hero-tagline">
          Public CT-style list of independent quorum nodes participating in
          bureau attestations. Adding your machine is one command:{" "}
          <code>pluck bureau keys generate --out ./keys</code> followed by{" "}
          a PR to the public registry. Phase 0 — registry endpoint lights up
          with Phase 1.
        </p>
      </section>
      <p style={{ color: "var(--bureau-fg-dim)" }}>
        No monitors registered yet — the registry endpoint goes live with
        DRAGNET (Phase 1).
      </p>
    </>
  );
}
