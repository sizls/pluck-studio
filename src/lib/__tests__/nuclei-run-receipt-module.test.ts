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

  it("isPublished requires anchored + verdict='published' + verified tier", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "published";
    sys.facts.trustTier = "verified";
    expect(sys.derive.isPublished).toBe(true);
    expect(sys.derive.isVerifiedTier).toBe(true);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("ingested-tier publish maps to amber (consumers refuse)", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "published";
    sys.facts.trustTier = "ingested";
    expect(sys.derive.isVerifiedTier).toBe(false);
    expect(sys.derive.verdictColor).toBe("amber");
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
