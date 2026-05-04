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

  it("returns [] when the pattern doesn't fire within 7 days (Feb 31)", () => {
    // Day-of-month=31, month=Feb — never fires.
    expect(nextNRuns("0 0 31 2 *", 7, MONDAY_2026_05_04)).toEqual([]);
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
