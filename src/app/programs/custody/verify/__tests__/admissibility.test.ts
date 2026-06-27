// ---------------------------------------------------------------------------
// CUSTODY verify — admissibility lookup contract tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  ADMISSIBILITY_RULES,
  admissibilityFor,
} from "../page.js";

describe("admissibilityFor", () => {
  it("returns the signature argument for any signer-related reason", () => {
    expect(admissibilityFor("DSSE signature mismatch")).toContain(
      "Signature failures break FRE 902(13)",
    );
    expect(admissibilityFor("signer key not registered")).toContain(
      "Signature failures break FRE 902(13)",
    );
  });

  it("maps WebAuthn-related reasons to the Daubert reliability argument", () => {
    const arg = admissibilityFor("webauthn attestation missing");
    expect(arg).toContain("Daubert reliability standard");
  });

  it("maps Merkle / chain-of-custody to the 803(6) argument", () => {
    expect(admissibilityFor("merkle leaf missing")).toContain(
      "FRE 803(6)",
    );
    expect(admissibilityFor("chain-of-custody discontinuity")).toContain(
      "FRE 803(6)",
    );
  });

  it("maps hash / digest mismatches to the bundle-altered argument", () => {
    const arg = admissibilityFor("bundle-hash mismatch on outer envelope");
    expect(arg).toContain("altered since signing");
  });

  it("maps timestamp anomalies to FRE 901(b)(9)", () => {
    expect(admissibilityFor("expired certificate")).toContain(
      "FRE 901(b)(9)",
    );
  });

  it("maps Rekor / transparency-log gaps to FRE 902(11)", () => {
    expect(admissibilityFor("rekor inclusion proof absent")).toContain(
      "FRE 902(11)",
    );
  });

  it("returns null for an unmatched reason so the UI still renders the raw text", () => {
    expect(admissibilityFor("totally unfamiliar verifier message")).toBeNull();
  });

  it("is case-insensitive on the match check", () => {
    expect(admissibilityFor("WEBAUTHN ATTESTATION FAIL")).toContain(
      "Daubert",
    );
  });

  it("has at least one rule per FRE / Daubert anchor named in the audit", () => {
    // Sanity check: each rule names a real evidentiary anchor in the
    // argument body so the page renders an actual legal hook rather
    // than generic prose.
    for (const rule of ADMISSIBILITY_RULES) {
      expect(rule.matches.length).toBeGreaterThan(0);
      expect(rule.argument.length).toBeGreaterThan(40);
    }
  });
});
