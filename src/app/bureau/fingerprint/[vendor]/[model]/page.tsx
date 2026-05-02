// ---------------------------------------------------------------------------
// Bureau / FINGERPRINT / [vendor] / [model] – fingerprint history viewer
// ---------------------------------------------------------------------------
//
// Phase 4 alpha. Shows a per-target fingerprint timeline once the
// studio reads cassettes back out of the Kite Event Log. Today the
// page renders a placeholder + the canonical CLI command set.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

interface PageProps {
  params: Promise<{ vendor: string; model: string }>;
}

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export async function generateMetadata({ params }: PageProps) {
  const { vendor, model } = await params;
  return {
    title: `${vendor}/${model} — FINGERPRINT — Pluck Bureau`,
  };
}

export default async function FingerprintTargetPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { vendor, model } = await params;
  const safeVendor = sanitiseId(vendor);
  const safeModel = sanitiseId(model);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">
          {safeVendor}/{safeModel}
        </h1>
        <p className="bureau-hero-tagline">
          Fingerprint history for <code>{safeVendor}/{safeModel}</code>.
          Each scan emits a signed <code>ModelFingerprint/v1</code>{" "}
          cassette; deltas between consecutive scans surface silent
          model swaps.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Scan</h2>
        <pre>
          <code>
            pluck bureau fingerprint scan --vendor {safeVendor} --model{" "}
            {safeModel} \{"\n"}{" "}
            --keys ./keys --responder ./responder.js --out ./.fp
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Pin a baseline</h2>
        <pre>
          <code>
            pluck bureau fingerprint baseline {safeVendor}-{safeModel}
            -2026-04 \{"\n"} --rekor-uuid &lt;64-hex&gt;
          </code>
        </pre>
        <p>
          Baselines stay local. They make subsequent <code>delta</code>{" "}
          calls ergonomic — point the from-side at the baseline name
          and the to-side at a fresh scan.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Drift legend</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>stable</strong> — fingerprint hash unchanged
          </li>
          <li>
            <strong>minor</strong> — 1-2 probes drifted (likely sampling
            wobble)
          </li>
          <li>
            <strong>major</strong> — 3+ probes drifted (likely model
            checkpoint update)
          </li>
          <li>
            <strong>swap</strong> — fingerprint hash differs and &gt;50%
            of probes drifted (silent vendor swap)
          </li>
        </ul>
      </section>
    </>
  );
}

function sanitiseId(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 128) {
    return "(unknown)";
  }
  if (raw.includes("..")) {
    return "(unknown)";
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(raw)) {
    return "(unknown)";
  }

  return raw;
}
