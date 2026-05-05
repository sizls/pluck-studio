// ---------------------------------------------------------------------------
// Phrase-ID Speed-Dial — shared resolver for /open/<phrase> + /o/<phrase>
// ---------------------------------------------------------------------------
//
// One pure function, one lookup order, two routes. Both /open/<phrase>
// and /o/<phrase> route handlers thin-wrap this helper; the resolver
// stays in one place so the redirect contract is locked at one diff
// site.
//
// Resolution order, fail-soft to /search:
//   1. Validate path param length (≤128 chars, matches the v1 GET cap).
//      Out-of-cap → /search?q=<truncated-but-untouched>.
//   2. Parse via parsePhraseId. Invalid (bare 3-part / garbage) →
//      /search?q=<input> so the operator sees the parsed decomposition
//      + an inline error.
//   3. Look up in the v1 store via getRun. Hit → record.receiptUrl
//      (e.g. `/bureau/dragnet/runs/openai-bold-marlin-1188`).
//   4. Look up in the cross-program search aggregator (vendor-preview
//      today, real /v1/runs?phraseIdPrefix= when pluck-api lands).
//      directMatch → directMatch.receiptUrl. Same lookup /search itself
//      uses, so the speed-dial behavior matches whatever an operator
//      would see on /search.
//   5. Miss everywhere → /search?q=<input> (fallback shows the
//      decomposition + related-by-scope grid).
//
// Pure + side-effect-free — never reads request headers, never reads
// global state beyond the v1 store + search aggregator (both
// already-pure modules). Identical input → identical output across
// renders, tests, and route invocations.
// ---------------------------------------------------------------------------

import { parsePhraseId } from "./phrase-id.js";
import { searchPhraseId } from "./search/phrase-stitch.js";
import { getRun } from "./v1/run-store.js";

/** Length cap mirrors the v1 GET handler at /api/v1/runs/[id]. */
export const SPEED_DIAL_MAX_PHRASE_LEN = 128;

/**
 * Result of a speed-dial resolution. Discriminated so the route
 * handler can distinguish "real receipt" hits from search fallbacks
 * (useful in tests + future cache-policy tuning).
 */
export type SpeedDialResolution =
  | { readonly kind: "receipt"; readonly target: string }
  | { readonly kind: "search-fallback"; readonly target: string };

/**
 * Build a `/search?q=<phrase>` fallback URL. URL-encodes the input so
 * weirdness (a space, a slash, a query string) round-trips into the
 * search input intact; the search page already echoes arbitrary input
 * via its `defaultValue` handling.
 */
function searchFallback(phrase: string): SpeedDialResolution {
  const q = encodeURIComponent(phrase);

  return { kind: "search-fallback", target: `/search?q=${q}` };
}

/**
 * Resolve a phrase ID to a target URL. Pure — does not read or write
 * the request, never throws.
 */
export function resolvePhraseSpeedDial(phrase: unknown): SpeedDialResolution {
  // Defensive: route param is always a string in practice, but handle
  // the surprising shapes (undefined, array — Next.js once historically
  // returned arrays for `[...catchall]` routes) without crashing.
  if (typeof phrase !== "string" || phrase.length === 0) {
    return searchFallback("");
  }

  // Length cap protects against URL-bar-pasted nonsense (a 4KB blob
  // passed as a path segment shouldn't even hit parsePhraseId).
  if (phrase.length > SPEED_DIAL_MAX_PHRASE_LEN) {
    return searchFallback(phrase.slice(0, SPEED_DIAL_MAX_PHRASE_LEN));
  }

  const parsed = parsePhraseId(phrase);

  if (!parsed.valid) {
    return searchFallback(phrase);
  }

  // 1) v1 store hit — the canonical place where freshly-created runs live.
  const stored = getRun(parsed.normalized);
  if (stored !== null) {
    return { kind: "receipt", target: stored.receiptUrl };
  }

  // 2) Cross-program search aggregator — covers stub-era vendor-preview
  // receipts plus (when pluck-api lands) every shipped program.
  const aggregate = searchPhraseId(parsed.normalized);
  if (aggregate.directMatch !== null) {
    return { kind: "receipt", target: aggregate.directMatch.receiptUrl };
  }

  // 3) Miss — defer to /search so the operator sees the decomposition +
  // related-by-scope grid instead of a dead-end 404.
  return searchFallback(parsed.normalized);
}
