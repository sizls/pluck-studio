// ---------------------------------------------------------------------------
// Bureau / FINGERPRINT — Scan a model (third program activation)
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import { FingerprintRunForm } from "./RunForm";

export const metadata = {
  title: "Scan a target — FINGERPRINT — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function FingerprintRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Scan a target</h1>
        <p className="bureau-hero-tagline">
          Hand a vendor + model to Studio. We run a fixed 5-probe
          calibration set against the model API, produce a signed{" "}
          <code>ModelFingerprint/v1</code> cassette, and compare it to
          the prior scan to classify drift as{" "}
          <code>stable</code>, <code>minor</code>, <code>major</code>,
          or — when the fingerprint hash diverges entirely —{" "}
          <code>swap</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Scan parameters</h2>
        <FingerprintRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the scan to the FINGERPRINT runner.
            Today this is a stub —{" "}
            <code>pluck-api /v1/fingerprint/scan</code> wires the live
            transport when it ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID
            self-discloses the vendor in the URL slug.
          </li>
          <li>
            On <code>stable</code>: green dot, no drift. On{" "}
            <code>minor</code> / <code>major</code>: amber/red dot
            describing what changed. On <code>swap</code>: red dot +
            silent-swap public alert — the vendor changed the model
            without telling anyone.
          </li>
        </ol>
      </section>
    </>
  );
}
