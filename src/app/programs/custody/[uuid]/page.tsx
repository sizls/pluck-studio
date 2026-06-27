// ---------------------------------------------------------------------------
// Pluck / CUSTODY / [uuid] – per-bundle public viewer
// ---------------------------------------------------------------------------
//
// Phase 6 alpha placeholder. Validates the uuid shape and renders the
// charter copy + the cosign verify command. Phase 6+ wires the Kite
// Event Log so a Rekor uuid notarized for predicate type
// `https://pluck.run/CustodyBundle/v1` resolves to a public bundle
// view here.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { notFound } from "next/navigation";

export const metadata = {
  title: "CUSTODY bundle — Pluck",
};

const SHA256_HEX = /^[0-9a-f]{64}$/;

const SectionHeadingStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default async function CustodyBundleViewerPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}): Promise<ReactNode> {
  const { uuid } = await params;
  const normalized = uuid.toLowerCase();
  if (!SHA256_HEX.test(normalized)) {
    notFound();
  }

  return (
    <>
      <section className="studio-hero">
        <h1
          className="studio-hero-title"
          style={{ fontFamily: "var(--studio-mono)", fontSize: 18 }}
        >
          {normalized}
        </h1>
        <p className="studio-hero-tagline">
          CustodyBundle/v1 — full DOM snapshot hash + every fetch
          envelopeHash + WebAuthn-bound operator identity + signed
          chain-of-custody chain.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Status</h2>
        <p>
          <em>
            No CustodyBundle/v1 attestations observed yet for this
            uuid.
          </em>
        </p>
        <p>
          Today's release ships the library, verifier, and
          drag-and-drop journalist surface at{" "}
          <a href="/programs/custody/verify">/programs/custody/verify</a>.
          A future cut wires the Kite Event Log so any Rekor entry
          posted with predicate type{" "}
          <code>https://pluck.run/CustodyBundle/v1</code> appears here
          within minutes.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verify locally</h2>
        <pre>
          <code>
            pluck custody verify &lt;bundle.json&gt; --json
          </code>
        </pre>
        <p>
          Verification gates: schema version 1, capture-spec validity
          (DOM snapshot hash, fetch events, browser fingerprint,
          system clock, WebAuthn-bound operator identity), chain
          length 1..256, genesis event is{" "}
          <code>kind: &quot;capture&quot;</code> with{" "}
          <code>prevEventHash: null</code>, every event signed by the
          operator's Ed25519 key, every event's eventId matching its
          canonical body hash, chainRootHash matching the recomputed
          canonical chain hash, FRE 902(13) WebAuthn binding gate.
        </p>
      </section>
    </>
  );
}
