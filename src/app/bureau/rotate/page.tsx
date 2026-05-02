// ---------------------------------------------------------------------------
// Bureau / ROTATE – program landing page
// ---------------------------------------------------------------------------
//
// Phase 1.5 alpha. Renders the trust-invalidation charter + a search
// box for "given a fingerprint, has it been revoked?". Phase 2+
// wires the Kite Event Log so the search resolves against ingested
// KeyRevocation/v1 entries.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "ROTATE — Pluck Bureau",
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

export default function RotateIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">ROTATE</h1>
        <p className="bureau-hero-tagline">
          Signing-key compromise response. When an Ed25519 operator
          key is compromised, ROTATE publishes a signed
          <code> KeyRevocation/v1</code> to Rekor; the bureau
          re-witnesses every prior cassette signed by that key under a
          "compromised" annotation; affected vendors get auto-broadcast
          notifications; press kits regenerate citing the compromise
          window.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Trust invalidation, NOT crypto-shred
        </h2>
        <p>
          A revocation does <strong>NOT</strong> remove signed Rekor
          entries from the public log — that's impossible against a
          public Merkle tree by design. ROTATE publishes <strong>NEW</strong>{" "}
          signed observations that live alongside the originals.
          Verifiers MUST consult the compromise ledger before trusting
          any historical signature from a revoked fingerprint.
        </p>
        <p>
          This is a feature, not a deficiency. Crypto-shred isn't
          possible against a public transparency log; pretending
          otherwise would damage the integrity claim every other Bureau
          program leans on.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Has this fingerprint been revoked?</h2>
        <p>
          Phase 1.5 ships local-only. Phase 2 wires the Kite Event Log
          so a fingerprint search resolves against ingested
          <code> KeyRevocation/v1</code> entries. For now, run the
          verifier against a Rekor uuid:
        </p>
        <pre>
          <code>
            pluck bureau rotate verify-rotation &lt;rekor-uuid&gt;
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verb surface</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>revoke</strong> — publish a KeyRevocation/v1 signed
            with the OLD key (proves operator owns it).
          </li>
          <li>
            <strong>re-witness</strong> — annotate target uuids against
            the revocation's compromise window. Signed by the NEW key.
          </li>
          <li>
            <strong>verify-rotation</strong> — fail-closed verification
            with stable reason codes.
          </li>
          <li>
            <strong>disclosure-rebuild</strong> — anchor a new
            <code> Disclosure/v1</code> chain to the previous one + the
            revocation that triggered the rebuild.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Compromise classifications</h2>
        <p>The re-witness pass classifies every target uuid:</p>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>before-revocation</strong> — votedAt strictly before
            <code> compromiseWindow.since</code>. Trust the inner
            signature.
          </li>
          <li>
            <strong>during-window</strong> — votedAt in
            <code> [since, until)</code>. <em>Compromised</em> — ignore
            the inner signature.
          </li>
          <li>
            <strong>after-replacement</strong> — votedAt at or after
            <code> until</code> but signed by the previous key anyway.
            <em> Compromised</em> — the new key should have signed.
          </li>
          <li>
            <strong>trust-but-flag</strong> — pre-window vote on a
            sensitive artifact (vendor Disclosure / operator key
            registration). Yellow flag, not red.
          </li>
        </ul>
      </section>
    </>
  );
}
