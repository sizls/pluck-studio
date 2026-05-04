// ---------------------------------------------------------------------------
// monitors-preview — hand-curated NUCLEI pack registry for /monitors
// ---------------------------------------------------------------------------
//
// Phase-stub: pluck-api /v1/monitors isn't live yet. The /monitors page
// renders this canned list so visitors can see the shape — when the
// endpoint lands, the page swaps `MONITORS_PREVIEW` for live data with
// no other code changes (the rendering layer takes the same shape).
// ---------------------------------------------------------------------------

import { NUCLEI_PACK_ENTRY_PREDICATE_URI } from "../nuclei/run-receipt-module";

export interface MonitorEntry {
  readonly packName: string;
  readonly author: string;
  readonly recommendedInterval: string;
  readonly predicateUri: string;
  /** Receipt-shaded color for the timeline dot. */
  readonly tone: "green" | "amber" | "blue" | "violet" | "teal";
}

export const MONITORS_PREVIEW: ReadonlyArray<MonitorEntry> = [
  {
    packName: "canon-honesty@0.1",
    author: "alice",
    recommendedInterval: "@hourly",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "green",
  },
  {
    packName: "alignment-probe@1.0",
    author: "openai-eng",
    recommendedInterval: "0 */4 * * *",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "blue",
  },
  {
    packName: "refusal-canon@0.3",
    author: "anthropic-research",
    recommendedInterval: "@daily",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "violet",
  },
  {
    packName: "weekday-watch@1.2",
    author: "bureau-ops",
    recommendedInterval: "0 0 * * 1-5",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "amber",
  },
  {
    packName: "fast-ping@0.1",
    author: "sigil-labs",
    recommendedInterval: "*/15 * * * *",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "teal",
  },
  {
    packName: "noon-guard@0.2",
    author: "caprio",
    recommendedInterval: "0 12 * * *",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "green",
  },
  {
    packName: "twice-daily@1.0",
    author: "sentinel-7",
    recommendedInterval: "0 6,18 * * *",
    predicateUri: NUCLEI_PACK_ENTRY_PREDICATE_URI,
    tone: "blue",
  },
];
