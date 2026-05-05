// ---------------------------------------------------------------------------
// /vendor/[slug]/feed.xml — Per-vendor Atom 1.0 subscription feed
// ---------------------------------------------------------------------------
//
// Free passive distribution. Journalists subscribe to
// `/vendor/openai/feed.xml` in their RSS reader; every new receipt
// against OpenAI lands in their inbox. Tweet:
//   "Subscribe to openai's pluck feed in your RSS reader.
//    New red dot in your inbox."
//
// Architecture mirrors `/vendor/[slug]/page.tsx`:
//   - Curated vendor allowlist (10 vendors today). Unknown slug → 404.
//   - `getVendorPreview(slug)` produces the same activity table the page
//     renders. When pluck-api `/v1/runs` lands, the underlying source
//     swaps and this route requires no change.
//
// SECURITY POSTURE
//   - PUBLIC READ — the vendor profile page is public, so its feed is
//     too. No auth gate.
//   - PRIVACY REDACTION — every emitted entry's payload routes through
//     `redactPayloadForGet(pipeline, payload)`. The preview data has no
//     payload-carrying fields today, but the boundary call is permanent
//     defense-in-depth: if a future preview/feed source carries a
//     WHISTLE bundleUrl or ROTATE operatorNote, the feed must NEVER
//     echo it. Same posture as `GET /api/v1/runs/[id]`.
//   - HTML-ESCAPE every user-supplied string (titles, summaries, URLs)
//     before splicing into the XML output. Belt-and-suspenders against
//     any character that drifted through preview data.
//
// XML STRATEGY
//   - Build the Atom string by hand. Atom is small + concrete; pulling
//     in an XML library would be more risk than the escape table.
//   - Escapes table: `&` `<` `>` `"` `'` for text + attribute content.
//
// CACHING
//   - `Cache-Control: public, max-age=300` — typical RSS reader poll
//     interval is 5–60min; 5min keeps the feed fresh without inviting
//     stampede.
//   - `X-Content-Type-Options: nosniff` — atom+xml is the contract.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { notFound } from "next/navigation";

import {
  listVendorSlugs,
  lookupVendor,
} from "../../../../lib/programs/vendor-registry";
import {
  getVendorPreview,
  type VendorProgramSlug,
  type VendorReceipt,
} from "../../../../lib/programs/vendor-preview";
import { ACTIVE_PROGRAMS } from "../../../../lib/programs/registry";
import { redactPayloadForGet } from "../../../../lib/v1/redact";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "https://studio.pluck.run";

const FEED_AUTHOR_NAME = "Pluck Studio";

const FEED_SUBTITLE =
  "Per-vendor receipts across DRAGNET, OATH, FINGERPRINT, CUSTODY, NUCLEI, MOLE programs.";

// Map vendor-bearing program slug → bureau pipeline string used by the
// redactor. The redactor itself returns PASS_THROUGH for anything not
// in the table, but we want to use the official pipeline identifier so
// future per-program redactors are picked up automatically.
const PROGRAM_TO_PIPELINE: Readonly<Record<VendorProgramSlug, string>> =
  Object.freeze({
    dragnet: "bureau:dragnet",
    oath: "bureau:oath",
    fingerprint: "bureau:fingerprint",
    custody: "bureau:custody",
    nuclei: "bureau:nuclei",
    mole: "bureau:mole",
  });

const PROGRAM_LABEL: Readonly<Record<VendorProgramSlug, string>> = Object.freeze(
  Object.fromEntries(
    ACTIVE_PROGRAMS.filter((p) =>
      Object.hasOwn(PROGRAM_TO_PIPELINE, p.slug),
    ).map((p) => [p.slug, p.name]),
  ) as Record<VendorProgramSlug, string>,
);

// ---------------------------------------------------------------------------
// Static params — pre-render the curated allowlist at build time
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams(): Array<{ slug: string }> {
  return listVendorSlugs().map((slug) => ({ slug }));
}

// ---------------------------------------------------------------------------
// XML escape — text + attribute content
// ---------------------------------------------------------------------------

const XML_ESCAPE_MAP: Readonly<Record<string, string>> = Object.freeze({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
});

function xmlEscape(input: string): string {
  return input.replace(/[&<>"']/g, (c) => XML_ESCAPE_MAP[c] ?? c);
}

// ---------------------------------------------------------------------------
// URL builders
// ---------------------------------------------------------------------------

function vendorPageUrl(slug: string): string {
  return `${BASE_URL}/vendor/${slug}`;
}

function feedUrl(slug: string): string {
  return `${BASE_URL}/vendor/${slug}/feed.xml`;
}

function receiptUrl(programSlug: VendorProgramSlug, phraseId: string): string {
  return `${BASE_URL}/bureau/${programSlug}/runs/${phraseId}`;
}

// ---------------------------------------------------------------------------
// Receipt → Atom <entry> rendering (with redaction)
// ---------------------------------------------------------------------------

interface FlattenedReceipt {
  readonly programSlug: VendorProgramSlug;
  readonly phraseId: string;
  readonly capturedAt: Date;
  readonly summary: string;
}

function flattenReceipts(
  programs: ReadonlyArray<{
    readonly programSlug: VendorProgramSlug;
    readonly receipts: ReadonlyArray<VendorReceipt>;
  }>,
): FlattenedReceipt[] {
  const out: FlattenedReceipt[] = [];

  for (const program of programs) {
    for (const receipt of program.receipts) {
      // PRIVACY REDACTION at the feed boundary. The preview data carries
      // only `summary` today, but route every field through the program's
      // GET-side redactor so any future payload addition is automatically
      // stripped before XML emission.
      const pipeline = PROGRAM_TO_PIPELINE[program.programSlug];
      const safe = redactPayloadForGet(pipeline, {
        summary: receipt.summary,
      });
      const safeSummary =
        typeof safe.summary === "string" ? safe.summary : receipt.summary;

      out.push({
        programSlug: program.programSlug,
        phraseId: receipt.phraseId,
        capturedAt: receipt.capturedAt,
        summary: safeSummary,
      });
    }
  }

  // Newest first across the whole feed — Atom convention.
  out.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

  return out;
}

function renderEntry(entry: FlattenedReceipt): string {
  const link = receiptUrl(entry.programSlug, entry.phraseId);
  const programLabel = PROGRAM_LABEL[entry.programSlug] ?? entry.programSlug;
  const title = `${programLabel} — ${entry.summary}`;
  const ts = entry.capturedAt.toISOString();

  return [
    "  <entry>",
    `    <id>${xmlEscape(link)}</id>`,
    `    <title>${xmlEscape(title)}</title>`,
    `    <link href="${xmlEscape(link)}" />`,
    `    <updated>${ts}</updated>`,
    `    <published>${ts}</published>`,
    "    <author><name>" + xmlEscape(FEED_AUTHOR_NAME) + "</name></author>",
    `    <summary>${xmlEscape(entry.summary)}</summary>`,
    "  </entry>",
  ].join("\n");
}

function renderFeed(
  vendorSlug: string,
  vendorDisplayName: string,
  entries: ReadonlyArray<FlattenedReceipt>,
): string {
  const self = feedUrl(vendorSlug);
  const alternate = vendorPageUrl(vendorSlug);
  const title = `Pluck Studio — ${vendorDisplayName} activity`;
  const updated =
    entries.length > 0
      ? entries[0]!.capturedAt.toISOString()
      : new Date(0).toISOString();

  const head = [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${xmlEscape(self)}</id>`,
    `  <title>${xmlEscape(title)}</title>`,
    `  <subtitle>${xmlEscape(FEED_SUBTITLE)}</subtitle>`,
    `  <updated>${updated}</updated>`,
    `  <author><name>${xmlEscape(FEED_AUTHOR_NAME)}</name></author>`,
    `  <link rel="self" href="${xmlEscape(self)}" />`,
    `  <link rel="alternate" type="text/html" href="${xmlEscape(alternate)}" />`,
  ].join("\n");

  const body = entries.map(renderEntry).join("\n");

  return `${head}\n${body}\n</feed>\n`;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: Request,
  context: RouteContext,
): Promise<Response> {
  const { slug } = await context.params;
  const vendor = lookupVendor(slug);

  if (vendor === null) {
    notFound();
  }

  const activity = getVendorPreview(vendor.slug);
  const entries = activity ? flattenReceipts(activity.programs) : [];

  const xml = renderFeed(vendor.slug, vendor.displayName, entries);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "content-type": "application/atom+xml; charset=utf-8",
      "cache-control": "public, max-age=300",
      "x-content-type-options": "nosniff",
    },
  });
}
