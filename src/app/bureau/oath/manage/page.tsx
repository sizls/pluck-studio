// ---------------------------------------------------------------------------
// Bureau / OATH / manage – vendor management placeholder
// ---------------------------------------------------------------------------
//
// Phase 4 ships this as a placeholder. The full vendor-management UI
// (claim editor, expiresAt timeline, badge embeds) lands once Kite
// Event Log persistence is wired in Phase 4+.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "OATH — Manage — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function OathManagePage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">OATH — Manage</h1>
        <p className="bureau-hero-tagline">
          Vendor-side oath management. Phase 4 ships the CLI surface;
          this page becomes the in-browser editor once Kite Event Log
          persistence lands in Phase 4+.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>For now</h2>
        <p>Use the CLI:</p>
        <pre>
          <code>
            pluck bureau oath publish ./oath.json --keys ./keys --out
            ./.oath{"\n"}
            # Then host ./.oath/&lt;hash&gt;.intoto.jsonl at{"\n"}
            # https://&lt;vendor&gt;/.well-known/pluck-oath.json
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Coming next</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>Claim editor with built-in predicate-kind validation</li>
          <li>Expiry timeline + republish reminder</li>
          <li>Badge embed snippets (HTML / SVG / JSON)</li>
          <li>Auth-gated key rotation flow (uses ROTATE)</li>
        </ul>
      </section>
    </>
  );
}
