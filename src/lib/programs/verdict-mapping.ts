// ---------------------------------------------------------------------------
// verdict-mapping — map (programSlug, verdict) → VerdictBadgeVariant
// ---------------------------------------------------------------------------
//
// Pure, deterministic table. Surfaces consume this to decide whether a
// receipt deserves a <VerdictBadge> SUPPLEMENT to the verdict-color
// dot. Returning `null` means "the bare dot is sufficient" — programs
// without nuanced trust tiers (e.g. simple green/red) skip the badge
// entirely so /search and /vendor surfaces don't drown in pills.
//
// The two load-bearing tiers introduced in R1 — NUCLEI's
// `published-ingested-only` ('registry-fenced') and MOLE's
// `re-witnessed` (rotation-restored) — are the headline reason this
// primitive exists. Other programs map their fail / verified states
// here so the badge becomes a system-wide vocabulary, not a special
// case for two programs.
// ---------------------------------------------------------------------------

import type { VerdictBadgeVariant } from "../../components/bureau-ui/VerdictBadge";

/**
 * Coarse verdict-color used by /vendor + /search aggregate views.
 * Mirrors `VendorVerdict` from `vendor-preview.ts` without importing
 * to keep this module dependency-free.
 */
export type VerdictColor = "green" | "amber" | "red" | "gray";

/**
 * Map a program-specific verdict string OR a coarse verdict color into
 * a VerdictBadgeVariant. Returns `null` when the bare verdict-color dot
 * is sufficient (no nuance to surface).
 *
 * Inputs accepted:
 *   - NUCLEI: "published" | "published-ingested-only" | "failed"
 *   - MOLE:   "sealed" | "re-witnessed" | "failed"
 *   - DRAGNET / OATH / FINGERPRINT / CUSTODY / others: coarse
 *     verdictColor — "green" | "amber" | "red" | "gray".
 *
 * Unknown inputs return `null` (defensive — never throws on stub data).
 */
export function verdictToBadgeVariant(
  programSlug: string,
  verdict: string,
): VerdictBadgeVariant | null {
  const slug = programSlug.toLowerCase();
  const v = verdict.toLowerCase();

  if (slug === "nuclei") {
    if (v === "published") {
      return "verified";
    }
    if (v === "published-ingested-only") {
      return "registry-fenced";
    }
    if (v === "failed" || v === "rejected") {
      return "failed";
    }
    if (v === "pending") {
      return "pending";
    }
  }

  if (slug === "mole") {
    if (v === "sealed") {
      return "verified";
    }
    if (v === "re-witnessed") {
      return "re-witnessed";
    }
    if (v === "failed" || v === "rejected") {
      return "failed";
    }
    if (v === "pending") {
      return "pending";
    }
  }

  // For programs without nuanced trust tiers, fall through to coarse
  // color mapping. Green is "verified", amber surfaces as "expired"
  // (the most common amber meaning in DRAGNET / OATH timeline rows),
  // red as "failed", gray returns null (no badge — bare dot is fine
  // for "not monitored" / "no data").
  if (v === "green") {
    return "verified";
  }
  if (v === "amber") {
    return "expired";
  }
  if (v === "red") {
    return "failed";
  }

  // gray, unknown, or program-specific verdict not in the table.
  return null;
}
