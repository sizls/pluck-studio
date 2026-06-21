// ---------------------------------------------------------------------------
// AlphaReceiptBanner — flags that the receipt is rendered from a stub backend
// ---------------------------------------------------------------------------
//
// Every per-program landing page advertises Sigstore Rekor anchoring +
// `cosign verify-blob` semantics. The /v1/runs surface that backs every
// receipt is an in-memory stub (see lib/v1/run-store.ts) — there is no
// transparency-log anchor yet. Without this banner, an operator who
// clicks the cosign command in the receipt's "How to verify" block gets
// nothing, and the receipt page is the surface that operators screenshot,
// quote, and forward.
//
// The fix is one of two postures (per STUDIO-AUDIT.md):
//   A. visible disclosure on the receipt (this component)
//   B. auto-promote receipt state to `anchored` once pluck-api ships
//
// Option A is the honest interim. The banner reads cool and intentional
// — operators get the production receipt UX, plus a clear note that the
// signing+transparency-log layer is the next thing to wire.
//
// Treatment: matches V1RunStatusBanner — muted text + dashed border, so
// it doesn't drown out the verdict colors below.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

const BannerStyle = {
  marginTop: 16,
  marginBottom: 16,
  padding: "10px 14px",
  fontFamily: "var(--studio-mono)",
  fontSize: 13,
  color: "var(--studio-fg-dim)",
  background: "transparent",
  border: "1px dashed var(--studio-fg-dim)",
  borderRadius: 4,
} as const;

const LabelStyle = {
  fontWeight: 600 as const,
  letterSpacing: "0.06em",
  textTransform: "uppercase" as const,
  marginRight: 8,
};

/**
 * Banner that explains the receipt is rendered from Studio's in-memory
 * stub store rather than a Rekor-anchored DSSE envelope. Renders the
 * same shape on every per-program receipt page so a returning operator
 * recognises the marker.
 */
export function AlphaReceiptBanner(): ReactNode {
  return (
    <div
      data-testid="alpha-receipt-banner"
      role="status"
      aria-live="polite"
      style={BannerStyle}
    >
      <span style={LabelStyle}>Alpha</span>
      This receipt is rendered from Studio&apos;s in-memory record. Sigstore
      Rekor anchoring + DSSE-envelope signing land with the next runner
      cut — the <code>cosign verify-blob</code> snippet below will resolve
      a real entry once pluck-api ships.
    </div>
  );
}
