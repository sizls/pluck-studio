// ---------------------------------------------------------------------------
// Bureau / REFUSE – program landing page
// ---------------------------------------------------------------------------
//
// Phase 1 alpha. Renders the REFUSE charter, the call-to-action ("sign a
// canary"), the CLI surface, and the four predicate URIs. Phase 2 wires the
// per-canary timeline (every probe-result that references the attestation
// uuid).
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "REFUSE — Pluck Bureau",
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

const CtaStyle = {
  border: "1px solid var(--bureau-fg)",
  background: "rgba(0, 255, 128, 0.06)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
};

export default function RefuseIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">REFUSE</h1>
        <p className="bureau-hero-tagline">
          Personal do-not-train attestation. Sign a canary; bind a vendor
          OATH; if a deployed model later regurgitates the canary above
          threshold, the contradiction is cryptographic. Composes OATH +
          MOLE + DRAGNET + WHISTLE.
        </p>
      </section>

      <section style={CtaStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Sign a canary
        </h2>
        <p>
          Every citizen can publish a Refuse/v1 attestation. The canary
          body lives on your machine; only its sha256 + a few fingerprint
          phrases land in Rekor. Aggregating millions of citizen canaries
          makes evasion statistically impossible — a single random-string
          canary in a training set is extraction-provable.
        </p>
        <pre>
          <code>
            pluck bureau refuse declare ./bundle --name &quot;Jane Doe&quot; \{"\n"}
            {"  "}--keys ./keys --scope-vendors &quot;openai,anthropic&quot;{"\n"}
            {"  "}--scope-jurisdictions &quot;US,EU&quot;
          </code>
        </pre>
        <p style={{ fontSize: 13, color: "var(--bureau-fg-dim)" }}>
          The canary body is written to{" "}
          <code>canary-body.txt</code> (mode 0600). Keep it private —
          publishing the body retroactively destroys the seal&apos;s
          extraction-evident property.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          What REFUSE proves and what it does NOT
        </h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>Proves:</strong> if a model emits the canary or any
            of its fingerprint phrases verbatim above threshold, the
            model trained on the canary AFTER the citizen sealed it.
            Rekor&apos;s integratedTime defeats backdating.
          </li>
          <li>
            <strong>Does NOT prove:</strong> that the vendor authored or
            supervised the training data. REFUSE is a falsification of
            the vendor&apos;s do-not-train OATH; intent is for journalists
            and lawyers to argue.
          </li>
          <li>
            <strong>Fail-closed binding:</strong> attesting with{" "}
            <code>--bind-oath</code> refuses if the named vendor&apos;s OATH
            does not include a training-excludes claim. No warn-and-proceed.
          </li>
          <li>
            <strong>Single citizen:</strong> revocation is supported via
            RefusalWithdrawal/v1, but withdrawal arriving AFTER training
            cutoff is informational — the canary&apos;s already in the model.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            pluck bureau refuse declare &lt;out-dir&gt; --name &quot;...&quot; --keys &lt;dir&gt; \{"\n"}
            {"  "}--scope-vendors &quot;...&quot; --scope-jurisdictions &quot;...&quot;{"\n"}
            pluck bureau refuse attest &lt;canary.json&gt; --keys &lt;dir&gt; \{"\n"}
            {"  "}--bind-oath &lt;oath-rekor-uuid&gt; --oath &lt;oath.json&gt; --out &lt;dir&gt;{"\n"}
            pluck bureau refuse probe &lt;canary.json&gt; --target &lt;vendor&gt;/&lt;model&gt; \{"\n"}
            {"  "}--keys &lt;dir&gt; --canary-rekor-uuid &lt;uuid&gt; --out &lt;pack.json&gt;{"\n"}
            pluck bureau refuse status &lt;attestation-rekor-uuid&gt;{"\n"}
            pluck bureau refuse withdraw &lt;attestation.json&gt; --keys &lt;dir&gt; \{"\n"}
            {"  "}--attestation-rekor-uuid &lt;uuid&gt; --reason &quot;...&quot;
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URIs</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>https://pluck.run/Refuse/v1</code> – citizen opt-out
            attestation
          </li>
          <li>
            <code>https://pluck.run/RefusalCanary/v1</code> – sealed
            canary commit
          </li>
          <li>
            <code>https://pluck.run/RefusalProbeResult/v1</code> –
            per-vendor/model scoring
          </li>
          <li>
            <code>https://pluck.run/RefusalWithdrawal/v1</code> –
            citizen revocation
          </li>
        </ul>
      </section>
    </>
  );
}
