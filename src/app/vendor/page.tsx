// ---------------------------------------------------------------------------
// /vendor — Vendor Honesty Index
// ---------------------------------------------------------------------------
//
// Per-vendor live profile across all 11 Bureau programs. Every receipt
// that names a vendor (DRAGNET / OATH / FINGERPRINT / CUSTODY phrase-ID
// prefix; NUCLEI vendorScope tag; MOLE canaryUrl host) enriches that
// vendor's permanent URL.
//
// The keystone-game-changer: a permanent URL per vendor that the press,
// reg agencies, and Bureau practitioners can bookmark + cite. URLs do
// not move. New receipts append. Old receipts never disappear.
//
// Static-rendered against the curated allowlist in vendor-registry.ts.
// Every card links to /vendor/<slug>; unknown slugs 404 by way of the
// dynamic-route's notFound() gate.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { VENDOR_REGISTRY } from "../../lib/programs/vendor-registry";
import {
  getVendorPreview,
  lastUpdatedAt,
  PREVIEW_NOW,
} from "../../lib/programs/vendor-preview";
import {
  formatRelative,
  PreviewBanner,
  VerdictDots,
  VENDOR_PAGE_DESCRIPTION,
} from "./_ui";

export const metadata = {
  title: "Vendor Honesty Index — Pluck Studio",
  description:
    "Per-vendor live profile across all 11 Bureau programs. Every receipt that names a vendor enriches that vendor's permanent URL.",
};

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
};

const GridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 16,
  marginTop: 16,
  padding: 0,
  listStyle: "none",
};

const CardStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 20,
  background: "rgba(255, 255, 255, 0.02)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const CardLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

const VendorNameStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 18,
  letterSpacing: "0.04em",
  color: "var(--bureau-fg)",
};

const SlugStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
};

const DescriptionStyle: CSSProperties = {
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  lineHeight: 1.5,
  marginTop: 4,
};

const StatLineStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  marginTop: 8,
};

export default function VendorIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Vendor Honesty Index</h1>
        <p className="bureau-hero-tagline">{VENDOR_PAGE_DESCRIPTION}</p>
        <p
          style={{
            marginTop: 12,
            fontFamily: "var(--bureau-mono)",
            fontSize: 13,
            color: "var(--bureau-fg-dim)",
          }}
          data-testid="vendor-runs-cross-link"
        >
          By-program view: <a href="/runs">/runs →</a>
        </p>
      </section>

      <PreviewBanner />

      <section>
        <h2 style={SectionHeadingStyle}>
          Vendors ({VENDOR_REGISTRY.length})
        </h2>
        <p style={{ marginTop: 8 }}>
          Every Bureau program receipt that names one of these vendors
          flows into its permanent URL. Click through for the full
          per-program activity timeline.
        </p>
        <ul style={GridStyle} data-testid="vendor-index-grid">
          {VENDOR_REGISTRY.map((vendor) => {
            const preview = getVendorPreview(vendor.slug);
            const total = preview?.totalReceipts ?? 0;
            const updated = preview ? lastUpdatedAt(preview) : null;
            const updatedLabel =
              updated !== null ? formatRelative(updated, PREVIEW_NOW) : "no activity yet";

            return (
              <li key={vendor.slug}>
                <a
                  href={`/vendor/${vendor.slug}`}
                  style={CardLinkStyle}
                  data-testid={`vendor-card-${vendor.slug}`}
                >
                  <article style={CardStyle}>
                    <h3 style={VendorNameStyle}>{vendor.displayName}</h3>
                    <span style={SlugStyle}>/vendor/{vendor.slug}</span>
                    <p style={DescriptionStyle}>{vendor.description}</p>
                    {preview ? (
                      <VerdictDots breakdown={preview.verdictBreakdown} />
                    ) : null}
                    <p style={StatLineStyle}>
                      <strong>{total}</strong> receipts · last updated{" "}
                      {updatedLabel}
                    </p>
                  </article>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>How vendor profiles get built</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>DRAGNET / OATH / FINGERPRINT / CUSTODY</strong> —
            phrase-ID prefix encodes the vendor (
            <a href="/what-we-dont-know">/what-we-dont-know</a> for the
            full per-program convention).
          </li>
          <li>
            <strong>NUCLEI</strong> — packs tagged with{" "}
            <code>vendorScope</code> aggregate to that vendor's profile.
          </li>
          <li>
            <strong>MOLE</strong> — canaries bind to a published
            canaryUrl host; that host's vendor profile picks up the seal.
          </li>
          <li>
            <strong>WHISTLE / BOUNTY / ROTATE / TRIPWIRE / SBOM-AI</strong> —
            these programs deliberately do NOT carry vendor identity in
            their URL schemas (anonymity, machine-id, or artifact-kind
            invariants), so they don't feed vendor profiles.
          </li>
        </ul>
        <p
          style={{ marginTop: 24 }}
          data-testid="vendor-refuse-cross-link"
        >
          Read what we <em>refuse</em> to know about a vendor's operation —{" "}
          <a href="/what-we-dont-know">/what-we-dont-know</a>.
        </p>
      </section>
    </>
  );
}
