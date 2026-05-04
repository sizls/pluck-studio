// ---------------------------------------------------------------------------
// custodyRunReceiptModule — Directive module for the CUSTODY receipt
// ---------------------------------------------------------------------------
//
// Holds the live state of a single CUSTODY bundle verification.
// Output shape:
//   - top-level FRE 902(13) compliance verdict
//   - per-check breakdown (the verifier returns a list of named
//     check results; admissibility argument requires each to be
//     individually auditable)
//   - WebAuthn attestation summary (the keystone for Daubert)
//
// Verdicts (canonical, anchored on the /bureau/custody landing):
//   - compliant         — bundle passes all FRE 902(13) checks
//   - webauthn-missing  — Daubert fails: signer key isn't bound to
//                          a WebAuthn-registered passkey
//   - signature-invalid — DSSE / Ed25519 signature did not verify
//   - dom-hash-mismatch — DOM snapshot's sha256 doesn't match the
//                          claimed hash (capture tampered with)
//   - cassette-mismatch — fetch-cassette body hashes don't match
//                          the recorded envelopeHash
//   - bundle-malformed  — JSON / schema invalid
//   - not-found         — HTTPS 404 / no bundle at the URL
//   - fetch-failed      — non-200, redirect, oversize (>256 KiB), >10s,
//                          non-https, network error
//
// Per-check breakdown enumerates: signature-valid, dom-hash-valid,
// cassettes-valid, webauthn-valid, schema-valid, ts-monotonic, ttl-ok.
// Each is binary pass/fail; the receipt UI shows them as a checkboxes
// table so an attorney can read "everything required for FRE 902(13)
// admissibility passed" at a glance.
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type ReceiptStatus =
  | "verification pending"
  | "fetching"
  | "verifying"
  | "anchoring"
  | "anchored"
  | "failed";

export type Verdict =
  | "compliant"
  | "webauthn-missing"
  | "signature-invalid"
  | "dom-hash-mismatch"
  | "cassette-mismatch"
  | "bundle-malformed"
  | "not-found"
  | "fetch-failed";

/** Individual FRE 902(13) check results, surfaced on the receipt as
 *  a binary pass/fail table the attorney can read at a glance. */
export interface ComplianceCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string | null;
}

export interface WebAuthnAttestation {
  /** AAGUID of the authenticator (e.g. iCloud Keychain, YubiKey). */
  aaguid: string;
  /** True when the AAGUID is in the FIDO MDS allowlist. */
  trusted: boolean;
  /** Display name for the authenticator (vendor + model when known). */
  authenticatorName?: string | null;
}

/** CUSTODY spec predicateType (canonical, surfaced in the receipt UI). */
export const CUSTODY_PREDICATE_URI = "https://pluck.run/CustodyBundle/v1";

/** Bureau R1 convention: 64-char hex SPKI fingerprint. */
export const SPKI_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

/** Bureau cassette wire prefix (shared with FINGERPRINT). */
export const CASSETTE_HASH_PREFIX = "local:";

/**
 * Canonicalize a raw 64-hex-char SHA-256 into the Bureau wire form
 * `local:<sha256>`. Idempotent on already-prefixed input. Returns
 * input unchanged on malformed hashes so the receipt UI doesn't
 * silently drop debug data.
 */
export function formatCassetteHash(raw: string): string {
  if (raw.length === 0) {
    return raw;
  }
  if (raw.startsWith(CASSETTE_HASH_PREFIX)) {
    return raw;
  }
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return `${CASSETTE_HASH_PREFIX}${raw.toLowerCase()}`;
  }
  return raw;
}

export const custodyRunReceiptModule = createModule("custody-run-receipt", {
  schema: {
    facts: {
      id: t.string(),
      status: t.string<ReceiptStatus>(),
      verdict: t.string<Verdict>().nullable(),
      verdictDetail: t.string().nullable(),
      bundleUrl: t.string().nullable(),
      bundleHash: t.string().nullable(),
      vendor: t.string().nullable(),
      expectedVendor: t.string().nullable(),
      capturedAt: t.string().nullable(),
      checks: t.array<ComplianceCheck>().nullable(),
      webauthn: t.object<WebAuthnAttestation>().nullable(),
      signerFingerprint: t.string().nullable(),
      receiptUrl: t.string().nullable(),
      rekorUuid: t.string().nullable(),
    },
    derivations: {
      isPending: t.boolean(),
      isCompliant: t.boolean(),
      isFailure: t.boolean(),
      verdictColor: t.string<"gray" | "red" | "green">(),
      passedCheckCount: t.number(),
      failedCheckCount: t.number(),
      hasFailingCheck: t.boolean(),
    },
  },

  init: (facts) => {
    facts.id = "";
    facts.status = "verification pending";
    facts.verdict = null;
    facts.verdictDetail = null;
    facts.bundleUrl = null;
    facts.bundleHash = null;
    facts.vendor = null;
    facts.expectedVendor = null;
    facts.capturedAt = null;
    facts.checks = null;
    facts.webauthn = null;
    facts.signerFingerprint = null;
    facts.receiptUrl = null;
    facts.rekorUuid = null;
  },

  derive: {
    isPending: (facts) =>
      facts.status === "verification pending" ||
      facts.status === "fetching" ||
      facts.status === "verifying" ||
      facts.status === "anchoring",
    isCompliant: (facts) =>
      facts.status === "anchored" && facts.verdict === "compliant",
    isFailure: (facts) =>
      facts.status === "failed" ||
      (facts.verdict !== null && facts.verdict !== "compliant"),
    verdictColor: (facts) => {
      if (facts.verdict === null) {
        return "gray";
      }
      if (facts.verdict === "compliant") {
        return "green";
      }
      // CUSTODY is binary: either it passes FRE 902(13) or it doesn't.
      // No "amber" state — admissibility either holds or it doesn't.
      return "red";
    },
    passedCheckCount: (facts) =>
      facts.checks === null ? 0 : facts.checks.filter((c) => c.passed).length,
    failedCheckCount: (facts) =>
      facts.checks === null ? 0 : facts.checks.filter((c) => !c.passed).length,
    hasFailingCheck: (facts) =>
      facts.checks !== null && facts.checks.some((c) => !c.passed),
  },
});
