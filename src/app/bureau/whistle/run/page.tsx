// ---------------------------------------------------------------------------
// Bureau / WHISTLE — Submit a tip (capture-pattern activation)
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import { WhistleRunForm } from "./RunForm";

export const metadata = {
  title: "Submit a tip — WHISTLE — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function WhistleRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Submit a tip</h1>
        <p className="bureau-hero-tagline">
          Hand a pre-redacted tip-bundle URL to Studio. We fetch
          (HTTPS-only, ≤ 256 KiB, 10s, no redirects), apply the layered
          redactor (TRIPWIRE secret-scrub + k-anonymity floor +
          stylometric refusal + your manual phrase), sign with an
          ephemeral key, route to the chosen newsroom partner, and
          anchor the submission to Sigstore Rekor.
        </p>
        <p className="bureau-hero-tagline" style={{ marginTop: 12 }}>
          The receipt URL is the operator's proof that the tip was
          logged. Verifying the truth of the tip is downstream — the
          partner takes it from there.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Submission parameters</h2>
        <WhistleRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the submit to the WHISTLE runner. Today
            this is a stub — fetch + redact + route + anchor wire up
            when <code>pluck-api /v1/whistle/submit</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            scoped to the routing partner (e.g.{" "}
            <code>propublica-amber-otter-3742</code>), NOT the bundle
            source — the URL doesn't disclose the tip's origin.
          </li>
          <li>
            On <code>accepted</code>: green dot + Rekor entry +
            partner-side acknowledgement ID. On any failure
            (<code>redaction-failed</code>, <code>routing-failed</code>,{" "}
            <code>bundle-malformed</code>, …): red dot + per-layer
            redaction summary so you can fix the bundle and resubmit.
          </li>
        </ol>
      </section>
    </>
  );
}
