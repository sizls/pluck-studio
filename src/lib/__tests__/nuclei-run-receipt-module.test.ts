import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  BOUNTY_CLAIM_PREDICATE_URI,
  BOUNTY_OFFER_PREDICATE_URI,
  NUCLEI_PACK_ENTRY_PREDICATE_URI,
  nucleiRunReceiptModule,
} from "../nuclei/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: nucleiRunReceiptModule });
  sys.start();
  return sys;
}

describe("nucleiRunReceiptModule", () => {
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
  });

  it("isPublished + isFullyVerified for verdict='published' (tier=verified)", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "published";
    sys.facts.trustTier = "verified";
    expect(sys.derive.isPublished).toBe(true);
    expect(sys.derive.isFullyVerified).toBe(true);
    expect(sys.derive.isVerifiedTier).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("verdict='published-ingested-only' → amber + isPublished=true + isFullyVerified=false", () => {
    // Distinct verdict member: registry-fenced (anchored, but consumers
    // refuse to honor without SBOM-AI cross-reference). Removes the
    // 2-field (verdict + trustTier) join subscribers had to do before.
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "published-ingested-only";
    sys.facts.trustTier = "ingested";
    expect(sys.derive.isPublished).toBe(true);
    expect(sys.derive.isFullyVerified).toBe(false);
    expect(sys.derive.isVerifiedTier).toBe(false);
    expect(sys.derive.verdictColor).toBe("amber");
    expect(sys.derive.isFailure).toBe(false);
  });

  it("hard failures map to red", () => {
    const sys = setup();
    for (const v of [
      "sbom-not-found",
      "sbom-mismatch",
      "pack-already-published",
      "malformed-vendor-scope",
      "license-not-allowed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("packDossierUrl strips @<version> for the bare-slug route", () => {
    const sys = setup();
    sys.facts.author = "alice";
    sys.facts.packName = "canon-honesty@0.1";
    expect(sys.derive.packDossierUrl).toBe(
      "/bureau/nuclei/alice/canon-honesty",
    );
  });

  it("packDossierUrl is null when author or pack missing", () => {
    const sys = setup();
    expect(sys.derive.packDossierUrl).toBeNull();
  });

  it("predicate URIs are canonical wire forms", () => {
    expect(NUCLEI_PACK_ENTRY_PREDICATE_URI).toBe(
      "https://pluck.run/NucleiPackEntry/v1",
    );
    expect(BOUNTY_OFFER_PREDICATE_URI).toBe(
      "https://pluck.run/BountyOffer/v1",
    );
    expect(BOUNTY_CLAIM_PREDICATE_URI).toBe(
      "https://pluck.run/BountyClaim/v1",
    );
  });
});
