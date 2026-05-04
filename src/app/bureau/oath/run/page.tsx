// ---------------------------------------------------------------------------
// Bureau / OATH — Run an OATH check (v2 generalization entry point)
// ---------------------------------------------------------------------------
//
// Second program activated through Studio. Uses the same shared
// bureau-ui/forms primitives + a sibling Directive module
// (`oathRunFormModule`) — proves the v1 plan's "wire OATH same way to
// prove generalizability" promise.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import { OathRunForm } from "./RunForm";

export const metadata = {
  title: "Run an OATH check — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function OathRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Run an OATH check</h1>
        <p className="bureau-hero-tagline">
          Hand a vendor domain to Studio. We fetch{" "}
          <code>https://{`{domain}`}/.well-known/pluck-oath.json</code>,
          verify the DSSE envelope, cross-check the served Origin
          against the body's <code>vendor</code> field, and emit a
          publicly-verifiable verdict.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification parameters</h2>
        <OathRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the verify to the OATH runner. Today this
            is a stub — fetch + DSSE verify wire up when{" "}
            <code>pluck-api /v1/oath/verify</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            vendor-scoped (e.g. <code>openai-amber-otter-3742</code>) so
            the URL self-discloses the target.
          </li>
          <li>
            On verified: the receipt shows the signed claim list, the
            signer fingerprint, and the expiry. On any failure: the
            verdict (signature-failed / origin-mismatch / expired /
            not-found / fetch-failed) plus diagnostic detail.
          </li>
        </ol>
      </section>
    </>
  );
}
