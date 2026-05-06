// ---------------------------------------------------------------------------
// /diff — Receipt Diff index
// ---------------------------------------------------------------------------
// Naked /diff URL. Explains the diff and links to a same-vendor sample
// + a rejected cross-vendor sample so operators can see both shapes.
// /diff/<phrase>?since=... is where the actual diff happens.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { sampleCrossVendorPair, sampleDiffPair } from "../../lib/diff/receipt-diff.js";

const DESC = "Receipt Diff index — paste two phrase IDs to compare cycles of one vendor.";

export const metadata: Metadata = {
  title: "Diff — Pluck Studio",
  description: DESC,
  openGraph: { title: "Diff — Pluck Studio", description: DESC, type: "website" },
};

const S: Record<string, CSSProperties> = {
  header: { borderBottom: "1px solid var(--bureau-fg-dim)", paddingBottom: 16, marginBottom: 24 },
  h2: { fontFamily: "var(--bureau-mono)", fontSize: 13, color: "var(--bureau-fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 32, marginBottom: 12 },
  sample: { border: "1px solid var(--bureau-fg-dim)", borderRadius: 6, padding: 16, background: "rgba(255, 255, 255, 0.02)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, textDecoration: "none", color: "inherit", fontFamily: "var(--bureau-mono)", fontSize: 13, marginTop: 12 },
};

export default function DiffIndexPage(): ReactNode {
  const sample = sampleDiffPair();
  const cross = sampleCrossVendorPair();

  return (
    <main data-testid="diff-index" style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px 64px" }}>
      <header style={S.header}>
        <h1 style={{ fontFamily: "var(--bureau-mono)", fontSize: 28, margin: 0 }}>Receipt Diff</h1>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          Two cycles. One vendor. Side by side. Vendor-honesty time machine.
        </p>
      </header>

      <h2 style={S.h2}>How it works</h2>
      <p style={{ lineHeight: 1.7 }}>
        Open <code>/diff/&lt;base-phrase-id&gt;?since=&lt;target-phrase-id&gt;</code> to compare
        two cycles of the same vendor. Path param = BASE; <code>?since=</code> = TARGET.
        Both must share the same scope; cross-vendor diffs are rejected with copy.
      </p>

      <h2 style={S.h2}>Try a same-vendor sample</h2>
      <a href={`/diff/${sample.base}?since=${sample.target}`} style={S.sample} data-testid="diff-index-sample-link">
        <span>/diff/{sample.base}?since={sample.target}</span>
        <span style={{ color: "var(--bureau-fg-dim)" }}>→ diff</span>
      </a>

      <h2 style={S.h2}>Try a cross-vendor sample (rejected)</h2>
      <a href={`/diff/${cross.base}?since=${cross.target}`} style={S.sample} data-testid="diff-index-cross-vendor-sample-link">
        <span>/diff/{cross.base}?since={cross.target}</span>
        <span style={{ color: "var(--bureau-fg-dim)" }}>→ rejected</span>
      </a>

      <h2 style={S.h2}>Find phrase IDs</h2>
      <p style={{ lineHeight: 1.7 }}>
        Browse <a href="/search">/search</a> for phrase IDs by scope, or pick a vendor at{" "}
        <a href="/vendor">/vendor</a>. Every receipt page surfaces a "Compare with another cycle" CTA.
      </p>
    </main>
  );
}
