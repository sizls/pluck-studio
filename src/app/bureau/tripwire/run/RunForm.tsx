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
  BureauRadioGroup,
  BureauSignInPrompt,
} from "../../../../components/bureau-ui/forms";
import {
  POLICY_SOURCE_LABELS,
  isValidMachineId,
  tripwireRunFormModule,
  type PolicySource,
} from "../../../../lib/tripwire/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const POLICY_OPTIONS: ReadonlyArray<{
  value: PolicySource;
  label: ReactNode;
  testId?: string;
}> = (["default", "custom"] as const).map((p) => ({
  value: p,
  label: POLICY_SOURCE_LABELS[p],
  testId: `policy-${p}`,
}));

export function TripwireRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: tripwireRunFormModule });
    sys.start();
    return sys;
  }, []);

  const machineId = useFact(system, "machineId");
  const policySource = useFact(system, "policySource");
  const customPolicyUrl = useFact(system, "customPolicyUrl");
  const notarize = useFact(system, "notarize");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");
  const requiresPolicyUrl = useDerived(system, "requiresPolicyUrl");

  const setMachineId = useCallback(
    (v: string) => {
      system.facts.machineId = v;
    },
    [system],
  );
  const setPolicySource = useCallback(
    (v: PolicySource) => {
      system.facts.policySource = v;
    },
    [system],
  );
  const setCustomPolicyUrl = useCallback(
    (v: string) => {
      system.facts.customPolicyUrl = v;
    },
    [system],
  );
  const setNotarize = useCallback(
    (v: boolean) => {
      system.facts.notarize = v;
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
    const id = (machineId ?? "").trim().toLowerCase();
    if (!isValidMachineId(id)) {
      setClientGuardError(
        "Machine ID must be a short lowercase slug (e.g. 'alice-mbp').",
      );
      return;
    }
    if (policySource === "custom") {
      if (!(customPolicyUrl ?? "").trim()) {
        setClientGuardError("Custom policy URL is required.");
        return;
      }
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/tripwire/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          machineId: id,
          policySource,
          customPolicyUrl: policySource === "custom"
            ? (customPolicyUrl ?? "").trim()
            : undefined,
          notarize,
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
          body.error ?? `Configure failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";
      router.push(`/bureau/tripwire/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="tripwire-run-form">
      <BureauLabel text="Machine ID">
        <BureauInput
          type="text"
          name="machineId"
          required
          autoFocus
          placeholder="alice-mbp"
          value={machineId ?? ""}
          onChange={setMachineId}
          testId="machine-id"
        />
      </BureauLabel>
      <BureauHelpText>
        Short slug naming the dev machine. The receipt URL is scoped
        to this ID — each machine's deployment gets its own permanent
        URL like <code>alice-mbp-amber-otter-3742</code>. If you
        rotate machines, ROTATE the old machine's deployment first.
      </BureauHelpText>

      <BureauRadioGroup
        name="policySource"
        legend="Policy source"
        options={POLICY_OPTIONS}
        value={policySource ?? "default"}
        onChange={setPolicySource}
        testId="policy-source"
      />

      {requiresPolicyUrl ? (
        <>
          <BureauLabel text="Custom policy URL">
            <BureauInput
              type="url"
              name="customPolicyUrl"
              required
              placeholder="https://example.com/tripwire-policy.json"
              value={customPolicyUrl ?? ""}
              onChange={setCustomPolicyUrl}
              testId="custom-policy-url"
            />
          </BureauLabel>
          <BureauHelpText>
            HTTPS-only, public host. Studio fetches + parses the
            policy at configure time and embeds the canonical hash in
            the signed TripwirePolicy/v1 envelope.
          </BureauHelpText>
        </>
      ) : null}

      <BureauCheckbox
        checked={notarize ?? false}
        onChange={setNotarize}
        testId="notarize-toggle"
      >
        Auto-publish non-green cassettes to Sigstore Rekor
        (default off — bodies stay on disk in{" "}
        <code>./.tripwire/cassettes/</code>).
      </BureauCheckbox>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to deploy a tripwire on this machine, and I
        understand the configuration receipt + Rekor anchor are
        public; intercepted bodies stay local unless notarize is on.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Configuration receipts are signed by the Pluck-fleet hosted
        key (
        <a href="/.well-known/pluck-keys.json">
          <code>/.well-known/pluck-keys.json</code>
        </a>
        ). The runtime interceptor itself uses an operator-held key for
        per-cassette signing — Studio doesn't see request bodies.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Configuring…" : "Configure tripwire"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="configure a tripwire"
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
