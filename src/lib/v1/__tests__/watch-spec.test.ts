// ---------------------------------------------------------------------------
// watch-spec — unit tests for enums + type guards
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  AUTONOMY_MODES,
  FETCHER_KINDS,
  isAutonomyMode,
  isFetcherKind,
  isWatchStatus,
  OBSERVATION_CLASSIFICATIONS,
  OBSERVATION_KINDS,
  WATCH_DEFAULTS,
  WATCH_STATUSES,
} from "../watch-spec.js";

describe("watch-spec — enums", () => {
  it("AUTONOMY_MODES has the three locked modes", () => {
    expect([...AUTONOMY_MODES].sort()).toEqual([
      "always-agent",
      "diff-gated",
      "full-auto",
    ]);
  });

  it("FETCHER_KINDS includes playwright + http + browserbase", () => {
    expect([...FETCHER_KINDS].sort()).toEqual([
      "browserbase",
      "http",
      "playwright",
    ]);
  });

  it("WATCH_STATUSES covers the full lifecycle", () => {
    expect([...WATCH_STATUSES].sort()).toEqual([
      "active",
      "archived",
      "failed",
      "paused",
      "running",
    ]);
  });

  it("OBSERVATION_KINDS includes failure-as-data", () => {
    expect([...OBSERVATION_KINDS].sort()).toEqual([
      "baseline",
      "error",
      "no-change",
      "observation",
    ]);
  });

  it("OBSERVATION_CLASSIFICATIONS includes layout-shifted (self-healing trigger)", () => {
    expect(OBSERVATION_CLASSIFICATIONS).toContain("layout-shifted");
  });

  it("defaults are reasonable", () => {
    expect(WATCH_DEFAULTS.confidenceThreshold).toBe(0.75);
    expect(WATCH_DEFAULTS.diffThreshold).toBe(0.02);
    expect(WATCH_DEFAULTS.dailyBudgetUsd).toBe(2.0);
    expect(WATCH_DEFAULTS.useVisionDefault).toBe(false);
  });
});

describe("watch-spec — type guards", () => {
  it("isAutonomyMode accepts valid modes", () => {
    expect(isAutonomyMode("full-auto")).toBe(true);
    expect(isAutonomyMode("diff-gated")).toBe(true);
    expect(isAutonomyMode("always-agent")).toBe(true);
  });

  it("isAutonomyMode rejects unknowns", () => {
    expect(isAutonomyMode("auto")).toBe(false);
    expect(isAutonomyMode("")).toBe(false);
    expect(isAutonomyMode("FULL-AUTO")).toBe(false);
  });

  it("isFetcherKind / isWatchStatus enforce membership", () => {
    expect(isFetcherKind("playwright")).toBe(true);
    expect(isFetcherKind("puppeteer")).toBe(false);
    expect(isWatchStatus("active")).toBe(true);
    expect(isWatchStatus("running")).toBe(true);
    expect(isWatchStatus("nope")).toBe(false);
  });
});
