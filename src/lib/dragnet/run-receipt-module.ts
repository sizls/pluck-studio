// ---------------------------------------------------------------------------
// dragnetRunReceiptModule — Directive module backing the receipt page
// ---------------------------------------------------------------------------
//
// Holds the live state of a single DRAGNET run's receipt as the page is
// open. Today the facts are populated from a stub source (`fetch
// /api/bureau/dragnet/runs/[id]`); when pluck-api ships /v1/runs and
// Supabase Realtime, the same facts get re-populated from a Realtime
// channel via @directive-run/query — the page render code is unchanged.
//
// Facts:
//   - id              — phrase ID or UUID, taken from the URL
//   - status          — see ReceiptStatus below
//   - receiptUrl?     — link to the DSSE envelope on success
//   - rekorUuid?      — Rekor transparency-log UUID on success
//   - probeCount?     — total probes in the pack
//   - classifications — { contradict, mirror, shadow, snare } counts
//   - dotColor?       — TimelineDot color, per `dotColorFromClassifications`
//   - targetDossierUrl? — link to the per-target dossier page
//
// Classification → TimelineDot color mapping (DRAGNET canonical):
//   - contradict   → red    (vendor said different things; load-bearing)
//   - mirror       → red    (vendor parroted but with logical inversion)
//   - shadow       → amber  (vendor refused but in a way that leaks signal)
//   - snare        → green  (probe was honeyed; vendor passed)
//   - Cycle dot color = the worst class seen this cycle:
//       any contradict OR mirror → red
//       else any shadow          → amber
//       else (only snares OR none) → green
//
// This is a deliberate Directive shape: every per-run UI panel is a
// derivation off these facts, so adding a new panel later means writing
// one derivation, not threading prop chains.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "cycle pending"
  | "dispatched"
  | "probing"
  | "anchoring"
  | "anchored"
  | "failed"
  // Kept for back-compat with day-1 stub responses.
  | "running";

export type DotColor = "red" | "amber" | "green";

export interface Classifications {
  contradict: number;
  mirror: number;
  shadow: number;
  snare: number;
}

/**
 * Canonical mapping from per-cycle classification counts to TimelineDot
 * color. Documented in the module header.
 */
export function dotColorFromClassifications(
  c: Classifications,
): DotColor {
  if (c.contradict > 0 || c.mirror > 0) {
    return "red";
  }
  if (c.shadow > 0) {
    return "amber";
  }
  return "green";
}

export const dragnetRunReceiptModule = createModule("dragnet-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      receiptUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
      probeCount: t.number().nullable(),
      classifications: t.object<Classifications>().nullable(),
      dotColor: t.string<DotColor>().nullable(),
      targetDossierUrl: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isAnchored: t.boolean(),
      hasClassifications: t.boolean(),
      totalClassified: t.number(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "cycle pending";
    facts.receiptUrl = null;
    facts.rekorUuid = null;
    facts.probeCount = null;
    facts.classifications = null;
    facts.dotColor = null;
    facts.targetDossierUrl = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "cycle pending" ||
      facts.status === "dispatched" ||
      facts.status === "probing" ||
      facts.status === "anchoring" ||
      facts.status === "running",
    isAnchored: (facts) => facts.status === "anchored",
    hasClassifications: (facts) => facts.classifications !== null,
    totalClassified: (facts) => {
      if (facts.classifications === null) {
        return 0;
      }
      return (
        facts.classifications.contradict +
        facts.classifications.mirror +
        facts.classifications.shadow +
        facts.classifications.snare
      );
    },
  },
});
