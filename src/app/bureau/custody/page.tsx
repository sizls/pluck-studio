// ---------------------------------------------------------------------------
// Bureau / CUSTODY – program landing page
// ---------------------------------------------------------------------------
//
// Phase 6 alpha. Renders the CUSTODY charter + the FRE 902(13) /
// Daubert reliability standard rationale + the WebAuthn binding
// requirement + the "60-second journalist verify" tagline.
//
// The verifier itself is wired at /bureau/custody/verify and the
// per-bundle viewer at /bureau/custody/[uuid].
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "CUSTODY — Pluck Bureau",
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

export default function CustodyIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">CUSTODY</h1>
        <p className="bureau-hero-tagline">
          Browser-extension AI conversation chain-of-custody.
          Court-admissible captures with WebAuthn-bound operator
          identity. 60-second journalist verification — drag a
          CustodyBundle JSON onto the verify page and the FRE
          902(13) compliance result appears in your browser, no
          network round-trip.
        </p>
        <p style={{ marginTop: 16 }}>
          <a
            href="/bureau/custody/run"
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
              marginRight: 12,
            }}
          >
            Verify a bundle by URL →
          </a>
          <a
            href="/bureau/custody/verify"
            data-testid="verify-offline-cta"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontFamily: "var(--bureau-mono)",
              fontSize: 14,
              background: "transparent",
              color: "var(--bureau-fg)",
              textDecoration: "none",
              border: "1px solid var(--bureau-fg-dim)",
              borderRadius: 4,
            }}
          >
            Drag-drop verify (offline) →
          </a>
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          The keystone: WebAuthn-bound operator identity
        </h2>
        <p>
          A captured AI conversation is only useful in court if the
          signer's key survives the Daubert reliability standard.
          Disk-only Ed25519 keys do not — anyone with file-system
          access could forge them. CUSTODY ties every capture to a
          WebAuthn-registered passkey rooted in tamper-evident
          secure-element hardware. The library verifier flags any
          bundle without that binding{" "}
          <code>fre902Compliant: false</code> and lists every reason
          why so an attorney can map straight to admissibility
          arguments.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What gets captured</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>Full-page DOM snapshot</strong> — sha256-pinned,
            capped at 4 MiB.
          </li>
          <li>
            <strong>Every fetch request + response</strong> — bodies
            stored as cassettes by envelopeHash; the spec stays small.
          </li>
          <li>
            <strong>Browser fingerprint</strong> — user-agent,
            viewport, IANA timezone, BCP 47 language, sha256 of the
            canonical sorted plugin set.
          </li>
          <li>
            <strong>System clock</strong> — capture start + end (so
            verifiers can detect skew).
          </li>
          <li>
            <strong>Operator identity binding</strong> — WebAuthn
            credential id + attestation digest, anchored to the
            operator's Ed25519 SPKI fingerprint.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Chain-of-custody chain</h2>
        <p>
          Every bundle carries an append-only chain of signed events:
          <code>capture</code>, <code>handoff</code>,{" "}
          <code>publication</code>, <code>verification</code>. Each
          event's signature is anchored to the prior event's hash, so
          reordering or dropping an event breaks verification
          immediately. Chain length is capped at 256; longer flows
          split into multiple bundles, each anchoring to the prior
          bundle's <code>chainRootHash</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            pluck bureau custody capture &lt;bundle.json&gt;{"\n"}
            pluck bureau custody build &lt;captures-dir&gt; --out
            &lt;bundle.json&gt;{"\n"}
            pluck bureau custody verify &lt;bundle.json&gt; --json
            {"\n"}
            pluck bureau custody export &lt;bundle.json&gt; --subpoena
            &lt;uuid&gt; --vendor openai --model gpt-4o
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URIs</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>https://pluck.run/CustodyBundle/v1</code> – the full
            bundle
          </li>
          <li>
            <code>https://pluck.run/ChainOfCustodyEvent/v1</code> –
            single event (lets operators stream-notarize each event)
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Phase 6.5 deferral</h2>
        <p>
          Phase 6 alpha ships the library + verifier. The full
          Chrome / Firefox MV3 extension build pipeline (WebAuthn
          flow, content-script bundle, signing, web-store publish,
          headless-Chrome integration tests) lands{" "}
          <strong>Phase 6.5</strong>. The journalist verify flow at{" "}
          <code>/bureau/custody/verify</code> works today against
          bundles produced by hand or by an out-of-tree capture
          tool.
        </p>
      </section>
    </>
  );
}
