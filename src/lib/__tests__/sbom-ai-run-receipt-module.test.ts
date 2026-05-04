import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CASSETTE_HASH_PREFIX,
  PREDICATE_URI_BY_KIND,
  formatCassetteHash,
  sbomAiRunReceiptModule,
} from "../sbom-ai/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: sbomAiRunReceiptModule });
  sys.start();
  return sys;
}

describe("sbomAiRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with publish-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("publish pending");
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.verdictColor).toBe("gray");
    expect(sys.derive.lookupUrl).toBeNull();
  });

  it("isPublished requires anchored + verdict='published'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "published";
    expect(sys.derive.isPublished).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("verdictColor is binary (no amber)", () => {
    const sys = setup();
    for (const v of [
      "hash-mismatch",
      "kind-mismatch",
      "bundle-malformed",
      "not-found",
      "fetch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("hashesMatch compares (case-insensitive) when both present", () => {
    const sys = setup();
    sys.facts.expectedSha256 = "ABC".repeat(22);
    sys.facts.computedSha256 = "abc".repeat(22);
    expect(sys.derive.hashesMatch).toBe(true);
    sys.facts.expectedSha256 = "a".repeat(64);
    sys.facts.computedSha256 = "b".repeat(64);
    expect(sys.derive.hashesMatch).toBe(false);
  });

  it("lookupUrl points at /bureau/sbom-ai/<sha256>", () => {
    const sys = setup();
    sys.facts.computedSha256 = "abc".repeat(22).toLowerCase();
    expect(sys.derive.lookupUrl).toBe(
      `/bureau/sbom-ai/${"abc".repeat(22).toLowerCase()}`,
    );
  });

  it("predicate URIs are per-kind canonical wire forms", () => {
    expect(PREDICATE_URI_BY_KIND["probe-pack"]).toBe(
      "https://pluck.run/SbomAi/ProbePack/v1",
    );
    expect(PREDICATE_URI_BY_KIND["model-card"]).toBe(
      "https://pluck.run/SbomAi/ModelCard/v1",
    );
    expect(PREDICATE_URI_BY_KIND["mcp-server"]).toBe(
      "https://pluck.run/SbomAi/McpServer/v1",
    );
  });
});

describe("formatCassetteHash (sbom-ai)", () => {
  it("prefixes 64-hex hash with 'local:'", () => {
    const h = "0123456789abcdef".repeat(4);
    expect(formatCassetteHash(h)).toBe(`${CASSETTE_HASH_PREFIX}${h}`);
  });
  it("idempotent on already-prefixed", () => {
    const p = "local:" + "0".repeat(64);
    expect(formatCassetteHash(p)).toBe(p);
  });
});
