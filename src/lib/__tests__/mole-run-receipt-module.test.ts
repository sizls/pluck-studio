import { createSystem } from "@directive-run/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  CANARY_DOCUMENT_PREDICATE_URI,
  MEMORIZATION_VERDICT_PREDICATE_URI,
  formatCassetteHash,
  moleRunReceiptModule,
} from "../mole/run-receipt-module.js";

function makeSystem() {
  const sys = createSystem({ module: moleRunReceiptModule });
  sys.start();
  return sys;
}

describe("moleRunReceiptModule", () => {
  let active: ReturnType<typeof makeSystem> | null = null;
  function setup() {
    active = makeSystem();
    return active;
  }
  afterEach(() => {
    active?.destroy();
    active = null;
  });

  it("initializes with seal-pending defaults", () => {
    const sys = setup();
    expect(sys.facts.status).toBe("seal pending");
    expect(sys.derive.isPending).toBe(true);
    expect(sys.derive.verdictColor).toBe("gray");
  });

  it("isSealed requires anchored + verdict='sealed'", () => {
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "sealed";
    expect(sys.derive.isSealed).toBe(true);
    expect(sys.derive.isReWitnessed).toBe(false);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("verdict='re-witnessed' → green + isSealed=true + isReWitnessed=true", () => {
    // ROTATE emits KeyRevocation/v1 + ReWitnessReport/v1 when an
    // operator's signing key rotates. The canary's original Rekor
    // timestamp is untouched — only the signing identity is re-attested
    // by the successor key. Operationally indistinguishable from
    // 'sealed' for downstream verifiers; verdict tag is for audit-trail.
    const sys = setup();
    sys.facts.status = "anchored";
    sys.facts.verdict = "re-witnessed";
    expect(sys.derive.isSealed).toBe(true);
    expect(sys.derive.isReWitnessed).toBe(true);
    expect(sys.derive.isFailure).toBe(false);
    expect(sys.derive.verdictColor).toBe("green");
  });

  it("verdictColor is binary green/red — no amber", () => {
    const sys = setup();
    for (const v of [
      "canary-too-short",
      "fingerprints-not-found",
      "duplicate-canary",
      "fetch-failed",
    ] as const) {
      sys.facts.verdict = v;
      expect(sys.derive.verdictColor).toBe("red");
    }
  });

  it("isPending covers fetching-canary + hashing + anchoring", () => {
    const sys = setup();
    for (const s of [
      "seal pending",
      "fetching-canary",
      "hashing",
      "anchoring",
    ] as const) {
      sys.facts.status = s;
      expect(sys.derive.isPending).toBe(true);
    }
  });

  it("schema exposes sha256 + byteLength + fingerprintPhrases (privacy-safe metadata only)", () => {
    const sys = setup();
    // The schema's privacy invariant: only sha256 + length +
    // fingerprint phrases enter the receipt; the canary body never
    // does. Read the metadata fields explicitly to confirm they're
    // typed (and default null on init).
    expect(sys.facts.canarySha256).toBeNull();
    expect(sys.facts.canaryByteLength).toBeNull();
    expect(sys.facts.fingerprintPhrases).toBeNull();
    // Codified as a grep-comment + module-source comment: the receipt
    // module's schema MUST NEVER add a `canaryBody` / `canaryContent`
    // fact. Any future PR doing so should fail review on the basis of
    // this explicit invariant.
  });

  it("predicate URIs are canonical wire forms", () => {
    expect(CANARY_DOCUMENT_PREDICATE_URI).toBe(
      "https://pluck.run/CanaryDocument/v1",
    );
    expect(MEMORIZATION_VERDICT_PREDICATE_URI).toBe(
      "https://pluck.run/MemorizationVerdict/v1",
    );
  });
});

describe("formatCassetteHash (mole)", () => {
  it("prefixes 64-hex hash with 'local:'", () => {
    const h = "0123456789abcdef".repeat(4);
    expect(formatCassetteHash(h)).toBe("local:" + h);
  });
  it("idempotent on already-prefixed", () => {
    const p = "local:" + "0".repeat(64);
    expect(formatCassetteHash(p)).toBe(p);
  });
});
