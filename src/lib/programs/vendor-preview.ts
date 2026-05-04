// ---------------------------------------------------------------------------
// vendor-preview — vendor-NEUTRAL shape demo for /vendor/<slug>
// ---------------------------------------------------------------------------
//
// Phase-stub: pluck-api /v1/runs isn't live yet. The vendor profile page
// renders this canned activity table so visitors can see the SHAPE of
// the eventual UI — when /v1/runs lands, the page swaps `VENDOR_PREVIEW`
// for live data with no other code changes (the rendering layer takes
// the same shape).
//
// Coverage rule: only the 6 vendor-bearing programs feed this index.
// DRAGNET / OATH / FINGERPRINT / CUSTODY use vendor-prefixed phrase IDs,
// NUCLEI tags packs by `vendorScope`, and MOLE binds canaries to a
// canaryUrl host. WHISTLE (routing-partner-not-source), BOUNTY (target
// platform), ROTATE (rotation reason), TRIPWIRE (machine-id), and
// SBOM-AI (artifact kind) are correctly excluded — their phrase-ID
// schemas refuse to surface vendor identity.
//
// Legal posture (CRITICAL):
//   - Every summary string is vendor-NEUTRAL — it describes the RECEIPT
//     SHAPE, never a specific factual claim against the named vendor.
//   - Every summary ends with the suffix "(illustrative)" so the page
//     cannot be screenshotted as if it were factual telemetry.
//   - Every vendor receives an IDENTICAL verdict distribution
//     (5 green, 2 amber, 1 gray, 0 red) across an IDENTICAL program
//     spread (DRAGNET ×2, OATH ×1, FINGERPRINT ×2, CUSTODY ×1,
//     NUCLEI ×1, MOLE ×1). No vendor is painted worse than another.
//   - The PreviewBanner above the page reinforces the demo posture.
//
// When real /v1/runs data lands, this file shrinks to the type
// definitions + helpers; RAW + buildPreview disappear.
// ---------------------------------------------------------------------------

export type VendorVerdict = "green" | "amber" | "red" | "gray";

export type VendorProgramSlug =
  | "dragnet"
  | "oath"
  | "fingerprint"
  | "custody"
  | "nuclei"
  | "mole";

export interface VendorReceipt {
  readonly phraseId: string;
  readonly verdict: VendorVerdict;
  readonly capturedAt: Date;
  readonly summary: string;
}

export interface VendorProgramActivity {
  readonly programSlug: VendorProgramSlug;
  readonly receipts: ReadonlyArray<VendorReceipt>;
}

export interface VendorPreviewActivity {
  readonly slug: string;
  readonly programs: ReadonlyArray<VendorProgramActivity>;
  readonly totalReceipts: number;
  readonly verdictBreakdown: {
    readonly green: number;
    readonly amber: number;
    readonly red: number;
    readonly gray: number;
  };
}

// Anchor "now" relative to a fixed clock so the preview activity is
// deterministic across renders. When real /v1/runs data arrives, we
// drop this anchor — receipts come with real timestamps.
const PREVIEW_ANCHOR = new Date("2026-05-04T12:00:00.000Z");

function daysAgo(days: number, hour = 12): Date {
  const d = new Date(PREVIEW_ANCHOR);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);

  return d;
}

// ---------------------------------------------------------------------------
// Vendor-neutral shape templates
// ---------------------------------------------------------------------------
//
// Every receipt summary is a SHAPE description, not a factual claim
// against any named vendor. The "(illustrative)" suffix is required —
// it makes a screenshot impossible to misread as live telemetry.
// ---------------------------------------------------------------------------

interface ShapeSlot {
  readonly verdict: VendorVerdict;
  readonly summary: string;
}

const DRAGNET_SHAPES: ReadonlyArray<ShapeSlot> = [
  {
    verdict: "green",
    summary: "Stable cycle — 0 contradictions across 12 probes (illustrative)",
  },
  {
    verdict: "amber",
    summary: "Sample warning cycle — drift in claim copy detected (illustrative)",
  },
];

const OATH_SHAPES: ReadonlyArray<ShapeSlot> = [
  {
    verdict: "green",
    summary: "Sample verified oath — DSSE chain matches /.well-known (illustrative)",
  },
];

const FINGERPRINT_SHAPES: ReadonlyArray<ShapeSlot> = [
  {
    verdict: "green",
    summary: "Sample stable cassette — drift score within tolerance (illustrative)",
  },
  {
    verdict: "amber",
    summary: "Sample minor-drift cassette — calibration shift below swap threshold (illustrative)",
  },
];

const CUSTODY_SHAPES: ReadonlyArray<ShapeSlot> = [
  {
    verdict: "green",
    summary: "Sample compliant bundle — FRE 902(13) checks pass (illustrative)",
  },
];

const NUCLEI_SHAPES: ReadonlyArray<ShapeSlot> = [
  {
    verdict: "gray",
    summary: "Sample registry-fenced pack — awaits SBOM-AI cross-ref (illustrative)",
  },
];

const MOLE_SHAPES: ReadonlyArray<ShapeSlot> = [
  {
    verdict: "green",
    summary: "Sample sealed canary — sha256 anchored before any probe (illustrative)",
  },
];

// Per-program receipt count (sums to 8 per vendor) and the shapes used
// in slot order. Verdict totals per vendor: 5 green, 2 amber, 1 gray.
interface ProgramSpec {
  readonly programSlug: VendorProgramSlug;
  readonly slots: ReadonlyArray<ShapeSlot>;
}

const PROGRAM_SPEC: ReadonlyArray<ProgramSpec> = [
  { programSlug: "dragnet", slots: DRAGNET_SHAPES }, // 2 slots: 1 green + 1 amber
  { programSlug: "oath", slots: OATH_SHAPES }, // 1 slot: 1 green
  { programSlug: "fingerprint", slots: FINGERPRINT_SHAPES }, // 2 slots: 1 green + 1 amber
  { programSlug: "custody", slots: CUSTODY_SHAPES }, // 1 slot: 1 green
  { programSlug: "nuclei", slots: NUCLEI_SHAPES }, // 1 slot: 1 gray
  { programSlug: "mole", slots: MOLE_SHAPES }, // 1 slot: 1 green
];

// Stable, vendor-NEUTRAL phrase fragments. Cycled by index per vendor
// so the page reads varied but no fragment names a real product or
// model. Each (vendor, programSlug, slotIndex) gets a deterministic id.
const PHRASE_FRAGMENTS: ReadonlyArray<string> = [
  "bold-marlin-1188",
  "quiet-otter-2210",
  "swift-falcon-3742",
  "stable-eagle-5544",
  "coastal-jay-9988",
  "rapid-otter-5577",
  "clear-heron-9914",
  "deep-condor-3344",
];

// Per-vendor day offsets — same offsets reused across all 10 vendors so
// no vendor is "more recently bad" than another. 8 offsets across 30 days.
const DAY_OFFSETS: ReadonlyArray<number> = [2, 5, 8, 11, 14, 18, 22, 27];

// ---------------------------------------------------------------------------
// Vendor list — must match vendor-registry.ts order. Receipts are
// generated identically per slug; the only difference is the slug
// prefix on the phrase ID.
// ---------------------------------------------------------------------------

const VENDOR_SLUGS: ReadonlyArray<string> = [
  "openai",
  "anthropic",
  "google",
  "meta",
  "mistral",
  "cohere",
  "perplexity",
  "deepseek",
  "xai",
  "microsoft",
];

function buildVendorActivity(slug: string): VendorPreviewActivity {
  const programs: VendorProgramActivity[] = [];
  let total = 0;
  const breakdown = { green: 0, amber: 0, red: 0, gray: 0 };

  let globalSlotIndex = 0;

  for (const spec of PROGRAM_SPEC) {
    const receipts: VendorReceipt[] = [];

    for (const slot of spec.slots) {
      const fragment =
        PHRASE_FRAGMENTS[globalSlotIndex % PHRASE_FRAGMENTS.length] ?? "shape";
      const dayOffset =
        DAY_OFFSETS[globalSlotIndex % DAY_OFFSETS.length] ?? 0;
      const phraseId = `${slug}-${fragment}`;

      receipts.push({
        phraseId,
        verdict: slot.verdict,
        capturedAt: daysAgo(dayOffset, 12),
        summary: slot.summary,
      });
      breakdown[slot.verdict] += 1;
      total += 1;
      globalSlotIndex += 1;
    }

    // Newest-first within each program section.
    receipts.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
    programs.push({ programSlug: spec.programSlug, receipts });
  }

  return {
    slug,
    programs,
    totalReceipts: total,
    verdictBreakdown: breakdown,
  };
}

const PREVIEWS: ReadonlyMap<string, VendorPreviewActivity> = new Map(
  VENDOR_SLUGS.map((slug) => [slug, buildVendorActivity(slug)]),
);

/**
 * Look up the preview activity for a vendor slug. Returns null when the
 * vendor isn't covered yet — callers should pair this with the
 * vendor-registry allowlist (notFound() applies first).
 */
export function getVendorPreview(slug: string): VendorPreviewActivity | null {
  return PREVIEWS.get(slug.toLowerCase()) ?? null;
}

/** Latest activity across all programs (for last-updated UI). */
export function lastUpdatedAt(activity: VendorPreviewActivity): Date | null {
  let latest: Date | null = null;

  for (const program of activity.programs) {
    for (const receipt of program.receipts) {
      if (latest === null || receipt.capturedAt > latest) {
        latest = receipt.capturedAt;
      }
    }
  }

  return latest;
}

/**
 * The frozen "now" the preview activity is anchored against. Exported
 * so the renderer can compute relative timestamps consistently with
 * the data — when /v1/runs lands and we drop the preview anchor, this
 * goes away too.
 */
export const PREVIEW_NOW = PREVIEW_ANCHOR;
