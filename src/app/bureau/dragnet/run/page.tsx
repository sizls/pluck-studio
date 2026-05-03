// ---------------------------------------------------------------------------
// Bureau / DRAGNET — Run a probe (v1 activation entry point)
// ---------------------------------------------------------------------------
//
// Day-1 stub for the v1 activation flow described in
// /Users/jasonwcomes/.claude/plans/mighty-gliding-swan.md.
//
// Question this commit answers: "Can a logged-in user click Run on a
// Bureau program and get a receipt URL back?" Everything in 30/60/90/180
// is downstream of that one form working.
//
// Auth:    proxied via Supabase JWT cookie check inside the POST handler.
//          Real Supabase wiring lands when pluck-api /v1/runs goes live.
// Run:     produces a stub runId today; pluck-api will produce the real
//          RunSpec + receipt when /v1/runs lands.
// Receipt: stub page at /bureau/dragnet/runs/[id] shows "pending".
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { DragnetRunForm } from "./RunForm";

export const metadata = {
  title: "Run a DRAGNET probe — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function DragnetRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Run a DRAGNET probe</h1>
        <p className="bureau-hero-tagline">
          Hand a vendor URL + probe-pack to the runner. Every probe →
          cassette → in-toto attestation → Rekor entry. You get a
          permanent, publicly-verifiable receipt URL on completion.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Probe parameters</h2>
        <DragnetRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What happens next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            We dispatch the run to the Pluck-cloud runner. Today this is
            a stub — receipt-anchoring lands when <code>pluck-api
            /v1/runs</code> ships.
          </li>
          <li>
            You're redirected to a per-run receipt page. Bookmark it —
            the URL is permanent even after the receipt anchors.
          </li>
          <li>
            Once anchored, the receipt is offline-verifiable with{" "}
            <code>cosign verify-blob</code> against the published
            Pluck-cloud key at{" "}
            <code>/.well-known/pluck-keys.json</code>.
          </li>
        </ol>
      </section>
    </>
  );
}
