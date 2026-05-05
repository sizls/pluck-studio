// ---------------------------------------------------------------------------
// phrase-stitch — auto-stitch search across all 11 Bureau programs
// ---------------------------------------------------------------------------
//
// Paste any phrase ID. Get back every related receipt across all 11
// programs. The receipt URL becomes a discoverable nexus.
//
// The phrase-ID schema does the heavy lifting: each program's prefix
// encodes a program-specific scope (vendor / partner / platform / kind /
// reason / machine-id / author / canary-id). Decompose the ID, fan
// out across ACTIVE_PROGRAMS, and surface every receipt that shares
// that scope.
//
// Stub-era data source: vendor-preview.ts (the same shape demo /vendor
// renders). When pluck-api `/v1/runs?phraseIdPrefix=<scope>` lands,
// `searchPhraseId` swaps to a live query — the public API stays
// stable.
//
// Pure + deterministic: no Math.random, no Date.now leak, no global
// state. Same query in → same result out across renders + tests.
// ---------------------------------------------------------------------------

import { parsePhraseId, type ParsedPhraseId } from "../phrase-id.js";
import { ACTIVE_PROGRAMS } from "../programs/registry.js";
import {
  getVendorPreview,
  type VendorPreviewActivity,
  type VendorVerdict,
} from "../programs/vendor-preview.js";

export type SearchVerdictColor = VendorVerdict;

export interface SearchResult {
  readonly programSlug: string;
  readonly programName: string;
  readonly programAccent: string;
  readonly phraseId: string;
  readonly summary: string;
  readonly verdictColor: SearchVerdictColor;
  readonly capturedAt: Date;
  readonly receiptUrl: string;
}

export interface SearchAggregateResult {
  readonly query: string;
  readonly parsed: ParsedPhraseId;
  /** Exact phraseId match — null when no receipt carries this exact id. */
  readonly directMatch: SearchResult | null;
  /**
   * All other receipts whose phrase-ID scope matches `parsed.scope`,
   * across every Bureau program. Excludes the directMatch (deduped).
   * Sorted newest-first.
   */
  readonly relatedByScope: ReadonlyArray<SearchResult>;
  /** directMatch + relatedByScope.length — single number for the UI. */
  readonly totalCount: number;
}

/** All vendor slugs the stub preview knows about. Mirrors vendor-preview. */
const PREVIEW_VENDOR_SLUGS: ReadonlyArray<string> = [
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

interface ProgramLookup {
  readonly slug: string;
  readonly name: string;
  readonly accent: string;
}

function lookupProgram(slug: string): ProgramLookup {
  const program = ACTIVE_PROGRAMS.find((p) => p.slug === slug);

  if (program) {
    return {
      slug: program.slug,
      name: program.name,
      accent: program.accent,
    };
  }
  // Defensive — vendor-preview only emits slugs that exist in the
  // registry today. If a future preview row drifts, render a neutral
  // tile rather than crash.
  return { slug, name: slug.toUpperCase(), accent: "#999999" };
}

function receiptUrl(programSlug: string, phraseId: string): string {
  return `/bureau/${programSlug}/runs/${encodeURIComponent(phraseId)}`;
}

/**
 * Flatten the vendor-preview activity for one slug into a flat result
 * list. Each receipt carries its program metadata + the canonical
 * receipt URL so callers don't need a second lookup.
 */
function flattenVendorActivity(
  activity: VendorPreviewActivity,
): ReadonlyArray<SearchResult> {
  const out: SearchResult[] = [];

  for (const program of activity.programs) {
    const meta = lookupProgram(program.programSlug);

    for (const receipt of program.receipts) {
      out.push({
        programSlug: meta.slug,
        programName: meta.name,
        programAccent: meta.accent,
        phraseId: receipt.phraseId,
        summary: receipt.summary,
        verdictColor: receipt.verdict,
        capturedAt: receipt.capturedAt,
        receiptUrl: receiptUrl(meta.slug, receipt.phraseId),
      });
    }
  }

  return out;
}

/**
 * Search the universe of stub-era receipts for one phrase ID and every
 * receipt that shares its scope.
 *
 * Algorithm (stub-era):
 *   1. Parse the input.
 *   2. If invalid → return zero-result envelope, parsed flagged invalid.
 *   3. If valid → flatten preview activity for the scope (when the
 *      scope matches a known preview vendor). Otherwise the scope is
 *      a non-vendor program scope (e.g. "hackerone", "compromised") —
 *      not yet covered by stub data → empty result set, but parsed
 *      decomposition still rendered.
 *   4. Direct match: receipt with exactly the queried phraseId.
 *   5. Related-by-scope: every other receipt sharing the scope,
 *      sorted newest-first.
 *
 * Live-era: replace step 3 with `listRuns({ phraseIdPrefix: scope })`.
 */
export function searchPhraseId(query: string): SearchAggregateResult {
  const parsed = parsePhraseId(query);

  if (!parsed.valid) {
    return {
      query,
      parsed,
      directMatch: null,
      relatedByScope: [],
      totalCount: 0,
    };
  }

  const candidates: SearchResult[] = [];

  if (PREVIEW_VENDOR_SLUGS.includes(parsed.scope)) {
    const activity = getVendorPreview(parsed.scope);

    if (activity) {
      candidates.push(...flattenVendorActivity(activity));
    }
  }

  // Defensive: if the candidates array carries any phrase IDs whose
  // scope drifted away from the parsed scope, drop them. Today the
  // preview is single-vendor, but this guard locks the invariant.
  const scopedCandidates = candidates.filter((r) => {
    const dash = r.phraseId.indexOf("-");

    if (dash === -1) {
      return false;
    }

    return r.phraseId.slice(0, dash) === parsed.scope;
  });

  let directMatch: SearchResult | null = null;
  const related: SearchResult[] = [];

  for (const candidate of scopedCandidates) {
    if (candidate.phraseId === parsed.normalized && directMatch === null) {
      directMatch = candidate;
      continue;
    }
    related.push(candidate);
  }

  related.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());

  return {
    query,
    parsed,
    directMatch,
    relatedByScope: related,
    totalCount: (directMatch ? 1 : 0) + related.length,
  };
}

/**
 * A handful of known-good sample phrase IDs that resolve to real
 * stub-era receipts. Used by the empty-state on /search to give
 * operators something to click. Reads off the first vendor's first
 * preview row — guaranteed to round-trip.
 */
export function sampleSearchablePhraseIds(): ReadonlyArray<string> {
  const out: string[] = [];

  for (const slug of PREVIEW_VENDOR_SLUGS.slice(0, 4)) {
    const activity = getVendorPreview(slug);

    if (!activity) {
      continue;
    }
    const first = activity.programs[0]?.receipts[0]?.phraseId;

    if (first) {
      out.push(first);
    }
  }

  return out;
}
