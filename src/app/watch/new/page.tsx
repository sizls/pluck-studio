// ---------------------------------------------------------------------------
// /watch/new — Create a watch
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import { NewWatchForm } from "./NewWatchForm";

// Sibling /watch pages declare nodejs; keep the watch surface uniform so a
// future config flip to edge can't silently break SSR.
export const runtime = "nodejs";

export const metadata = {
  title: "Create a watch — Pluck Studio",
};

const SectionHeadingStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function NewWatchPage(): ReactNode {
  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title">Create a watch</h1>
        <p className="studio-hero-tagline">
          Tell the agent what to look for and where. Describe it the way
          you&apos;d describe it to a colleague — no selectors, no XPath,
          no regex.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Watch parameters</h2>
        <NewWatchForm />
      </section>
    </>
  );
}
