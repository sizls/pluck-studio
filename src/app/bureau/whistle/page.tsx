// ---------------------------------------------------------------------------
// Bureau / WHISTLE – program landing page
// ---------------------------------------------------------------------------
//
// Phase 5 alpha. Renders the WHISTLE charter, the heavy anonymity
// caveat, and the CLI surface. Phase 6+ wires the Tor-hidden ingestion
// endpoint + zero-log routing layer.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "WHISTLE — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const CalloutStyle = {
  border: "1px solid var(--bureau-fg-dim)",
  background: "rgba(255, 0, 0, 0.04)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
};

export default function WhistleIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">WHISTLE</h1>
        <p className="bureau-hero-tagline">
          Anonymous AI whistleblower pipeline. Ephemeral Ed25519 keys,
          layered redaction (TRIPWIRE secret-scrub + k-anonymity floor +
          stylometric refusal), routing to ProPublica / Bellingcat /
          404Media / EFF Press. SecureDrop for the AI era.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Anonymity is best-effort, NOT absolute
        </h2>
        <p>
          The ephemeral key + redactor protect against trivial
          deanonymization (key reuse, accidental secret disclosure,
          obvious stylometric leaks). They do <strong>NOT</strong>{" "}
          protect against:
        </p>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            timing / IP-layer correlation by a determined adversary
            even with Tor between you and the ingestion endpoint
          </li>
          <li>
            stylometric attacks against truly small populations — a
            unique-enough phrase identifies a small-team source
          </li>
          <li>
            file metadata / EXIF — the redactor does not strip those
          </li>
          <li>
            US Computer Fraud and Abuse Act / UK Computer Misuse Act
            liability when the evidence comes from inside a vendor
          </li>
        </ul>
        <p>
          Read the package README before submitting. Speak to a lawyer
          first when filing in the <code>policy-violation</code> or{" "}
          <code>safety-incident</code> categories with vendor-internal
          evidence.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            pluck bureau whistle submit ./bundle.json --category training-data
            --routing "propublica,bellingcat" --manual-redact "phrase to remove"{"\n"}
            pluck bureau whistle verify &lt;rekor-uuid&gt;{"\n"}
            pluck bureau whistle route &lt;submission-uuid&gt; --add-target
            "https://desk.example/api/whistle" --add-id desk-example
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URI</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>https://pluck.run/WhistleSubmission/v1</code>
          </li>
        </ul>
      </section>
    </>
  );
}
