import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  ARTIFACT_KIND_LABELS,
  isValidSha256,
  sbomAiRunFormModule,
} from "../sbom-ai/run-form-module.js";

function makeSystem() {
  const sys = createSystem({ module: sbomAiRunFormModule });
  sys.start();
  return sys;
}

describe("sbomAiRunFormModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with sensible defaults", () => {
    const sys = setup();
    expect(sys.facts.artifactKind).toBe("probe-pack");
    expect(sys.facts.expectedSha256).toBe("");
    expect(sys.derive.canSubmit).toBe(false);
    expect(sys.derive.hasExpectedHash).toBe(false);
  });

  it("canSubmit requires URL + ack", () => {
    const sys = setup();
    sys.facts.artifactUrl = "https://example.com/pack.json";
    expect(sys.derive.canSubmit).toBe(false);
    sys.facts.authorizationAcknowledged = true;
    expect(sys.derive.canSubmit).toBe(true);
  });

  it("canSubmit blocks malformed expected sha256", () => {
    const sys = setup();
    sys.facts.artifactUrl = "https://example.com/pack.json";
    sys.facts.authorizationAcknowledged = true;
    sys.facts.expectedSha256 = "not-hex";
    expect(sys.derive.canSubmit).toBe(false);
  });

  it("canSubmit accepts well-formed expected sha256", () => {
    const sys = setup();
    sys.facts.artifactUrl = "https://example.com/pack.json";
    sys.facts.authorizationAcknowledged = true;
    sys.facts.expectedSha256 = "a".repeat(64);
    expect(sys.derive.canSubmit).toBe(true);
    expect(sys.derive.hasExpectedHash).toBe(true);
  });

  it("hasExpectedHash tracks whether the optional input is filled", () => {
    const sys = setup();
    expect(sys.derive.hasExpectedHash).toBe(false);
    sys.facts.expectedSha256 = "  ";
    expect(sys.derive.hasExpectedHash).toBe(false);
    sys.facts.expectedSha256 = "a".repeat(64);
    expect(sys.derive.hasExpectedHash).toBe(true);
  });
});

describe("isValidSha256", () => {
  it("accepts 64 hex chars (case-insensitive)", () => {
    expect(isValidSha256("a".repeat(64))).toBe(true);
    expect(isValidSha256("A".repeat(64))).toBe(true);
  });
  it("rejects shorter / longer / non-hex", () => {
    expect(isValidSha256("a".repeat(63))).toBe(false);
    expect(isValidSha256("a".repeat(65))).toBe(false);
    expect(isValidSha256("not-hex")).toBe(false);
  });
});

describe("ARTIFACT_KIND_LABELS", () => {
  it("covers all three artifact kinds", () => {
    expect(Object.keys(ARTIFACT_KIND_LABELS).length).toBe(3);
    expect(ARTIFACT_KIND_LABELS["probe-pack"]).toMatch(/Probe-pack/);
    expect(ARTIFACT_KIND_LABELS["model-card"]).toMatch(/Model card/);
    expect(ARTIFACT_KIND_LABELS["mcp-server"]).toMatch(/MCP/);
  });
});
