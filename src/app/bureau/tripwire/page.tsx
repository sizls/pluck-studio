// ---------------------------------------------------------------------------
// Bureau / TRIPWIRE – program landing page
// ---------------------------------------------------------------------------
//
// Phase 2 alpha. Renders the JS-layer scope statement, the install
// command, and a link to the per-machine timeline. The eBPF / Network
// Extension paths are deferred to Phase 2.5 – this page is the place
// the deferral is publicly stated so operators don't expect more.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "TRIPWIRE — Pluck Bureau",
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

export default function TripwireIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">TRIPWIRE</h1>
        <p className="bureau-hero-tagline">
          Wireshark-of-agent-traffic. A JS-layer interceptor patches{" "}
          <code>globalThis.fetch</code> and <code>node:http</code>/
          <code>node:https</code> so every outbound LLM request from
          your dev machine is captured, attested, and (optionally)
          notarized. Per-machine timeline lives at{" "}
          <a href="/bureau/tripwire/me">tripwire/me</a>.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Phase 2 alpha — JS-layer only
        </h2>
        <p>
          This release ships the <strong>in-process</strong>{" "}
          interceptor. That covers every Node-process LLM client that
          uses standard HTTP — which is essentially all of them.
        </p>
        <p>
          Native macOS Network Extension and Linux eBPF paths are
          deferred to <strong>Phase 2.5</strong>: they require
          entitlements + libbpf bindings that aren't trivial to ship
          inside a published npm package. JS-layer first, kernel hooks
          when the demand justifies the entitlement application.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Install</h2>
        <pre>
          <code>
            pluck bureau tripwire install --keys ./keys --out ./.tripwire
          </code>
        </pre>
        <p>
          Add <code>--notarize</code> to publish non-green cassettes to
          Sigstore Rekor. Default is local-only — bodies stay on disk
          in <code>./.tripwire/cassettes/</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Captured policy by default</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>api.openai.com</code> — OpenAI
          </li>
          <li>
            <code>api.anthropic.com</code> — Anthropic
          </li>
          <li>
            <code>generativelanguage.googleapis.com</code> — Google AI
          </li>
          <li>
            <code>openrouter.ai/api</code> — OpenRouter
          </li>
          <li>
            <code>localhost:11434</code> / <code>127.0.0.1:11434</code> —
            Ollama
          </li>
        </ul>
        <p>
          Override via{" "}
          <code>--policy ./tripwire-policy.json</code> for private
          endpoints or watched-model lists.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Privacy posture</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            Bodies are <strong>local only</strong>. The cassette stays
            on disk; the dot summary carries only sanitised metadata.
          </li>
          <li>
            <strong>No SSL termination.</strong> TRIPWIRE is in-process
            — it sees the request before the http layer encrypts. We
            don't MITM.
          </li>
          <li>
            Notarization is opt-in. Pass <code>--notarize</code> only
            when you accept that cassette content becomes public on
            the Rekor log.
          </li>
        </ul>
      </section>
    </>
  );
}
