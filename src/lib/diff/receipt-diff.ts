// ---------------------------------------------------------------------------
// receipt-diff — pure aggregator for /diff/<id>?since=<phrase-id>
// ---------------------------------------------------------------------------
// Two phrase IDs in. One ReceiptDiff (or distinct error kind) out.
// Resolution order mirrors `resolvePhraseSpeedDial`: v1 store first
// (canonical for anchored runs), then `searchPhraseId` directMatch
// (vendor-preview today, real `/v1/runs?phraseIdPrefix=` when
// pluck-api lands). Cross-program comparison ALLOWED when scopes
// match — `sameProgram: false` flags the case so the page can render
// triangulation copy. Pure + side-effect-free.
// ---------------------------------------------------------------------------

import { parsePhraseId } from "../phrase-id.js";
import { ACTIVE_PROGRAMS } from "../programs/registry.js";
import type { VendorVerdict } from "../programs/vendor-preview.js";
import { searchPhraseId, type SearchResult } from "../search/phrase-stitch.js";
import { getRun } from "../v1/run-store.js";

export interface ReceiptDiffSide {
  readonly phraseId: string;
  readonly capturedAt: Date;
  readonly verdictColor: string;
  readonly summary: string;
  readonly programSlug: string;
  readonly programName: string;
  readonly programAccent: string;
  readonly receiptUrl: string;
}

export interface ReceiptDiff {
  readonly base: ReceiptDiffSide;
  readonly target: ReceiptDiffSide;
  /** True iff both phrase IDs share the same scope (vendor). */
  readonly sameVendor: boolean;
  /** True iff both receipts came from the same Bureau program. */
  readonly sameProgram: boolean;
  readonly verdictChanged: boolean;
  readonly summaryChanged: boolean;
  /** target.capturedAt - base.capturedAt; can be negative if reordered. */
  readonly timeDeltaMs: number;
  /** Shared scope (e.g. "openai"). */
  readonly vendorScope: string;
}

export type DiffResult =
  | { readonly kind: "ok"; readonly diff: ReceiptDiff }
  | { readonly kind: "invalid-phrase"; readonly which: "base" | "target"; readonly phraseId: string }
  | { readonly kind: "not-found"; readonly which: "base" | "target"; readonly phraseId: string }
  | {
      readonly kind: "different-vendors";
      readonly baseScope: string;
      readonly targetScope: string;
      readonly base: ReceiptDiffSide;
      readonly target: ReceiptDiffSide;
    };

interface ProgramLookup {
  readonly slug: string;
  readonly name: string;
  readonly accent: string;
}

function lookupProgram(slug: string): ProgramLookup {
  const program = ACTIVE_PROGRAMS.find((p) => p.slug === slug);

  if (program) {
    return { slug: program.slug, name: program.name, accent: program.accent };
  }

  return { slug, name: slug.toUpperCase(), accent: "#999999" };
}

/**
 * Map a v1 RunRecord verdict color to the coarse VendorVerdict literal.
 * Unknown values fall through to "gray" — defense in depth (the union
 * is locked at the type level today).
 */
function normalizeVerdictColor(input: string): VendorVerdict {
  if (input === "green" || input === "amber" || input === "red" || input === "gray") {
    return input;
  }

  return "gray";
}

function toSideFromSearchResult(result: SearchResult): ReceiptDiffSide {
  return {
    phraseId: result.phraseId,
    capturedAt: result.capturedAt,
    verdictColor: result.verdictColor,
    summary: result.summary,
    programSlug: result.programSlug,
    programName: result.programName,
    programAccent: result.programAccent,
    receiptUrl: result.receiptUrl,
  };
}

function resolveSide(phraseId: string): ReceiptDiffSide | null {
  // 1) v1 store — canonical source for freshly-anchored runs.
  const stored = getRun(phraseId);

  if (stored !== null) {
    const programSlug = stored.pipeline.startsWith("bureau:")
      ? stored.pipeline.slice("bureau:".length)
      : stored.pipeline;
    const meta = lookupProgram(programSlug);

    return {
      phraseId: stored.runId,
      capturedAt: new Date(stored.updatedAt),
      verdictColor: normalizeVerdictColor(stored.verdictColor),
      // Pending records carry verdict=null; surface a placeholder so the
      // diff page still renders a card.
      summary: stored.verdict ?? "cycle pending",
      programSlug: meta.slug,
      programName: meta.name,
      programAccent: meta.accent,
      receiptUrl: stored.receiptUrl,
    };
  }

  // 2) Cross-program search aggregator — covers stub-era vendor-preview
  // receipts plus (when pluck-api lands) every shipped program.
  const aggregate = searchPhraseId(phraseId);

  if (aggregate.directMatch !== null) {
    return toSideFromSearchResult(aggregate.directMatch);
  }

  return null;
}

/**
 * Diff two receipts. Pure + deterministic. Validation order returns
 * the FIRST problem encountered:
 *   1. base parses as a 4-part scoped phrase ID
 *   2. target parses as a 4-part scoped phrase ID
 *   3. base resolves to a receipt
 *   4. target resolves to a receipt
 *   5. both share the same vendor scope
 */
export function diffReceipts(basePhraseId: string, targetPhraseId: string): DiffResult {
  const baseParsed = parsePhraseId(basePhraseId);

  if (!baseParsed.valid) {
    return { kind: "invalid-phrase", which: "base", phraseId: baseParsed.normalized };
  }

  const targetParsed = parsePhraseId(targetPhraseId);

  if (!targetParsed.valid) {
    return { kind: "invalid-phrase", which: "target", phraseId: targetParsed.normalized };
  }

  const base = resolveSide(baseParsed.normalized);

  if (base === null) {
    return { kind: "not-found", which: "base", phraseId: baseParsed.normalized };
  }

  const target = resolveSide(targetParsed.normalized);

  if (target === null) {
    return { kind: "not-found", which: "target", phraseId: targetParsed.normalized };
  }

  if (baseParsed.scope !== targetParsed.scope) {
    return {
      kind: "different-vendors",
      baseScope: baseParsed.scope,
      targetScope: targetParsed.scope,
      base,
      target,
    };
  }

  return {
    kind: "ok",
    diff: {
      base,
      target,
      sameVendor: true,
      sameProgram: base.programSlug === target.programSlug,
      // TODO(diff): when receipts carry a richer `verdict` field beyond verdictColor
      // (e.g. NUCLEI's `published` vs `published-ingested-only` both green), expand
      // this check to also detect same-color-different-variant transitions via
      // verdictToBadgeVariant. Today vendor-preview only carries verdictColor so
      // this color comparison is sufficient.
      verdictChanged: base.verdictColor !== target.verdictColor,
      summaryChanged: base.summary.trim() !== target.summary.trim(),
      timeDeltaMs: target.capturedAt.getTime() - base.capturedAt.getTime(),
      vendorScope: baseParsed.scope,
    },
  };
}

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Format a signed time delta. Pure — same input, same output. The
 * page renders this verbatim so tests can assert against it.
 */
export function formatTimeDelta(deltaMs: number): string {
  if (deltaMs === 0) {
    return "at the same instant";
  }
  const abs = Math.abs(deltaMs);
  const direction = deltaMs >= 0 ? "later" : "earlier";

  if (abs < MS_PER_HOUR) {
    const mins = Math.max(1, Math.floor(abs / MS_PER_MINUTE));

    return `${mins} minute${mins === 1 ? "" : "s"} ${direction}`;
  }

  if (abs < MS_PER_DAY) {
    const hours = Math.floor(abs / MS_PER_HOUR);

    return `${hours} hour${hours === 1 ? "" : "s"} ${direction}`;
  }

  const days = Math.floor(abs / MS_PER_DAY);

  return `${days} day${days === 1 ? "" : "s"} ${direction}`;
}

/** Round-trip-safe pair guaranteed to resolve same-vendor cleanly. */
export function sampleDiffPair(): { base: string; target: string } {
  // openai-bold-marlin-1188 = DRAGNET green; openai-quiet-otter-2210 =
  // DRAGNET amber. Different verdicts so the diff card shows the
  // verdict-changed transition.
  return { base: "openai-bold-marlin-1188", target: "openai-quiet-otter-2210" };
}

/** Cross-vendor pair — used to demonstrate the rejected state. */
export function sampleCrossVendorPair(): { base: string; target: string } {
  return { base: "openai-bold-marlin-1188", target: "anthropic-bold-marlin-1188" };
}
