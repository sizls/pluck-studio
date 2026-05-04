// ---------------------------------------------------------------------------
// rotateRunFormModule — Directive module for the ROTATE rotate form
// ---------------------------------------------------------------------------
//
// Per the ROTATE landing's verb surface:
//   - revoke      — publish KeyRevocation/v1 signed by the OLD key
//                    (proves operator owns the compromised key)
//   - re-witness  — annotate prior-cassette uuids with the
//                    compromise window, signed by the NEW key
//   - verify-rotation — fail-closed verifier
//
// Studio's hosted activation: operator hands the OLD key SPKI + NEW
// key SPKI + reason category + ToS-ack. Studio's runner orchestrates
// the revoke + re-witness pair with the operator's stored signing
// keys. The form never touches private-key material.
//
// Reason categories (canonical):
//   - compromised — key disclosed, stolen, exposed
//   - routine     — scheduled rotation, no compromise
//   - lost        — key file lost or unrecoverable
// ---------------------------------------------------------------------------

import { createModule, t } from "@directive-run/core";

export type SubmitStatus = "idle" | "submitting" | "succeeded" | "failed";

export interface SubmitResult {
  runId: string;
  phraseId: string;
}

export type Reason = "compromised" | "routine" | "lost";

export const REASON_LABELS: Readonly<Record<Reason, string>> = Object.freeze({
  compromised: "Compromised (key disclosed, stolen, or exposed)",
  routine: "Routine (scheduled rotation, no compromise)",
  lost: "Lost (key file unrecoverable)",
});

const SPKI_PATTERN = /^[a-f0-9]{64}$/i;

export function isValidSpkiFingerprint(s: string): boolean {
  return SPKI_PATTERN.test(s);
}

export const rotateRunFormModule = createModule("rotate-run-form", {
  schema: {
    facts: {
      oldKeyFingerprint: t.string(),
      newKeyFingerprint: t.string(),
      reason: t.string<Reason>(),
      // Note for compromised + lost reasons — gives readers context
      // on the rotation. Not required.
      operatorNote: t.string(),
      authorizationAcknowledged: t.boolean(),
      submitStatus: t.string<SubmitStatus>(),
      errorMessage: t.string().nullable(),
      signInUrl: t.string().nullable(),
      lastResult: t.object<SubmitResult>().nullable(),
    },
    derivations: {
      isSubmitting: t.boolean(),
      canSubmit: t.boolean(),
      hasError: t.boolean(),
      needsSignIn: t.boolean(),
      keysAreDifferent: t.boolean(),
    },
  },

  init: (facts) => {
    facts.oldKeyFingerprint = "";
    facts.newKeyFingerprint = "";
    facts.reason = "compromised";
    facts.operatorNote = "";
    facts.authorizationAcknowledged = false;
    facts.submitStatus = "idle";
    facts.errorMessage = null;
    facts.signInUrl = null;
    facts.lastResult = null;
  },

  derive: {
    isSubmitting: (facts) => facts.submitStatus === "submitting",
    canSubmit: (facts) => {
      if (facts.submitStatus === "submitting") {
        return false;
      }
      const oldKey = facts.oldKeyFingerprint.trim().toLowerCase();
      const newKey = facts.newKeyFingerprint.trim().toLowerCase();
      if (!SPKI_PATTERN.test(oldKey) || !SPKI_PATTERN.test(newKey)) {
        return false;
      }
      // Old and new keys MUST differ — rotating to the same key is
      // a no-op that would corrupt the revocation ledger.
      if (oldKey === newKey) {
        return false;
      }
      if (!facts.authorizationAcknowledged) {
        return false;
      }
      return true;
    },
    hasError: (facts) => facts.errorMessage !== null,
    needsSignIn: (facts) => facts.signInUrl !== null,
    keysAreDifferent: (facts) => {
      const oldKey = facts.oldKeyFingerprint.trim().toLowerCase();
      const newKey = facts.newKeyFingerprint.trim().toLowerCase();
      if (oldKey.length === 0 || newKey.length === 0) {
        return true; // not yet filled in
      }
      return oldKey !== newKey;
    },
  },
});
