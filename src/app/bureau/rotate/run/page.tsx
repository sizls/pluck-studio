import type { ReactNode } from "react";

import { RotateRunForm } from "./RunForm";

export const metadata = {
  title: "Rotate a key — ROTATE — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function RotateRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Rotate a key</h1>
        <p className="bureau-hero-tagline">
          Hand Studio your old + new SPKI fingerprints + a reason, and
          we orchestrate the full rotation: KeyRevocation/v1 signed by
          the old key, ReWitnessReport/v1 signed by the new key
          annotating every prior cassette, both anchored to Sigstore
          Rekor. Verifiers fail-closed against the compromise window.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Rotation parameters</h2>
        <RotateRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the rotate to the ROTATE runner. Today
            this is a stub — sign + re-witness + anchor wire up when
            <code> pluck-api /v1/rotate/revoke</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            scoped to the reason (e.g.{" "}
            <code>compromised-amber-otter-3742</code>) — surfaces the
            severity of the rotation in the URL itself.
          </li>
          <li>
            On <code>rotated</code>: green dot + KeyRevocation +
            ReWitnessReport + Rekor entries + count of annotated
            prior cassettes. On <code>old-key-already-revoked</code>:
            amber dot (idempotent — already done, no harm). On
            terminal failures: red dot + reason.
          </li>
        </ol>
      </section>
    </>
  );
}
