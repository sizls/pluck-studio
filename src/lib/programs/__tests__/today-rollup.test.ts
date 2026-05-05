// ---------------------------------------------------------------------------
// today-rollup — unit tests
// ---------------------------------------------------------------------------
//
// Locks the daily roll-up contract:
//   1. Returns 11 programs in stable registry order.
//   2. Every program has verdictCounts + totalReceipts.
//   3. DailyRollup.verdictBreakdown sums equal the per-program sums.
//   4. Deterministic under a fixed `now`.
//   5. Privacy posture — counts only, no payload / phrase / vendor data
//      leaks through the rollup shape.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { ACTIVE_PROGRAMS } from "../registry.js";
import { getDailyRollup, type ProgramRollup } from "../today-rollup.js";

describe("getDailyRollup", () => {
  it("covers all 11 active programs in stable registry order", () => {
    const rollup = getDailyRollup();
    expect(rollup.programs.length).toBe(11);
    const slugs = rollup.programs.map((p) => p.slug);
    const expected = ACTIVE_PROGRAMS.map((p) => p.slug);
    expect(slugs).toEqual(expected);
  });

  it("every program carries verdictCounts + totalReceipts + accent + name", () => {
    const rollup = getDailyRollup();
    for (const program of rollup.programs) {
      expect(program.verdictCounts).toBeDefined();
      expect(typeof program.verdictCounts.green).toBe("number");
      expect(typeof program.verdictCounts.amber).toBe("number");
      expect(typeof program.verdictCounts.red).toBe("number");
      expect(typeof program.verdictCounts.gray).toBe("number");
      const sum =
        program.verdictCounts.green +
        program.verdictCounts.amber +
        program.verdictCounts.red +
        program.verdictCounts.gray;
      expect(program.totalReceipts).toBe(sum);
      expect(program.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(program.name).toBe(program.name.toUpperCase());
    }
  });

  it("verdictBreakdown sums match per-program sums", () => {
    const rollup = getDailyRollup();
    const expected = rollup.programs.reduce(
      (acc, p) => ({
        green: acc.green + p.verdictCounts.green,
        amber: acc.amber + p.verdictCounts.amber,
        red: acc.red + p.verdictCounts.red,
        gray: acc.gray + p.verdictCounts.gray,
      }),
      { green: 0, amber: 0, red: 0, gray: 0 },
    );
    expect(rollup.verdictBreakdown).toEqual(expected);
    expect(rollup.totalReceipts).toBe(
      expected.green + expected.amber + expected.red + expected.gray,
    );
  });

  it("is deterministic given a fixed `now`", () => {
    const fixed = new Date("2026-05-04T12:00:00.000Z");
    const a = getDailyRollup(fixed);
    const b = getDailyRollup(fixed);
    expect(a).toEqual(b);
  });

  it("emits date in YYYY-MM-DD UTC form", () => {
    const fixed = new Date("2026-05-04T23:30:00.000Z");
    const rollup = getDailyRollup(fixed);
    expect(rollup.date).toBe("2026-05-04");
  });

  it("vendor-bearing programs have non-zero totals (registry sanity)", () => {
    const rollup = getDailyRollup();
    const vendorBearing = ["dragnet", "oath", "fingerprint", "custody", "nuclei", "mole"];
    for (const slug of vendorBearing) {
      const program = rollup.programs.find((p) => p.slug === slug);
      expect(program, slug).toBeDefined();
      expect(program?.totalReceipts, slug).toBeGreaterThan(0);
    }
  });

  it("privacy posture — ProgramRollup carries ONLY counts (no payload / phrase / vendor data)", () => {
    const rollup = getDailyRollup();
    const allowed = new Set([
      "slug",
      "name",
      "accent",
      "verdictCounts",
      "totalReceipts",
    ]);
    for (const program of rollup.programs as ReadonlyArray<ProgramRollup>) {
      const keys = Object.keys(program);
      for (const key of keys) {
        expect(
          allowed.has(key),
          `ProgramRollup leaked unexpected field: ${key}`,
        ).toBe(true);
      }
    }
    // DailyRollup top-level shape — same posture.
    const topAllowed = new Set([
      "date",
      "programs",
      "totalReceipts",
      "verdictBreakdown",
    ]);
    for (const key of Object.keys(rollup)) {
      expect(
        topAllowed.has(key),
        `DailyRollup leaked unexpected field: ${key}`,
      ).toBe(true);
    }
  });
});
