"use client";

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
  BureauSignInPrompt,
  BureauTextarea,
} from "../../../../components/bureau-ui/forms";
import {
  FINGERPRINT_BOUNDS,
  isValidCanaryId,
  moleRunFormModule,
} from "../../../../lib/mole/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

export function MoleRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: moleRunFormModule });
    sys.start();
    return sys;
  }, []);

  const canaryId = useFact(system, "canaryId");
  const canaryUrl = useFact(system, "canaryUrl");
  const fingerprintPhrases = useFact(system, "fingerprintPhrases");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");
  const fingerprintCount = useDerived(system, "fingerprintCount");
  const fingerprintsValid = useDerived(system, "fingerprintsValid");

  const setCanaryId = useCallback(
    (v: string) => {
      system.facts.canaryId = v;
    },
    [system],
  );
  const setCanaryUrl = useCallback(
    (v: string) => {
      system.facts.canaryUrl = v;
    },
    [system],
  );
  const setFingerprintPhrases = useCallback(
    (v: string) => {
      system.facts.fingerprintPhrases = v;
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
    if (!isValidCanaryId((canaryId ?? "").trim().toLowerCase())) {
      setClientGuardError("Canary ID must be a short lowercase slug.");
      return;
    }
    const url = (canaryUrl ?? "").trim();
    if (!url || !/^https:\/\//i.test(url)) {
      setClientGuardError("Canary URL must use https://.");
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/mole/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          canaryId: (canaryId ?? "").trim().toLowerCase(),
          canaryUrl: url,
          fingerprintPhrases: (fingerprintPhrases ?? "").trim(),
          authorizationAcknowledged: authAck,
        }),
      });
      const body = (await res.json()) as RunResponse;
      if (res.status === 401) {
        system.facts.signInUrl = body.signInUrl ?? "/sign-in";
        system.facts.submitStatus = "failed";
        return;
      }
      if (!res.ok || !body.runId || !body.phraseId) {
        system.facts.errorMessage =
          body.error ?? `Seal failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";
      router.push(`/bureau/mole/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="mole-run-form">
      <BureauLabel text="Canary ID">
        <BureauInput
          type="text"
          name="canaryId"
          required
          autoFocus
          placeholder="nyt-2024-01-15"
          value={canaryId ?? ""}
          onChange={setCanaryId}
          testId="canary-id"
        />
      </BureauLabel>
      <BureauHelpText>
        Short lowercase slug naming the canary (e.g.{" "}
        <code>nyt-2024-01-15</code>, <code>pii-leak-test-1</code>). The
        seal URL is scoped to this ID — anyone reading the URL can see
        which canary was sealed, never the contents.
      </BureauHelpText>

      <BureauLabel text="Canary content URL">
        <BureauInput
          type="url"
          name="canaryUrl"
          required
          placeholder="https://your-host/canary.txt"
          value={canaryUrl ?? ""}
          onChange={setCanaryUrl}
          testId="canary-url"
        />
      </BureauLabel>
      <BureauHelpText>
        HTTPS-only, public host. Studio fetches the body, computes
        sha256, and signs the manifest. <strong>The body itself is
        never published</strong> — only the sha256 + fingerprint phrases
        below enter the public log. Operator holds the raw text locally
        for the journalist conversation.
      </BureauHelpText>

      <BureauLabel text="Fingerprint phrases">
        <BureauTextarea
          name="fingerprintPhrases"
          placeholder="Comma-separated short phrases that should appear in the canary verbatim"
          value={fingerprintPhrases ?? ""}
          onChange={setFingerprintPhrases}
          rows={4}
          testId="fingerprint-phrases"
        />
      </BureauLabel>
      <BureauHelpText>
        Comma-separated. Each phrase{" "}
        {FINGERPRINT_BOUNDS.MIN_LENGTH}–{FINGERPRINT_BOUNDS.MAX_LENGTH}{" "}
        chars, max {FINGERPRINT_BOUNDS.MAX_COUNT} phrases. Pick
        unique-enough phrases — short generic ones won't memorize
        uniquely against any large model.{" "}
        {fingerprintCount > 0 ? (
          <span data-testid="fingerprint-count">
            ({fingerprintCount} phrase{fingerprintCount === 1 ? "" : "s"} parsed)
          </span>
        ) : null}
        {!fingerprintsValid && (fingerprintPhrases ?? "").length > 0 ? (
          <span style={{ color: "#ff8888" }} data-testid="fingerprint-invalid">
            {" "}— some phrases are out of bounds.
          </span>
        ) : null}
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
          <strong>Sealing comes BEFORE probing.</strong>
        </p>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          The canary commit is signed and notarized BEFORE any probe
          touches the vendor. Vendors cannot retroactively claim "we
          trained on your canary AFTER you published the seal" — the
          Rekor timestamp predates every probe-run record. Studio
          never sees or stores the canary body.
        </p>
      </div>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to seal this canary, I understand the canary
        body stays with me (Studio sees only sha256 + the fingerprint
        phrases above), and I will not include any operator-internal
        secrets in the fingerprint phrases — they go in the public log.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Seal manifests are signed by the Pluck-fleet hosted key
        (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
        Probe-runs against the canary are a separate program (CLI{" "}
        <code>pluck bureau mole run</code>) — Studio surfaces only the
        seal step today.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Sealing…" : "Seal canary"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="seal a canary"
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
