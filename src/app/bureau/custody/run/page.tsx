// ---------------------------------------------------------------------------
// Bureau / CUSTODY — Verify a bundle by URL (server-signed receipt path)
// ---------------------------------------------------------------------------
//
// Sibling to /bureau/custody/verify (journalist drag-and-drop, pure
// client-side, no signed receipt). This route fetches + verifies a
// bundle URL server-side and emits an FRE 902(13) compliance verdict
// anchored in the Sigstore Rekor transparency log — the receipt URL is the operator's
// permanent, shareable, court-admissible artifact.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import { CustodyRunForm } from "./RunForm";

export const metadata = {
  title: "Verify a bundle — CUSTODY — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function CustodyRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Verify a bundle</h1>
        <p className="bureau-hero-tagline">
          Hand a CustodyBundle URL to Studio. We fetch it server-side
          (HTTPS-only, ≤ 256 KiB, 10s timeout, no redirects), run the
          full FRE 902(13) verifier (signature, DOM-hash, cassette
          hashes, WebAuthn binding, schema, monotonic timestamps,
          envelope TTL), and emit a signed Rekor-anchored verdict.
        </p>
        <p className="bureau-hero-tagline" style={{ marginTop: 12 }}>
          For a journalist's offline check (no network round-trip, no
          signed receipt), drop the bundle JSON onto{" "}
          <a href="/bureau/custody/verify">
            <code>/bureau/custody/verify</code>
          </a>
          .
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification parameters</h2>
        <CustodyRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the verify to the CUSTODY runner. Today
            this is a stub — fetch + DSSE verify + WebAuthn check wire
            up when <code>pluck-api /v1/custody/verify</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            vendor-scoped (e.g. <code>openai-amber-otter-3742</code>)
            so the URL self-discloses the asserted target.
          </li>
          <li>
            On <code>compliant</code>: green dot + Rekor entry +
            offline-verifiable cassette. On any failure verdict
            (<code>webauthn-missing</code>,{" "}
            <code>signature-invalid</code>,{" "}
            <code>dom-hash-mismatch</code>, …): red dot + per-check
            breakdown so an attorney can map straight to admissibility
            arguments.
          </li>
        </ol>
      </section>
    </>
  );
}
