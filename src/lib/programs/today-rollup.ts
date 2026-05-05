// ---------------------------------------------------------------------------
// today-rollup — daily honesty signal across all 11 Bureau programs
// ---------------------------------------------------------------------------
//
// Aggregation helper consumed by `/today` (page) and
// `/today/opengraph-image` (1200×630 PNG). Returns a `DailyRollup` that
// covers EVERY active program, not just the 6 vendor-bearing ones —
// the daily card has to demonstrate the full Bureau surface.
//
// Phase-stub: pluck-api `/v1/runs?since=24h-ago` isn't live yet. Until
// it lands we fold per-vendor preview activity into per-program
// totals (DRAGNET / OATH / FINGERPRINT / CUSTODY / NUCLEI / MOLE),
// and use a tiny hand-curated stub for the 5 non-vendor-bearing
// programs (WHISTLE / BOUNTY / SBOM-AI / ROTATE / TRIPWIRE).
//
// When pluck-api lands, the swap is one private function:
//   - replace `aggregateStubCounts(now)` with a `listRuns({ since: ... })`
//     call that returns the same per-program shape.
//   - the public `getDailyRollup(now?)` signature stays stable.
//
// PRIVACY POSTURE — load-bearing:
//   - This helper aggregates ONLY counts (verdict tallies + receipt
//     totals). No payload bytes, no phrase IDs, no vendor IDs flow
//     through the rollup.
//   - That keeps the daily card aligned with PROGRAM_PRIVACY_POSTURE.
//     Locked by `today-rollup.test.ts` — adding a non-count field
//     fails the test and forces a privacy-posture re-review.
// ---------------------------------------------------------------------------

import {
  ACTIVE_PROGRAMS,
  type ActiveProgram,
} from "./registry.js";
import {
  getVendorPreview,
  PREVIEW_NOW,
  type VendorVerdict,
} from "./vendor-preview.js";

export interface VerdictCounts {
  readonly green: number;
  readonly amber: number;
  readonly red: number;
  readonly gray: number;
}

export interface ProgramRollup {
  /** Program slug — matches ACTIVE_PROGRAMS entry. */
  readonly slug: string;
  /** Program canonical ALL CAPS name. */
  readonly name: string;
  /** Hex accent color (registry-driven). */
  readonly accent: string;
  /** Per-verdict counts for the day. */
  readonly verdictCounts: VerdictCounts;
  /** Sum of verdict counts for the day. */
  readonly totalReceipts: number;
}

export interface DailyRollup {
  /** YYYY-MM-DD UTC date the rollup is anchored to. */
  readonly date: string;
  /** All 11 active programs in registry order. */
  readonly programs: ReadonlyArray<ProgramRollup>;
  /** Total receipts across all programs. */
  readonly totalReceipts: number;
  /** Verdict breakdown across all programs (sum of per-program counts). */
  readonly verdictBreakdown: VerdictCounts;
}

// ---------------------------------------------------------------------------
// Stub-era counts (deterministic, hand-curated)
// ---------------------------------------------------------------------------
//
// The 6 vendor-bearing programs derive counts from `vendor-preview.ts`
// (already deterministic, anchored at PREVIEW_NOW). The 5 non-vendor-
// bearing programs get small fixed counts so the card looks alive
// instead of half-empty. None of these claim factual telemetry —
// the OG card carries a "DEMO DATA — PREVIEW" watermark.
// ---------------------------------------------------------------------------

const VENDOR_BEARING_SLUGS: ReadonlyArray<string> = [
  "dragnet",
  "oath",
  "fingerprint",
  "custody",
  "nuclei",
  "mole",
];

// Vendor allowlist mirrored from vendor-preview.ts. Keeping it local
// avoids exporting an internal from vendor-preview just for this aggregator.
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

// Hand-curated stub for non-vendor-bearing programs — small, varied,
// reads cleanly on the OG card. Sums kept low so the daily card
// doesn't overstate the demo posture.
const NON_VENDOR_STUB: Readonly<Record<string, VerdictCounts>> = {
  whistle: { green: 1, amber: 0, red: 0, gray: 1 },
  bounty: { green: 1, amber: 1, red: 0, gray: 0 },
  "sbom-ai": { green: 2, amber: 0, red: 0, gray: 0 },
  rotate: { green: 1, amber: 0, red: 0, gray: 0 },
  tripwire: { green: 1, amber: 1, red: 0, gray: 0 },
};

const EMPTY_COUNTS: VerdictCounts = Object.freeze({
  green: 0,
  amber: 0,
  red: 0,
  gray: 0,
});

function addCounts(a: VerdictCounts, b: VerdictCounts): VerdictCounts {
  return {
    green: a.green + b.green,
    amber: a.amber + b.amber,
    red: a.red + b.red,
    gray: a.gray + b.gray,
  };
}

function totalOf(c: VerdictCounts): number {
  return c.green + c.amber + c.red + c.gray;
}

function vendorBearingCountsFor(programSlug: string): VerdictCounts {
  let acc: VerdictCounts = EMPTY_COUNTS;

  for (const vendorSlug of VENDOR_SLUGS) {
    const preview = getVendorPreview(vendorSlug);

    if (preview === null) {
      continue;
    }
    for (const programActivity of preview.programs) {
      if (programActivity.programSlug !== programSlug) {
        continue;
      }
      for (const receipt of programActivity.receipts) {
        const verdict: VendorVerdict = receipt.verdict;
        acc = addCounts(acc, {
          green: verdict === "green" ? 1 : 0,
          amber: verdict === "amber" ? 1 : 0,
          red: verdict === "red" ? 1 : 0,
          gray: verdict === "gray" ? 1 : 0,
        });
      }
    }
  }

  return acc;
}

function countsForProgram(program: ActiveProgram): VerdictCounts {
  if (VENDOR_BEARING_SLUGS.includes(program.slug)) {
    return vendorBearingCountsFor(program.slug);
  }
  const stub = NON_VENDOR_STUB[program.slug];

  if (stub !== undefined) {
    return stub;
  }

  return EMPTY_COUNTS;
}

function formatUtcDate(d: Date): string {
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");

  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Build the daily roll-up across all 11 active programs.
 *
 * @param now Optional clock anchor — defaults to `PREVIEW_NOW` so the
 *   stub is deterministic across renders. Tests override it explicitly.
 *   When pluck-api lands and live data flows, callers can pass `new
 *   Date()` to anchor against the real clock; the stub anchor falls
 *   away with the helpers above.
 */
export function getDailyRollup(now?: Date): DailyRollup {
  const anchor = now ?? PREVIEW_NOW;
  const programs: ProgramRollup[] = ACTIVE_PROGRAMS.map((program) => {
    const verdictCounts = countsForProgram(program);

    return {
      slug: program.slug,
      name: program.name,
      accent: program.accent,
      verdictCounts,
      totalReceipts: totalOf(verdictCounts),
    };
  });

  const verdictBreakdown = programs.reduce<VerdictCounts>(
    (acc, p) => addCounts(acc, p.verdictCounts),
    EMPTY_COUNTS,
  );

  return {
    date: formatUtcDate(anchor),
    programs,
    totalReceipts: totalOf(verdictBreakdown),
    verdictBreakdown,
  };
}
