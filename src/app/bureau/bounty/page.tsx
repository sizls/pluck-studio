// ---------------------------------------------------------------------------
// Bureau / BOUNTY – program landing page
// ---------------------------------------------------------------------------
//
// Phase 5 alpha. Renders the BOUNTY charter + the autonomous-filer
// flow. Phase 6+ wires status polling + payout reconciliation.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "BOUNTY — Pluck Bureau",
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
  background: "rgba(0, 255, 0, 0.04)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
};

export default function BountyIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">BOUNTY</h1>
        <p className="bureau-hero-tagline">
          Autonomous HackerOne / Bugcrowd filer. Wraps DRAGNET red dots
          + FINGERPRINT deltas + MOLE verdicts into subpoena-quality
          evidence packets, then dispatches to the platform with the
          operator's auth token (read from env, never logged, never in
          the body).
        </p>
        <p style={{ marginTop: 16 }}>
          <a
            href="/bureau/bounty/run"
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
            File a bounty →
          </a>
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Auth tokens stay LOCAL — signing keys never leave the operator
        </h2>
        <p>
          The platform auth token is read from an env var at submission
          time. It is <strong>never</strong> embedded in the
          EvidencePacket body, the BountySubmission record, or the
          adapter's logged output. Adapters strip Bearer/Token strings
          from upstream error responses before returning them.
        </p>
        <p>
          The operator's Pluck signing key plays no role in adapter
          dispatch. The packet body lists Rekor uuids + a cosign verify
          command that anyone can run independently of the operator.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            pluck bureau bounty file &lt;rekor-uuid&gt; --target hackerone
            --program openai --auth-env H1_TOKEN --subpoena &lt;uuid&gt;
            --vendor openai --model gpt-4o --accept-public{"\n"}
            pluck bureau bounty track &lt;submission-id&gt;{"\n"}
            pluck bureau bounty claim &lt;bounty-id&gt;
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URIs</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>https://pluck.run/EvidencePacket/v1</code> – the
            subpoena-quality body
          </li>
          <li>
            <code>https://pluck.run/BountySubmission/v1</code> –
            post-submission record
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Rate limits</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>HackerOne: 600 submissions / hour</li>
          <li>Bugcrowd: 300 submissions / hour</li>
        </ul>
        <p>
          Submissions over the local rate limit are refused with status
          429 BEFORE a request is sent. Cross-process limits are the
          operator's responsibility.
        </p>
      </section>
    </>
  );
}
