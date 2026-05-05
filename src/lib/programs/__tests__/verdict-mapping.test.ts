// ---------------------------------------------------------------------------
// verdict-mapping — unit tests
// ---------------------------------------------------------------------------
//
// Table-driven coverage for `verdictToBadgeVariant`. Every row is a
// (programSlug, verdict) → expected VerdictBadgeVariant pair. Critical
// because this map is the single source of truth wired into /search,
// /vendor, NUCLEI receipt, MOLE receipt — drift here ripples everywhere.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import type { VerdictBadgeVariant } from "../../../components/bureau-ui/VerdictBadge.js";
import { verdictToBadgeVariant } from "../verdict-mapping.js";

interface Row {
  readonly program: string;
  readonly verdict: string;
  readonly expected: VerdictBadgeVariant | null;
}

const ROWS: ReadonlyArray<Row> = [
  // NUCLEI — load-bearing trust tiers
  { program: "nuclei", verdict: "published", expected: "verified" },
  {
    program: "nuclei",
    verdict: "published-ingested-only",
    expected: "registry-fenced",
  },
  { program: "nuclei", verdict: "failed", expected: "failed" },
  { program: "nuclei", verdict: "rejected", expected: "failed" },
  { program: "nuclei", verdict: "pending", expected: "pending" },

  // MOLE — load-bearing rotation-restored tier
  { program: "mole", verdict: "sealed", expected: "verified" },
  { program: "mole", verdict: "re-witnessed", expected: "re-witnessed" },
  { program: "mole", verdict: "failed", expected: "failed" },
  { program: "mole", verdict: "pending", expected: "pending" },

  // Coarse verdictColor mapping — DRAGNET / OATH / FINGERPRINT / CUSTODY
  { program: "dragnet", verdict: "green", expected: "verified" },
  { program: "dragnet", verdict: "amber", expected: "expired" },
  { program: "dragnet", verdict: "red", expected: "failed" },
  { program: "dragnet", verdict: "gray", expected: null },

  { program: "oath", verdict: "green", expected: "verified" },
  { program: "oath", verdict: "amber", expected: "expired" },
  { program: "fingerprint", verdict: "red", expected: "failed" },
  { program: "custody", verdict: "green", expected: "verified" },

  // Unknown program / verdict → null (defensive)
  { program: "whistle", verdict: "delivered", expected: null },
  { program: "whistle", verdict: "green", expected: "verified" },
  { program: "unknown-program", verdict: "weird-verdict", expected: null },
];

describe("verdictToBadgeVariant", () => {
  it.each(ROWS)(
    "$program / $verdict → $expected",
    ({ program, verdict, expected }) => {
      expect(verdictToBadgeVariant(program, verdict)).toBe(expected);
    },
  );

  it("is case-insensitive for both program and verdict", () => {
    expect(verdictToBadgeVariant("NUCLEI", "Published")).toBe("verified");
    expect(verdictToBadgeVariant("Mole", "RE-WITNESSED")).toBe("re-witnessed");
    expect(verdictToBadgeVariant("DRAGNET", "GREEN")).toBe("verified");
  });

  it("never throws on empty / unexpected input", () => {
    expect(() => verdictToBadgeVariant("", "")).not.toThrow();
    expect(verdictToBadgeVariant("", "")).toBeNull();
  });

  it("returns null for the gray (no-data) coarse color across every program", () => {
    for (const program of ["dragnet", "oath", "fingerprint", "custody"]) {
      expect(verdictToBadgeVariant(program, "gray")).toBeNull();
    }
  });
});
