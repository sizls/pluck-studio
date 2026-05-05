// ---------------------------------------------------------------------------
// /vendor/[slug] — Per-vendor honesty profile
// ---------------------------------------------------------------------------
//
// Dynamic route, server-rendered. `generateStaticParams()` returns the
// curated vendor allowlist, so every known vendor is statically
// pre-rendered at build time. Unknown slug → notFound() → 404.
//
// Layout:
//   1. Header — display name, slug, 1-line description, breakdown
//   2. Per-program sections — one per program with vendor activity
//   3. Receipt rows — verdict-color dot + phraseId + summary + time,
//      linking out to the canonical receipt URL on the program route.
//
// The opengraph-image route at ./opengraph-image.tsx auto-renders the
// 1200×630 social card with the vendor name + verdict bars; every paste
// of /vendor/<slug> in Slack / X / Discord / iMessage auto-unfurls.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";

import { PhraseSigil } from "../../../components/bureau-ui/PhraseSigil";
import { VerdictBadge } from "../../../components/bureau-ui/VerdictBadge";
import {
  ACTIVE_PROGRAMS,
  VENDOR_BEARING_PROGRAMS,
} from "../../../lib/programs/registry";
import { verdictToBadgeVariant } from "../../../lib/programs/verdict-mapping";
import {
  listVendorSlugs,
  lookupVendor,
  type VendorEntry,
} from "../../../lib/programs/vendor-registry";
import {
  getVendorPreview,
  lastUpdatedAt,
  PREVIEW_NOW,
  type VendorPreviewActivity,
  type VendorProgramActivity,
  type VendorProgramSlug,
  type VendorReceipt,
} from "../../../lib/programs/vendor-preview";
import {
  formatRelative,
  PreviewBanner,
  VerdictDots,
  VERDICT_COLORS,
} from "../_ui";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listVendorSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const vendor = lookupVendor(slug);

  if (vendor === null) {
    return {
      title: "Unknown vendor — Pluck Studio",
    };
  }
  const title = `${vendor.displayName} — Pluck Honesty Profile`;
  const description = vendor.description;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "profile",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    // RSS reader auto-discovery — every vendor profile advertises its
    // Atom feed via <link rel="alternate" type="application/atom+xml">
    // in the document head.
    alternates: {
      types: {
        "application/atom+xml": [
          {
            url: `/vendor/${vendor.slug}/feed.xml`,
            title: `${vendor.displayName} — Pluck activity feed`,
          },
        ],
      },
    },
  };
}

// Registry-derived: PROGRAM_ACCENT / PROGRAM_LABEL / PROGRAM_ORDER all
// flow from `VENDOR_BEARING_PROGRAMS` in registry.ts. Adding a new
// vendor-bearing program is a one-line registry change — the VHI
// auto-picks it up.

const PROGRAM_ACCENT: Readonly<Record<VendorProgramSlug, string>> =
  Object.freeze(
    Object.fromEntries(
      VENDOR_BEARING_PROGRAMS.map((p) => [p.slug, p.accent]),
    ) as Record<VendorProgramSlug, string>,
  );

const PROGRAM_LABEL: Readonly<Record<VendorProgramSlug, string>> =
  Object.freeze(
    Object.fromEntries(
      VENDOR_BEARING_PROGRAMS.map((p) => [p.slug, p.name]),
    ) as Record<VendorProgramSlug, string>,
  );

const HeaderStyle: CSSProperties = {
  borderBottom: "1px solid var(--bureau-fg-dim)",
  paddingBottom: 24,
  marginBottom: 32,
};

const VendorNameStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 36,
  fontWeight: 700,
  letterSpacing: "0.02em",
  margin: 0,
};

const SlugLineStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  marginTop: 8,
};

const DescriptionStyle: CSSProperties = {
  marginTop: 16,
  lineHeight: 1.6,
};

const BreakdownStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 24,
  marginTop: 16,
  flexWrap: "wrap",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
};

const ProgramSectionStyle: CSSProperties = {
  marginTop: 32,
};

const ProgramHeadingStyle = (slug: VendorProgramSlug): CSSProperties => ({
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: PROGRAM_ACCENT[slug],
  borderLeft: `3px solid ${PROGRAM_ACCENT[slug]}`,
  paddingLeft: 12,
  marginBottom: 12,
});

const ReceiptListStyle: CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
};

// Receipt row uses a class so a media query can stack the row at narrow
// widths — at 375px the phraseId + summary + relative-time horizontal
// layout overflows. Server-rendered <style> block (below) carries the
// `@media (max-width: 720px)` override.
const RECEIPT_ROW_CLASS = "vendor-receipt-row";
const RECEIPT_PHRASE_CLASS = "vendor-receipt-phrase";
const RECEIPT_SUMMARY_CLASS = "vendor-receipt-summary";
const RECEIPT_TIME_CLASS = "vendor-receipt-time";

const RESPONSIVE_RECEIPT_CSS = `
.${RECEIPT_ROW_CLASS} {
  display: grid;
  grid-template-columns: auto auto auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  line-height: 1.5;
}
.${RECEIPT_PHRASE_CLASS} {
  font-family: var(--bureau-mono);
  font-size: 12px;
  color: var(--bureau-fg);
  text-decoration: none;
  white-space: nowrap;
}
.${RECEIPT_SUMMARY_CLASS} {
  min-width: 0;
}
.${RECEIPT_TIME_CLASS} {
  font-family: var(--bureau-mono);
  font-size: 11px;
  color: var(--bureau-fg-dim);
  white-space: nowrap;
}
@media (max-width: 720px) {
  .${RECEIPT_ROW_CLASS} {
    grid-template-columns: auto auto 1fr;
    grid-template-areas:
      "dot sigil phrase"
      "dot sigil summary"
      "dot sigil time";
    column-gap: 12px;
    row-gap: 4px;
  }
  .${RECEIPT_ROW_CLASS} > [data-slot="dot"] { grid-area: dot; align-self: start; margin-top: 6px; }
  .${RECEIPT_ROW_CLASS} > [data-slot="sigil"] { grid-area: sigil; align-self: start; }
  .${RECEIPT_ROW_CLASS} > [data-slot="phrase"] { grid-area: phrase; }
  .${RECEIPT_ROW_CLASS} > [data-slot="summary"] { grid-area: summary; white-space: normal; word-break: break-word; }
  .${RECEIPT_ROW_CLASS} > [data-slot="time"] { grid-area: time; }
  .${RECEIPT_PHRASE_CLASS} { white-space: normal; word-break: break-all; }
}
`;

const SubscribeRowStyle: CSSProperties = {
  marginTop: 32,
  paddingTop: 16,
  borderTop: "1px solid var(--bureau-fg-dim)",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  alignItems: "center",
};

function programRunPath(programSlug: VendorProgramSlug): string {
  const entry = ACTIVE_PROGRAMS.find((p) => p.slug === programSlug);

  return entry?.landingPath ?? `/bureau/${programSlug}`;
}

function receiptUrl(programSlug: VendorProgramSlug, phraseId: string): string {
  return `/bureau/${programSlug}/runs/${phraseId}`;
}

function VerdictDot({ verdict }: { verdict: VendorReceipt["verdict"] }): ReactNode {
  return (
    <span
      aria-label={`verdict ${verdict}`}
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: VERDICT_COLORS[verdict],
      }}
    />
  );
}

function ReceiptRow({
  programSlug,
  receipt,
}: {
  programSlug: VendorProgramSlug;
  receipt: VendorReceipt;
}): ReactNode {
  const badgeVariant = verdictToBadgeVariant(programSlug, receipt.verdict);

  return (
    <li
      className={RECEIPT_ROW_CLASS}
      data-testid={`vendor-receipt-${receipt.phraseId}`}
    >
      <span data-slot="dot" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <VerdictDot verdict={receipt.verdict} />
        {badgeVariant ? <VerdictBadge variant={badgeVariant} size="sm" /> : null}
      </span>
      <span data-slot="sigil">
        <PhraseSigil
          phraseId={receipt.phraseId}
          programAccent={PROGRAM_ACCENT[programSlug]}
          size={40}
        />
      </span>
      <a
        data-slot="phrase"
        className={RECEIPT_PHRASE_CLASS}
        href={receiptUrl(programSlug, receipt.phraseId)}
      >
        {receipt.phraseId}
      </a>
      <span data-slot="summary" className={RECEIPT_SUMMARY_CLASS}>
        {receipt.summary}
      </span>
      <span data-slot="time" className={RECEIPT_TIME_CLASS}>
        {formatRelative(receipt.capturedAt, PREVIEW_NOW)}
      </span>
    </li>
  );
}

function ProgramSection({
  activity,
}: {
  activity: VendorProgramActivity;
}): ReactNode {
  return (
    <section
      style={ProgramSectionStyle}
      data-testid="vendor-profile-program-section"
      data-program={activity.programSlug}
    >
      <h2 style={ProgramHeadingStyle(activity.programSlug)}>
        <a
          href={programRunPath(activity.programSlug)}
          style={{ color: "inherit", textDecoration: "none" }}
        >
          {PROGRAM_LABEL[activity.programSlug]} ({activity.receipts.length})
        </a>
      </h2>
      <ul style={ReceiptListStyle}>
        {activity.receipts.map((receipt) => (
          <ReceiptRow
            key={receipt.phraseId}
            programSlug={activity.programSlug}
            receipt={receipt}
          />
        ))}
      </ul>
    </section>
  );
}

function VendorHeader({
  vendor,
  activity,
}: {
  vendor: VendorEntry;
  activity: VendorPreviewActivity | null;
}): ReactNode {
  const updated = activity ? lastUpdatedAt(activity) : null;
  const breakdown = activity?.verdictBreakdown ?? {
    green: 0,
    amber: 0,
    red: 0,
    gray: 0,
  };

  return (
    <header style={HeaderStyle} data-testid="vendor-profile-header">
      <h1 style={VendorNameStyle}>{vendor.displayName}</h1>
      <p style={SlugLineStyle}>/vendor/{vendor.slug}</p>
      <p style={DescriptionStyle}>{vendor.description}</p>
      <div style={BreakdownStyle}>
        <span>
          <strong>{activity?.totalReceipts ?? 0}</strong> total receipts
        </span>
        <span>
          <span style={{ color: VERDICT_COLORS.green }}>●</span>{" "}
          <strong>{breakdown.green}</strong> green
        </span>
        <span>
          <span style={{ color: VERDICT_COLORS.amber }}>●</span>{" "}
          <strong>{breakdown.amber}</strong> amber
        </span>
        <span>
          <span style={{ color: VERDICT_COLORS.red }}>●</span>{" "}
          <strong>{breakdown.red}</strong> red
        </span>
        {breakdown.gray > 0 ? (
          <span>
            <span style={{ color: VERDICT_COLORS.gray }}>●</span>{" "}
            <strong>{breakdown.gray}</strong> gray
          </span>
        ) : null}
        <span>
          last updated{" "}
          {updated !== null ? formatRelative(updated, PREVIEW_NOW) : "—"}
        </span>
      </div>
      <div style={{ marginTop: 16 }}>
        <VerdictDots breakdown={breakdown} />
      </div>
    </header>
  );
}

export default async function VendorProfilePage({
  params,
}: PageProps): Promise<ReactNode> {
  const { slug } = await params;
  const vendor = lookupVendor(slug);

  if (vendor === null) {
    notFound();
  }
  const activity = getVendorPreview(vendor.slug);

  return (
    <>
      <style
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static CSS string with no user input
        dangerouslySetInnerHTML={{ __html: RESPONSIVE_RECEIPT_CSS }}
      />
      {/* PreviewBanner sits ABOVE the header so a screenshot of the
          header alone cannot be misread as published verdict telemetry. */}
      <PreviewBanner />

      <VendorHeader vendor={vendor} activity={activity} />

      {activity === null || activity.programs.length === 0 ? (
        <p style={{ marginTop: 24 }} data-testid="vendor-profile-empty">
          No vendor-bearing receipts have landed for{" "}
          <strong>{vendor.displayName}</strong> yet. When DRAGNET probe
          packs, OATH verifications, FINGERPRINT calibrations, CUSTODY
          bundles, NUCLEI vendor-scoped packs, or MOLE canaries land for
          this vendor, they appear here.
        </p>
      ) : (
        activity.programs.map((programActivity) => (
          <ProgramSection
            key={programActivity.programSlug}
            activity={programActivity}
          />
        ))
      )}

      <div style={SubscribeRowStyle}>
        <a
          href={`/vendor/${vendor.slug}/feed.xml`}
          data-testid="vendor-feed-link"
          rel="alternate"
          type="application/atom+xml"
        >
          Subscribe to feed
        </a>
        <span>— Atom 1.0; new receipts ride RSS readers.</span>
      </div>
    </>
  );
}
