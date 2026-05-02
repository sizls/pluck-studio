// ---------------------------------------------------------------------------
// Bureau / ACOUSTIC-SCRIBE – program landing page
// ---------------------------------------------------------------------------
//
// Phase 9 alpha. Keystroke + coil-whine workload recovery with attested
// capture. Composes Pluck's existing FFT / MFCC / Goertzel DSP
// primitives + Bureau core attest + device-acoustic-fingerprint into
// court-admissible chain-of-custody for any captured workload
// signature.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "ACOUSTIC-SCRIBE — Pluck Bureau",
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

export default function AcousticScribeIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">ACOUSTIC-SCRIBE</h1>
        <p className="bureau-hero-tagline">
          The chain-of-custody for sound. Every capture is bound to its
          capture-time, location, and the acoustic fingerprint of the
          recorder. Keystroke cadence and coil-whine workload class
          ride as separately-signed predicates. We promise{" "}
          <em>tamper-evident observation</em> — not 95% recovery
          accuracy.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Phase 9 alpha
        </h2>
        <p>
          In-process JS-layer capture (PCM buffers + WAV files) ships
          in Phase 9. Live microphone streaming + native audio device
          enumeration land in Phase 9.5 — same pattern as TRIPWIRE
          Phase 2 vs 2.5.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Characterize a recording device</h2>
        <pre>
          <code>
            pluck bureau acoustic-scribe fingerprint-device
            ./calibration.wav \{"\n"}{" "}
            --keys ./keys --out ./device.fp.json
          </code>
        </pre>
        <p>
          One-time per recorder. The 32-bin log-spaced frequency
          response + noise-floor RMS fold into the canonical
          fingerprint sha256.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Capture + sign</h2>
        <pre>
          <code>
            pluck bureau acoustic-scribe capture ./session.wav \{"\n"}{" "}
            --keys ./keys --device-fingerprint ./device.fp.json \{"\n"}{" "}
            --location 40.7128,-74.0060 --device-name lab-mic-1 \{"\n"}{" "}
            --out ./bundles
          </code>
        </pre>
        <p>
          Refuses to emit a capture without a device fingerprint.
          Refuses to notarize to the public Rekor without
          <code> --accept-public</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Recover keystroke cadence</h2>
        <pre>
          <code>
            pluck bureau acoustic-scribe keystroke-scan
            ./bundles/abc.bundle.json \{"\n"}{" "}
            --wav ./session.wav --keys ./keys --out ./bundles
          </code>
        </pre>
        <p>
          Research-grade detector — short-time spectral flux + adaptive
          threshold + 30 ms debounce. Operators wire their own
          per-character classifier via the <code>classify</code>
          callback.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Classify coil-whine workload</h2>
        <pre>
          <code>
            pluck bureau acoustic-scribe workload-scan
            ./bundles/abc.bundle.json \{"\n"}{" "}
            --wav ./session.wav --keys ./keys \{"\n"}{" "}
            --baseline ./bundles/idle.bundle.json --baseline-wav
            ./idle.wav
          </code>
        </pre>
        <p>
          Synthetic baseline corpus ships with three classes
          (<code>idle</code>, <code>gemm</code>,{" "}
          <code>attention</code>). Real-world classification requires
          operator characterization of their hardware.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URIs</h2>
        <pre>
          <code>
            https://pluck.run/AcousticScribe/v1{"\n"}
            https://pluck.run/AcousticScribe.KeystrokeCandidate/v1{"\n"}
            https://pluck.run/AcousticScribe.CoilWhineWorkload/v1{"\n"}
            https://pluck.run/AcousticScribe.DeviceFingerprint/v1
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Trust model</h2>
        <p>
          Every cassette is signed by the OPERATOR — they record what
          the operator observed, not what a vendor or downstream
          analyst claims. Verifiers run{" "}
          <code>cosign verify-attestation</code> offline against the
          persisted <code>&lt;envelopeHash&gt;.intoto.jsonl</code>;
          downstream consumers decide whether the cadence + candidate
          distribution is admissible.
        </p>
      </section>
    </>
  );
}
