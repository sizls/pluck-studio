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
  TARGET_LABELS,
  bountyRunFormModule,
  isValidProgramSlug,
  isValidRekorUuid,
  type Target,
} from "../../../../lib/bounty/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const TARGET_OPTIONS: ReadonlyArray<{
  value: Target;
  label: ReactNode;
  testId?: string;
}> = (["hackerone", "bugcrowd"] as const).map((t) => ({
  value: t,
  label: TARGET_LABELS[t],
  testId: `target-${t}`,
}));

export function BountyRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: bountyRunFormModule });
    sys.start();
    return sys;
  }, []);

  const sourceRekorUuid = useFact(system, "sourceRekorUuid");
  const target = useFact(system, "target");
  const program = useFact(system, "program");
  const vendor = useFact(system, "vendor");
  const model = useFact(system, "model");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");

  const setSourceRekorUuid = useCallback(
    (v: string) => {
      system.facts.sourceRekorUuid = v;
    },
    [system],
  );
  const setTarget = useCallback(
    (v: Target) => {
      system.facts.target = v;
    },
    [system],
  );
  const setProgram = useCallback(
    (v: string) => {
      system.facts.program = v;
    },
    [system],
  );
  const setVendor = useCallback(
    (v: string) => {
      system.facts.vendor = v;
    },
    [system],
  );
  const setModel = useCallback(
    (v: string) => {
      system.facts.model = v;
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
    if (!isValidRekorUuid((sourceRekorUuid ?? "").trim())) {
      setClientGuardError("Source Rekor UUID must be 64–80 hex characters.");
      return;
    }
    if (!isValidProgramSlug((program ?? "").trim().toLowerCase())) {
      setClientGuardError("Program must be a short lowercase slug (e.g. 'openai').");
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/bounty/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceRekorUuid: (sourceRekorUuid ?? "").trim(),
          target,
          program: (program ?? "").trim().toLowerCase(),
          vendor: (vendor ?? "").trim().toLowerCase(),
          model: (model ?? "").trim().toLowerCase(),
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
          body.error ?? `File failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";
      router.push(`/bureau/bounty/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="bounty-run-form">
      <BureauLabel text="Source Rekor UUID">
        <BureauInput
          type="text"
          name="sourceRekorUuid"
          required
          autoFocus
          placeholder="abcdef0123…"
          value={sourceRekorUuid ?? ""}
          onChange={setSourceRekorUuid}
          testId="source-rekor-uuid"
        />
      </BureauLabel>
      <BureauHelpText>
        UUID of the source DRAGNET red dot, FINGERPRINT delta, or MOLE
        verdict that grounds this filing. Studio fetches the body to
        assemble the EvidencePacket.
      </BureauHelpText>

      <BureauRadioGroup
        name="target"
        legend="Target platform"
        options={TARGET_OPTIONS}
        value={target ?? "hackerone"}
        onChange={setTarget}
        testId="target"
      />

      <BureauLabel text="Program">
        <BureauInput
          type="text"
          name="program"
          required
          placeholder="openai"
          value={program ?? ""}
          onChange={setProgram}
          testId="program"
        />
      </BureauLabel>
      <BureauHelpText>
        Platform-specific program slug — e.g. <code>hackerone.com/openai</code>{" "}
        means program=<code>openai</code>.
      </BureauHelpText>

      <BureauLabel text="Affected vendor">
        <BureauInput
          type="text"
          name="vendor"
          required
          placeholder="openai"
          value={vendor ?? ""}
          onChange={setVendor}
          testId="vendor"
        />
      </BureauLabel>
      <BureauLabel text="Affected model">
        <BureauInput
          type="text"
          name="model"
          required
          placeholder="gpt-4o"
          value={model ?? ""}
          onChange={setModel}
          testId="model"
        />
      </BureauLabel>
      <BureauHelpText>
        Vendor + model are recorded in the EvidencePacket body for
        downstream readers — the program slug above is platform-side
        and doesn't always match the vendor name.
      </BureauHelpText>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to file this bounty, and I understand that the
        submission record + Rekor anchor are public — though the
        platform auth token is read from operator-stored credentials
        at dispatch time and never appears in this receipt.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Auth tokens stay LOCAL — Studio reads operator-stored platform
        credentials at dispatch time, NOT from this form. The receipt
        and the EvidencePacket body never contain the token.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Filing…" : "File bounty"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="file a bounty"
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
