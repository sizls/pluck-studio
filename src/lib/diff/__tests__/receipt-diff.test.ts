// ---------------------------------------------------------------------------
// receipt-diff.test — pure aggregator unit tests
// ---------------------------------------------------------------------------
// Locks the contract: same inputs → same output across renders, tests,
// and route invocations. Tests run against vendor-preview stub data —
// when pluck-api lands, these tests rebind to live data.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  diffReceipts,
  formatTimeDelta,
  sampleCrossVendorPair,
  sampleDiffPair,
} from "../receipt-diff.js";

const OPENAI_DRAGNET_GREEN = "openai-bold-marlin-1188";
const OPENAI_DRAGNET_AMBER = "openai-quiet-otter-2210";
const OPENAI_OATH_GREEN = "openai-swift-falcon-3742";
const OPENAI_FINGERPRINT_GREEN = "openai-stable-eagle-5544";
const ANTHROPIC_DRAGNET_GREEN = "anthropic-bold-marlin-1188";

describe("diffReceipts — happy path", () => {
  it("ok kind for same-vendor same-program with sameProgram=true", () => {
    const result = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_DRAGNET_AMBER);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    expect(result.diff.sameVendor).toBe(true);
    expect(result.diff.sameProgram).toBe(true);
    expect(result.diff.vendorScope).toBe("openai");
    expect(result.diff.base.phraseId).toBe(OPENAI_DRAGNET_GREEN);
    expect(result.diff.target.phraseId).toBe(OPENAI_DRAGNET_AMBER);
  });

  it("ok kind for same-vendor different-program with sameProgram=false", () => {
    const result = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_OATH_GREEN);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    expect(result.diff.sameVendor).toBe(true);
    expect(result.diff.sameProgram).toBe(false);
    expect(result.diff.base.programSlug).toBe("dragnet");
    expect(result.diff.target.programSlug).toBe("oath");
  });

  it("flags verdict change when colors differ; not when they match", () => {
    const flipped = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_DRAGNET_AMBER);
    const same = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_OATH_GREEN);
    if (flipped.kind !== "ok" || same.kind !== "ok") throw new Error("expected ok");
    expect(flipped.diff.verdictChanged).toBe(true);
    expect(same.diff.verdictChanged).toBe(false);
  });

  it("flags summary change when summaries differ", () => {
    const result = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_OATH_GREEN);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.diff.summaryChanged).toBe(true);
  });

  it("computes timeDeltaMs as target - base, signed (negative when reordered)", () => {
    const forward = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_DRAGNET_AMBER);
    const reversed = diffReceipts(OPENAI_DRAGNET_AMBER, OPENAI_DRAGNET_GREEN);
    if (forward.kind !== "ok" || reversed.kind !== "ok") throw new Error("expected ok");
    expect(forward.diff.timeDeltaMs).toBe(
      forward.diff.target.capturedAt.getTime() - forward.diff.base.capturedAt.getTime(),
    );
    expect(forward.diff.timeDeltaMs).toBe(-reversed.diff.timeDeltaMs);
  });
});

describe("diffReceipts — different vendors", () => {
  it("returns different-vendors kind with both sides resolved for context", () => {
    const result = diffReceipts(OPENAI_DRAGNET_GREEN, ANTHROPIC_DRAGNET_GREEN);
    expect(result.kind).toBe("different-vendors");
    if (result.kind !== "different-vendors") throw new Error("unreachable");
    expect(result.baseScope).toBe("openai");
    expect(result.targetScope).toBe("anthropic");
    expect(result.base.phraseId).toBe(OPENAI_DRAGNET_GREEN);
    expect(result.target.phraseId).toBe(ANTHROPIC_DRAGNET_GREEN);
  });
});

describe("diffReceipts — invalid input", () => {
  it("invalid-phrase { which: 'base' } when base is unparseable", () => {
    const result = diffReceipts("garbage", OPENAI_DRAGNET_GREEN);
    expect(result.kind).toBe("invalid-phrase");
    if (result.kind !== "invalid-phrase") throw new Error("unreachable");
    expect(result.which).toBe("base");
  });

  it("invalid-phrase { which: 'target' } when target is unparseable", () => {
    const result = diffReceipts(OPENAI_DRAGNET_GREEN, "garbage");
    expect(result.kind).toBe("invalid-phrase");
    if (result.kind !== "invalid-phrase") throw new Error("unreachable");
    expect(result.which).toBe("target");
  });

  it("rejects bare 3-part phrase IDs (search needs the scoped form)", () => {
    const result = diffReceipts("bold-marlin-1188", OPENAI_DRAGNET_GREEN);
    expect(result.kind).toBe("invalid-phrase");
  });
});

describe("diffReceipts — not-found", () => {
  it("not-found { which, phraseId } when receipt isn't in the store", () => {
    const baseGone = diffReceipts("openai-zzzzz-zzzzz-9999", OPENAI_DRAGNET_GREEN);
    expect(baseGone.kind).toBe("not-found");
    if (baseGone.kind !== "not-found") throw new Error("unreachable");
    expect(baseGone.which).toBe("base");
    expect(baseGone.phraseId).toBe("openai-zzzzz-zzzzz-9999");

    const targetGone = diffReceipts(OPENAI_DRAGNET_GREEN, "openai-zzzzz-zzzzz-9999");
    expect(targetGone.kind).toBe("not-found");
    if (targetGone.kind !== "not-found") throw new Error("unreachable");
    expect(targetGone.which).toBe("target");
  });
});

describe("diffReceipts — purity + determinism", () => {
  it("same inputs → same outputs across calls", () => {
    const a = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_DRAGNET_AMBER);
    const b = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_DRAGNET_AMBER);
    expect(a.kind).toBe(b.kind);
    if (a.kind === "ok" && b.kind === "ok") {
      expect(a.diff.timeDeltaMs).toBe(b.diff.timeDeltaMs);
      expect(a.diff.verdictChanged).toBe(b.diff.verdictChanged);
    }
  });

  it("normalizes case + whitespace (mirrors phrase-id parser)", () => {
    const result = diffReceipts("  OPENAI-BOLD-MARLIN-1188  ", OPENAI_DRAGNET_AMBER);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("unreachable");
    expect(result.diff.base.phraseId).toBe(OPENAI_DRAGNET_GREEN);
  });

  it("each side carries the program's receipt URL + accent", () => {
    const result = diffReceipts(OPENAI_DRAGNET_GREEN, OPENAI_FINGERPRINT_GREEN);
    if (result.kind !== "ok") throw new Error("expected ok");
    expect(result.diff.base.receiptUrl).toBe(`/bureau/dragnet/runs/${OPENAI_DRAGNET_GREEN}`);
    expect(result.diff.target.receiptUrl).toBe(`/bureau/fingerprint/runs/${OPENAI_FINGERPRINT_GREEN}`);
    expect(result.diff.base.programAccent).toBe("#a3201d");
  });
});

describe("formatTimeDelta", () => {
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  it("formats days/hours/minutes with signed direction", () => {
    expect(formatTimeDelta(2 * DAY)).toBe("2 days later");
    expect(formatTimeDelta(1 * DAY)).toBe("1 day later");
    expect(formatTimeDelta(3 * HOUR)).toBe("3 hours later");
    expect(formatTimeDelta(1 * HOUR)).toBe("1 hour later");
    expect(formatTimeDelta(10 * 60_000)).toBe("10 minutes later");
    expect(formatTimeDelta(-2 * DAY)).toBe("2 days earlier");
  });

  it("clamps to >= 1 minute (never returns 0)", () => {
    expect(formatTimeDelta(0)).toBe("1 minute later");
  });
});

describe("sample helpers", () => {
  it("sampleDiffPair returns two valid same-vendor phrase IDs", () => {
    expect(diffReceipts(sampleDiffPair().base, sampleDiffPair().target).kind).toBe("ok");
  });

  it("sampleCrossVendorPair returns two valid different-vendor phrase IDs", () => {
    const sample = sampleCrossVendorPair();
    expect(diffReceipts(sample.base, sample.target).kind).toBe("different-vendors");
  });
});
