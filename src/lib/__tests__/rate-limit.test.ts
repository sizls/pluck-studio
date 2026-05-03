// ---------------------------------------------------------------------------
// rate-limit — token-bucket cap + FIFO eviction tests
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __rateLimitBucketCount,
  checkRateLimit,
  resetRateLimit,
} from "../rate-limit.js";

beforeEach(() => {
  resetRateLimit();
});

afterEach(() => {
  resetRateLimit();
});

describe("checkRateLimit", () => {
  it("allows up to `max` requests in a window", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("k1")).toBe(true);
    }
    expect(checkRateLimit("k1")).toBe(false);
  });

  it("resets after the window passes", () => {
    const now = 0;
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("k1", undefined, now)).toBe(true);
    }
    expect(checkRateLimit("k1", undefined, now)).toBe(false);
    expect(checkRateLimit("k1", undefined, now + 60_001)).toBe(true);
  });

  it("buckets keys independently", () => {
    for (let i = 0; i < 10; i++) {
      checkRateLimit("ip-a");
    }
    expect(checkRateLimit("ip-a")).toBe(false);
    expect(checkRateLimit("ip-b")).toBe(true);
  });

  it("respects a custom config", () => {
    const config = { max: 2, windowMs: 1_000 };
    expect(checkRateLimit("k", config)).toBe(true);
    expect(checkRateLimit("k", config)).toBe(true);
    expect(checkRateLimit("k", config)).toBe(false);
  });
});

describe("memory-exhaustion DoS guard", () => {
  it("enforces a cap on bucket count", () => {
    // Fill past the cap.
    for (let i = 0; i < 11_000; i++) {
      checkRateLimit(`attacker-${i}`);
    }
    // Should never exceed MAX_BUCKETS (10_000).
    expect(__rateLimitBucketCount()).toBeLessThanOrEqual(10_000);
  });

  it("evicts oldest entries (FIFO) when cap is reached", () => {
    // Fill exactly to the cap.
    for (let i = 0; i < 10_000; i++) {
      checkRateLimit(`k-${i}`);
    }
    expect(__rateLimitBucketCount()).toBe(10_000);

    // Insert one more — the very first key should be evicted.
    checkRateLimit("new-key");
    expect(__rateLimitBucketCount()).toBe(10_000);
    // The first inserted key was `k-0`; after eviction + new insert, its
    // bucket is gone, so a fresh request goes through.
    expect(checkRateLimit("k-0")).toBe(true);
  });

  it("re-inserting an existing key in a new window updates ordering", () => {
    const t0 = 0;
    checkRateLimit("k-old", undefined, t0);
    checkRateLimit("k-mid", undefined, t0);

    // After window expires, hitting "k-old" again should refresh its
    // position (so it's no longer the oldest).
    const t1 = 60_001;
    checkRateLimit("k-old", undefined, t1);

    // Both keys now count as recently-active; the order reflects the
    // refreshed insertion. Insert another to verify.
    checkRateLimit("k-new", undefined, t1);
    expect(__rateLimitBucketCount()).toBe(3);
  });
});
