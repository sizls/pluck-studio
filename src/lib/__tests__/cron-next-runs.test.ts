// ---------------------------------------------------------------------------
// nextNRuns — unit tests
// ---------------------------------------------------------------------------
//
// Deterministic-given-`from` behavior is the point: the calendar strip
// renders 7 future timestamps client-side from a SSR-friendly anchor,
// so the function must produce identical output for identical input.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { nextNRuns } from "../cron/next-runs.js";

// Anchor: 2026-05-04 00:00:00 UTC (a Monday). Used as `from` for tests
// that need a known weekday/month context.
const MONDAY_2026_05_04 = Date.UTC(2026, 4, 4, 0, 0, 0); // month is 0-indexed

describe("nextNRuns", () => {
  it('returns 7 dates 4 hours apart for "0 */4 * * *", all on the :00', () => {
    const out = nextNRuns("0 */4 * * *", 7, MONDAY_2026_05_04);
    expect(out).toHaveLength(7);
    for (const d of out) {
      expect(d.getUTCMinutes()).toBe(0);
      expect(d.getUTCHours() % 4).toBe(0);
    }
    for (let i = 1; i < out.length; i += 1) {
      const delta = out[i]!.getTime() - out[i - 1]!.getTime();
      expect(delta).toBe(4 * 60 * 60 * 1000);
    }
  });

  it('returns 3 midnights 24h apart for "@daily"', () => {
    const out = nextNRuns("@daily", 3, MONDAY_2026_05_04);
    expect(out).toHaveLength(3);
    for (const d of out) {
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    }
    expect(out[1]!.getTime() - out[0]!.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(out[2]!.getTime() - out[1]!.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('returns 4 Sundays at 00:00 for "0 0 * * 0"', () => {
    const out = nextNRuns("0 0 * * 0", 4, MONDAY_2026_05_04);
    expect(out).toHaveLength(4);
    for (const d of out) {
      // 0 = Sunday
      expect(d.getUTCDay()).toBe(0);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    }
    // Spacing is exactly 7 days
    expect(out[1]!.getTime() - out[0]!.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
  });

  it('returns 5 quarter-hours for "0,15,30,45 * * * *"', () => {
    const out = nextNRuns("0,15,30,45 * * * *", 5, MONDAY_2026_05_04);
    expect(out).toHaveLength(5);
    for (const d of out) {
      expect([0, 15, 30, 45]).toContain(d.getUTCMinutes());
    }
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]!.getTime() - out[i - 1]!.getTime()).toBe(15 * 60 * 1000);
    }
  });

  it('returns [] for parser-rejected ("invalid")', () => {
    expect(nextNRuns("invalid", 7, MONDAY_2026_05_04)).toEqual([]);
  });

  it("returns at most N entries even if the pattern fires more often", () => {
    // Every minute, 3 requested → should return exactly 3.
    const out = nextNRuns("* * * * *", 3, MONDAY_2026_05_04);
    expect(out).toHaveLength(3);
  });

  it("returns [] for impossible patterns (Feb 31 — never fires)", () => {
    // Day-of-month=31, month=Feb — never fires. Smart-skip walker
    // hops Feb→Feb without ever hitting a valid day, exhausts horizon,
    // returns []. (Previously bailed at a 7-day window; now bounded
    // by the 5-year horizon and iteration ceiling.)
    expect(nextNRuns("0 0 31 2 *", 7, MONDAY_2026_05_04)).toEqual([]);
  });

  it('returns 3 yearly fires for "@yearly" (year apart, Jan 1)', () => {
    // Anchor: 2026-05-04. First fire: 2027-01-01, then 2028, 2029.
    const out = nextNRuns("@yearly", 3, MONDAY_2026_05_04);
    expect(out).toHaveLength(3);
    for (const d of out) {
      expect(d.getUTCMonth()).toBe(0); // January
      expect(d.getUTCDate()).toBe(1);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    }
    expect(out[0]!.getUTCFullYear()).toBe(2027);
    expect(out[1]!.getUTCFullYear()).toBe(2028);
    expect(out[2]!.getUTCFullYear()).toBe(2029);
  });

  it('returns Jan-1 dates for "0 0 1 1 *" (canonical @yearly)', () => {
    const out = nextNRuns("0 0 1 1 *", 5, MONDAY_2026_05_04);
    expect(out).toHaveLength(5);
    for (const d of out) {
      expect(d.getUTCMonth()).toBe(0);
      expect(d.getUTCDate()).toBe(1);
    }
    // Five distinct years, each one apart.
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]!.getUTCFullYear() - out[i - 1]!.getUTCFullYear()).toBe(1);
    }
  });

  it('returns 5 fires for "@yearly × 5" anchored just before a leap year (M4 fix)', () => {
    // Pre-M4: MAX_HORIZON_MS was 5 × 365 days = 1825 days. For an
    // anchor late in 2027 (just before 2028 leap year), the 5th
    // @yearly fire (2032-01-01) lands past 1825 days — counted from
    // 2027-12-31 it's ~1827 days because the window straddles 2028
    // AND 2032. Post-M4: horizon is 5 × 366 days, comfortably covers it.
    const lateInYearBeforeLeap = Date.UTC(2027, 11, 31, 0, 0, 0);
    const out = nextNRuns("@yearly", 5, lateInYearBeforeLeap);
    expect(out).toHaveLength(5);
    expect(out[0]!.getUTCFullYear()).toBe(2028);
    expect(out[4]!.getUTCFullYear()).toBe(2032);
  });

  it('returns Feb-29 dates for "0 0 29 2 *" (leap-year only)', () => {
    // Anchor: 2026-05-04. Next leap years: 2028, 2032, 2036, 2040, 2044
    // → all five inside the 5-year horizon (max ~2031). So we get only
    // 1 fire (2028-02-29). Walker MUST find it without bailing at 7 days.
    const out = nextNRuns("0 0 29 2 *", 3, MONDAY_2026_05_04);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.length).toBeLessThanOrEqual(2);
    for (const d of out) {
      expect(d.getUTCMonth()).toBe(1); // February
      expect(d.getUTCDate()).toBe(29);
      // Year must be a leap year.
      const y = d.getUTCFullYear();
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      expect(isLeap).toBe(true);
    }
  });

  it('honors dom/dow OR semantics for "0 0 1 * 1" (Mondays OR 1sts)', () => {
    const out = nextNRuns("0 0 1 * 1", 7, MONDAY_2026_05_04);
    expect(out).toHaveLength(7);
    for (const d of out) {
      const isMonday = d.getUTCDay() === 1;
      const isFirst = d.getUTCDate() === 1;
      expect(isMonday || isFirst).toBe(true);
      expect(d.getUTCHours()).toBe(0);
      expect(d.getUTCMinutes()).toBe(0);
    }
    // Should be a mix — there's at least one Monday-not-1st and one
    // 1st-not-Monday in any 7-fire window starting from a Monday in May.
    const hasMondayNot1st = out.some(
      (d) => d.getUTCDay() === 1 && d.getUTCDate() !== 1,
    );
    expect(hasMondayNot1st).toBe(true);
  });

  it('Sunday equivalence: "0 0 * * 0" and "0 0 * * 7" produce identical output', () => {
    const a = nextNRuns("0 0 * * 0", 4, MONDAY_2026_05_04);
    const b = nextNRuns("0 0 * * 7", 4, MONDAY_2026_05_04);
    expect(a.map((d) => d.getTime())).toEqual(b.map((d) => d.getTime()));
  });

  it("@yearly performance: returns 5 fires in well under 50ms", () => {
    const t0 = performance.now();
    const out = nextNRuns("@yearly", 5, MONDAY_2026_05_04);
    const elapsed = performance.now() - t0;
    expect(out).toHaveLength(5);
    // Smart-skip should be near-instant. Generous bound to avoid CI
    // flake; the linear walker would take ~180ms for 5 yearly fires.
    expect(elapsed).toBeLessThan(50);
  });

  it("coerces NaN/fractional/negative N defensively", () => {
    // NaN → 0 → []
    expect(nextNRuns("@daily", Number.NaN, MONDAY_2026_05_04)).toEqual([]);
    // -1 → 0 → []
    expect(nextNRuns("@daily", -1, MONDAY_2026_05_04)).toEqual([]);
    // 1.5 → floor(1.5) = 1
    const out = nextNRuns("@daily", 1.5, MONDAY_2026_05_04);
    expect(out).toHaveLength(1);
    expect(out[0]).toBeInstanceOf(Date);
  });

  it("is deterministic given a fixed `from` timestamp", () => {
    const a = nextNRuns("0 */6 * * *", 5, MONDAY_2026_05_04);
    const b = nextNRuns("0 */6 * * *", 5, MONDAY_2026_05_04);
    expect(a.map((d) => d.getTime())).toEqual(b.map((d) => d.getTime()));
  });

  it("starts strictly after `from` (never returns the anchor itself)", () => {
    const out = nextNRuns("0 0 * * *", 1, MONDAY_2026_05_04);
    expect(out).toHaveLength(1);
    expect(out[0]!.getTime()).toBeGreaterThan(MONDAY_2026_05_04);
    // First fire after midnight Monday is midnight Tuesday.
    expect(out[0]!.getUTCDate()).toBe(5);
  });

  it("returns [] for empty / negative N", () => {
    expect(nextNRuns("@daily", 0, MONDAY_2026_05_04)).toEqual([]);
    expect(nextNRuns("@daily", -1, MONDAY_2026_05_04)).toEqual([]);
  });

  it('honors "@hourly" macro', () => {
    const out = nextNRuns("@hourly", 4, MONDAY_2026_05_04);
    expect(out).toHaveLength(4);
    for (const d of out) {
      expect(d.getUTCMinutes()).toBe(0);
    }
    expect(out[1]!.getTime() - out[0]!.getTime()).toBe(60 * 60 * 1000);
  });

  it('honors weekday-only "0 0 * * 1-5" (no Sat/Sun fires)', () => {
    // Anchor is Monday. Walking 7 days forward there are 5 weekday fires.
    const out = nextNRuns("0 0 * * 1-5", 5, MONDAY_2026_05_04);
    expect(out).toHaveLength(5);
    for (const d of out) {
      const day = d.getUTCDay();
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(5);
    }
  });

  it("returns Date objects, not numbers", () => {
    const out = nextNRuns("@daily", 1, MONDAY_2026_05_04);
    expect(out[0]).toBeInstanceOf(Date);
  });
});
