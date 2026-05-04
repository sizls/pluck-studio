// ---------------------------------------------------------------------------
// Bureau / MOLE – program landing page
// ---------------------------------------------------------------------------
//
// Phase 5 alpha. Renders the MOLE charter + the operator's CLI surface.
// Phase 6+ wires Kite Event Log so the search box resolves canary
// commits + verdicts from a public registry.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "MOLE — Pluck Bureau",
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
  background: "rgba(255, 255, 0, 0.04)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
};

export default function MoleIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">MOLE</h1>
        <p className="bureau-hero-tagline">
          Adversarial training-data extraction probes. The operator
          seals a canary BEFORE probing; runs the probe-pack; emits a
          publicly citable falsification when the model regurgitates
          fingerprint phrases verbatim. NYT-vs-OpenAI as a public service.
        </p>
        <p style={{ marginTop: 16 }}>
          <a
            href="/bureau/mole/run"
            data-testid="run-cta"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontFamily: "var(--bureau-mono)",
              fontSize: 14,
              background: "var(--bureau-fg)",
              color: "var(--bureau-bg)",
              textDecoration: "none",
              borderRadius: 4,
            }}
          >
            Seal a canary →
          </a>
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Sealing comes BEFORE probing
        </h2>
        <p>
          The canary commit is signed and notarized BEFORE any probe
          touches the vendor. Vendors cannot retroactively claim "we
          trained on your canary AFTER you published the seal" — the
          Rekor timestamp predates every probe-run record.
        </p>
        <p>
          MOLE never publishes the canary BODY. Only its sha256 + a
          short list of fingerprint phrases enter the public log; the
          operator holds the raw text locally for the journalist
          conversation.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            pluck bureau mole init ./bundle --canary ./article.txt
            --canary-id nyt-2024-01-15 --keys ./keys{"\n"}
            pluck bureau mole run ./mole-pack.json --target openai/gpt-4o{"\n"}
            pluck bureau mole cite &lt;rekor-uuid&gt; --canary ./canary.json
            --verdict ./verdict.json --prompt "Continue: ..."
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URIs</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>https://pluck.run/CanaryDocument/v1</code> – sealed
            canary manifest
          </li>
          <li>
            <code>https://pluck.run/MemorizationVerdict/v1</code> –
            per-probe scoring result
          </li>
        </ul>
      </section>
    </>
  );
}
