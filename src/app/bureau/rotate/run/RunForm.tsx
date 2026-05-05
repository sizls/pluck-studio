"use client";

// ---------------------------------------------------------------------------
// ROTATE Run form — Wave-3 migration to /v1/runs
// ---------------------------------------------------------------------------
//
// PRIVACY INVARIANT: this form NEVER posts private-key material. Only the
// PUBLIC SPKI fingerprints (sha256 of the public key) cross the wire. The
// operator's runner signs the revocation server-side with operator-held
// HSM keys. The shared validator (validateRotatePayload) backstops by
// REJECTING any payload key resembling private-key material.
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { useDerived, useFact } from "@directive-run/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  BureauButton,
  BureauCheckbox,
  BureauError,
  BureauHelpText,
  BureauInput,
  BureauLabel,
  BureauRadioGroup,
  BureauSignInPrompt,
  BureauTextarea,
} from "../../../../components/bureau-ui/forms";
import {
  REASON_LABELS,
  isValidSpkiFingerprint,
  rotateRunFormModule,
  type Reason,
} from "../../../../lib/rotate/run-form-module";

interface RunResponse {
  runId?: string;
  /** Legacy /api/bureau/rotate/run shape. */
  phraseId?: string;
  /** /v1/runs shape — receiptUrl returned alongside runId. */
  receiptUrl?: string;
  signInUrl?: string;
  error?: string;
}

/**
 * Build a per-submit idempotency key for the /v1/runs POST. Bucketed by
 * minute so a double-click within ~60s collapses to the same runId.
 * Mirrors the legacy synthesized key.
 */
function idempotencyKeyFor(
  reason: string,
  oldKey: string,
  newKey: string,
): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);

  return `rotate:${reason}:${oldKey}:${newKey}:${minuteBucket}`;
}

const REASON_OPTIONS: ReadonlyArray<{
  value: Reason;
  label: ReactNode;
  testId?: string;
}> = (["compromised", "routine", "lost"] as const).map((r) => ({
  value: r,
  label: REASON_LABELS[r],
  testId: `reason-${r}`,
}));

export function RotateRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: rotateRunFormModule });
    sys.start();
    return sys;
  }, []);

  const oldKeyFingerprint = useFact(system, "oldKeyFingerprint");
  const newKeyFingerprint = useFact(system, "newKeyFingerprint");
  const reason = useFact(system, "reason");
  const operatorNote = useFact(system, "operatorNote");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");
  const keysAreDifferent = useDerived(system, "keysAreDifferent");

  const setOldKey = useCallback(
    (v: string) => {
      system.facts.oldKeyFingerprint = v;
    },
    [system],
  );
  const setNewKey = useCallback(
    (v: string) => {
      system.facts.newKeyFingerprint = v;
    },
    [system],
  );
  const setReason = useCallback(
    (v: Reason) => {
      system.facts.reason = v;
    },
    [system],
  );
  const setOperatorNote = useCallback(
    (v: string) => {
      system.facts.operatorNote = v;
    },
    [system],
  );
  const setAuthAck = useCallback(
    (v: boolean) => {
      system.facts.authorizationAcknowledged = v;
    },
    [system],
  );

  const [clientGuardError, setClientGuardError] = useState<string | null>(null);

  useEffect(
    () => () => {
      system.destroy();
    },
    [system],
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const oldKey = (oldKeyFingerprint ?? "").trim().toLowerCase();
    const newKey = (newKeyFingerprint ?? "").trim().toLowerCase();
    if (!isValidSpkiFingerprint(oldKey)) {
      setClientGuardError("Old key fingerprint must be 64 hex characters.");
      return;
    }
    if (!isValidSpkiFingerprint(newKey)) {
      setClientGuardError("New key fingerprint must be 64 hex characters.");
      return;
    }
    if (oldKey === newKey) {
      setClientGuardError("Old and new fingerprints must differ.");
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const normalizedReason = reason ?? "compromised";
      const trimmedNote = (operatorNote ?? "").trim();

      // PRIVACY: payload contains ONLY public SPKI fingerprints. No
      // private-key material is ever forwarded — the runner signs
      // revocations server-side with operator-held HSM keys. The
      // shared validator REJECTS any payload key resembling private
      // key material (defense-in-depth).
      const res = await fetch("/api/v1/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline: "bureau:rotate",
          payload: {
            oldKeyFingerprint: oldKey,
            newKeyFingerprint: newKey,
            reason: normalizedReason,
            operatorNote: trimmedNote.length > 0 ? trimmedNote : undefined,
            authorizationAcknowledged: authAck,
          },
          idempotencyKey: idempotencyKeyFor(normalizedReason, oldKey, newKey),
        }),
      });
      const body = (await res.json()) as RunResponse;
      if (res.status === 401) {
        system.facts.signInUrl = body.signInUrl ?? "/sign-in";
        system.facts.submitStatus = "failed";
        return;
      }
      if (!res.ok || !body.runId) {
        system.facts.errorMessage =
          body.error ?? `Rotate failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.runId,
      };
      system.facts.submitStatus = "succeeded";
      router.push(body.receiptUrl ?? `/bureau/rotate/runs/${body.runId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="rotate-run-form">
      <BureauLabel text="Old key SPKI fingerprint">
        <BureauInput
          type="text"
          name="oldKeyFingerprint"
          required
          autoFocus
          placeholder="64 hex chars (the compromised / outgoing key)"
          value={oldKeyFingerprint ?? ""}
          onChange={setOldKey}
          testId="old-key-fingerprint"
        />
      </BureauLabel>
      <BureauHelpText>
        SPKI sha256 of the operator's outgoing Ed25519 public key. The
        runner signs the KeyRevocation/v1 with this key's private
        material to prove ownership before publishing.
      </BureauHelpText>

      <BureauLabel text="New key SPKI fingerprint">
        <BureauInput
          type="text"
          name="newKeyFingerprint"
          required
          placeholder="64 hex chars (the replacement key)"
          value={newKeyFingerprint ?? ""}
          onChange={setNewKey}
          testId="new-key-fingerprint"
        />
      </BureauLabel>
      <BureauHelpText>
        SPKI sha256 of the operator's incoming Ed25519 public key. Must
        differ from the old key — rotating to the same key is a no-op
        that would corrupt the revocation ledger.
      </BureauHelpText>
      {!keysAreDifferent ? (
        <p
          style={{ marginTop: 8, color: "#ff8888", fontSize: 12 }}
          data-testid="same-keys-warning"
        >
          Old and new fingerprints are identical — rotation will be
          rejected.
        </p>
      ) : null}

      <BureauRadioGroup
        name="reason"
        legend="Reason"
        options={REASON_OPTIONS}
        value={reason ?? "compromised"}
        onChange={setReason}
        testId="reason"
      />

      <BureauLabel text="Operator note (optional)">
        <BureauTextarea
          name="operatorNote"
          placeholder="Context for verifiers — what happened, when the compromise window opened, anything they need to triage."
          value={operatorNote ?? ""}
          onChange={setOperatorNote}
          rows={3}
          testId="operator-note"
        />
      </BureauLabel>
      <BureauHelpText>
        Plain-text context, ≤ 512 characters. Embedded in the
        KeyRevocation/v1 body and visible to anyone verifying the
        rotation. Don't include secrets — verifiers see this.
      </BureauHelpText>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #a78a1f",
          background: "rgba(255, 255, 0, 0.04)",
          borderRadius: 4,
        }}
      >
        <p
          style={{
            fontFamily: "var(--bureau-mono)",
            fontSize: 13,
            color: "#a78a1f",
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          <strong>Trust invalidation, NOT crypto-shred.</strong>
        </p>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          Revoking does NOT remove signed Rekor entries — that's
          impossible against a public Merkle tree by design. ROTATE
          publishes NEW signed observations alongside the originals;
          verifiers MUST consult the compromise ledger before trusting
          any historical signature from this fingerprint.
        </p>
      </div>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to rotate this key, I own the private material
        for both the old and new SPKI fingerprints, and I understand
        the rotation receipt + Rekor anchor are public.
      </BureauCheckbox>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Rotating…" : "Rotate key"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="rotate a key"
          testId="sign-in-prompt"
        />
      ) : null}

      {errorToShow ? (
        <BureauError message={errorToShow} testId="run-error" />
      ) : null}

      <span data-testid="submit-status" hidden>
        {submitStatus}
      </span>
    </form>
  );
}
