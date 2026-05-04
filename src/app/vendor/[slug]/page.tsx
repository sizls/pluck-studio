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

import { ACTIVE_PROGRAMS } from "../../../lib/programs/registry";
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
  };
}

const PROGRAM_ACCENT: Readonly<Record<VendorProgramSlug, string>> = {
  dragnet: "#a3201d",
  oath: "#d4a017",
  fingerprint: "#5a8fbf",
  custody: "#7c5fa3",
  nuclei: "#3a8a5a",
  mole: "#9a6a4a",
};

const PROGRAM_LABEL: Readonly<Record<VendorProgramSlug, string>> = {
  dragnet: "DRAGNET",
  oath: "OATH",
  fingerprint: "FINGERPRINT",
  custody: "CUSTODY",
  nuclei: "NUCLEI",
  mole: "MOLE",
};

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

const ReceiptRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto auto 1fr auto",
  alignItems: "center",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  fontSize: 13,
  lineHeight: 1.5,
};

const PhraseIdStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  color: "var(--bureau-fg)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const RelativeTimeStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
  whiteSpace: "nowrap",
};

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
  return (
    <li
      style={ReceiptRowStyle}
      data-testid={`vendor-receipt-${receipt.phraseId}`}
    >
      <VerdictDot verdict={receipt.verdict} />
      <a href={receiptUrl(programSlug, receipt.phraseId)} style={PhraseIdStyle}>
        {receipt.phraseId}
      </a>
      <span>{receipt.summary}</span>
      <span style={RelativeTimeStyle}>
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
      <VendorHeader vendor={vendor} activity={activity} />

      <PreviewBanner />

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
          data-testid="vendor-subscribe-link"
        >
          Subscribe (feed.xml)
        </a>
        <span>— per-vendor RSS feed lands with the Subscription Feed program.</span>
      </div>
    </>
  );
}
