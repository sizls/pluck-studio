// ---------------------------------------------------------------------------
// Bureau / OATH – program landing page
// ---------------------------------------------------------------------------
//
// Phase 4 alpha. The "robots.txt for AI honesty" framing – vendors
// sign a `PluckOath/v1` attestation and host it at
// `/.well-known/pluck-oath.json`. Every other Bureau program
// contradict-checks against the oath at evaluation time.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "OATH — Pluck Bureau",
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

export default function OathIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">OATH</h1>
        <p className="bureau-hero-tagline">
          The robots.txt for AI honesty. Vendors sign a{" "}
          <code>PluckOath/v1</code> attestation listing their public
          commitments and serve it at{" "}
          <code>https://&lt;vendor&gt;/.well-known/pluck-oath.json</code>.
          Every Bureau program contradict-checks against the oath at
          evaluation time. Vendors with no oath get a visible{" "}
          <strong>did not commit</strong> badge.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Phase 4 alpha
        </h2>
        <p>
          The signing + verification + contradict layers are alpha;
          the vendor-management UI at <code>/bureau/oath/manage</code>{" "}
          ships as a placeholder until Kite Event Log lands in Phase 4+.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Vendor flow</h2>
        <pre>
          <code>
            pluck bureau oath publish ./oath.json --keys ./keys --out ./.oath
          </code>
        </pre>
        <p>
          The signed DSSE envelope lands in <code>./.oath/</code> as{" "}
          <code>&lt;envelopeHash&gt;.intoto.jsonl</code>. Host the
          envelope bytes at{" "}
          <code>/.well-known/pluck-oath.json</code> with{" "}
          <code>Content-Type: application/json</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Operator flow</h2>
        <pre>
          <code>
            pluck bureau oath fetch openai.com --out ./.oath
            {"\n"}
            pluck bureau oath verify ./.oath/&lt;hash&gt;.intoto.jsonl
            --expected-origin https://openai.com
          </code>
        </pre>
        <p>
          Fetch is HTTPS-only, capped at 256 KiB, 10s timeout, no
          redirects. Verify cross-checks the served Origin against the
          oath body's <code>vendor</code> field.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Sealed-claim semantics</h2>
        <p>
          Every claim is sealed past <code>expiresAt</code>: contradict
          checks return <code>oath-expired</code> instead of triggering
          a red dot. Vendors must republish to extend coverage —
          ignoring expiry would create stale-data false-positives and
          punish vendors who let their oath quietly drift.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URI</h2>
        <pre>
          <code>https://pluck.run/PluckOath/v1</code>
        </pre>
      </section>
    </>
  );
}
