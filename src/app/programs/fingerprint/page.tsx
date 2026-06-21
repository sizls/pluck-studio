// ---------------------------------------------------------------------------
// Pluck / FINGERPRINT – program landing page
// ---------------------------------------------------------------------------
//
// Phase 4 alpha. Active model-swap detection: the operator runs a
// small deterministic probe-pack against the target, the daemon
// produces a signed `ModelFingerprint/v1` cassette, and the delta
// between two scans surfaces silent vendor swaps as fingerprint
// discontinuities.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "FINGERPRINT — Pluck",
};

const SectionHeadingStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const CalloutStyle = {
  border: "1px solid var(--studio-fg-dim)",
  background: "rgba(255, 255, 0, 0.04)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
};

export default function FingerprintIndexPage(): ReactNode {
  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title">FINGERPRINT</h1>
        <p className="studio-hero-tagline">
          The tuning fork of model identity. A fixed five-probe
          calibration set produces an Ed25519-signed{" "}
          <code>ModelFingerprint/v1</code> cassette per scan. Comparing
          two scans surfaces drift as <code>stable</code>,{" "}
          <code>minor</code>, <code>major</code>, or — when the
          fingerprint hash diverges entirely — <code>swap</code>.
        </p>
        <p style={{ marginTop: 16 }}>
          <a
            href="/programs/fingerprint/run"
            data-testid="run-cta"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              fontFamily: "var(--studio-mono)",
              fontSize: 14,
              background: "var(--studio-fg)",
              color: "var(--studio-bg)",
              textDecoration: "none",
              borderRadius: 4,
            }}
          >
            Scan a model →
          </a>
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          What ships today
        </h2>
        <p>
          Calibration probe-set, scan, delta, and MCP tool-surface
          enumeration are live. Public-vendor fingerprint history
          dashboards land once Studio reads fingerprint cassettes
          back out of the Kite Event Log.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Scan a target</h2>
        <pre>
          <code>
            pluck fingerprint scan --vendor openai --model
            gpt-4o \{"\n"}{" "}
            --keys ./keys --responder ./responder.js{"\n"}{" "}
            --notarize --accept-public --out ./.fp
          </code>
        </pre>
        <p>
          The <code>--responder</code> module default-exports a{" "}
          <code>(probe, signal) =&gt; Promise&lt;{`{`}responseText,
          tokens?{`}`}&gt;</code> function. This keeps the scanner
          transport-agnostic — wire OpenAI, Anthropic, OpenRouter, or
          a local Ollama install in 10 lines of glue.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Compare two scans</h2>
        <pre>
          <code>
            pluck fingerprint delta ./from.json ./to.json --keys
            ./keys
          </code>
        </pre>
        <p>
          The signed <code>FingerprintDelta/v1</code> envelope encodes
          the per-probe diff plus the drift classification. Local
          cassettes are addressed as <code>local:&lt;sha256&gt;</code>;
          notarized cassettes are addressed by Rekor uuid.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>MCP tool-surface</h2>
        <pre>
          <code>
            pluck fingerprint mcp-enum
            http://localhost:8080/rpc
          </code>
        </pre>
        <p>
          Names + canonical schema hashes + description hashes — never
          verbatim prose — so an MCP server's tool list rides into a
          fingerprint cassette without echoing attacker-controlled
          bytes into the cassette body.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URIs</h2>
        <pre>
          <code>
            https://pluck.run/ModelFingerprint/v1{"\n"}
            https://pluck.run/FingerprintDelta/v1
          </code>
        </pre>
      </section>
    </>
  );
}
