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
  ARTIFACT_KIND_LABELS,
  isValidSha256,
  sbomAiRunFormModule,
  type ArtifactKind,
} from "../../../../lib/sbom-ai/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const KIND_OPTIONS: ReadonlyArray<{
  value: ArtifactKind;
  label: ReactNode;
  testId?: string;
}> = (
  ["probe-pack", "model-card", "mcp-server"] as const
).map((k) => ({
  value: k,
  label: ARTIFACT_KIND_LABELS[k],
  testId: `kind-${k}`,
}));

function isClientSideBadUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return "Artifact URL is required.";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Artifact URL must be a valid URL (include https://).";
  }
  if (parsed.protocol !== "https:") {
    return "Artifact URL must use https:// (per SBOM-AI wire spec).";
  }
  return null;
}

export function SbomAiRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: sbomAiRunFormModule });
    sys.start();
    return sys;
  }, []);

  const artifactUrl = useFact(system, "artifactUrl");
  const artifactKind = useFact(system, "artifactKind");
  const expectedSha256 = useFact(system, "expectedSha256");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");

  const setArtifactUrl = useCallback(
    (v: string) => {
      system.facts.artifactUrl = v;
    },
    [system],
  );
  const setArtifactKind = useCallback(
    (v: ArtifactKind) => {
      system.facts.artifactKind = v;
    },
    [system],
  );
  const setExpectedSha256 = useCallback(
    (v: string) => {
      system.facts.expectedSha256 = v;
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
    const urlError = isClientSideBadUrl(artifactUrl ?? "");
    if (urlError !== null) {
      setClientGuardError(urlError);
      return;
    }
    const trimmedHash = (expectedSha256 ?? "").trim();
    if (trimmedHash.length > 0 && !isValidSha256(trimmedHash)) {
      setClientGuardError("Expected sha256 must be 64 hex characters.");
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/sbom-ai/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          artifactUrl: (artifactUrl ?? "").trim(),
          artifactKind,
          expectedSha256: trimmedHash.length > 0 ? trimmedHash : undefined,
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
          body.error ?? `Publish failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";
      router.push(`/bureau/sbom-ai/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="sbom-ai-run-form">
      <BureauLabel text="Artifact URL">
        <BureauInput
          type="url"
          name="artifactUrl"
          required
          autoFocus
          placeholder="https://example.com/pack.json"
          value={artifactUrl ?? ""}
          onChange={setArtifactUrl}
          testId="artifact-url"
        />
      </BureauLabel>
      <BureauHelpText>
        HTTPS-only public URL of the artifact body — Studio fetches +
        hashes per the artifact's canonical wire format.
      </BureauHelpText>

      <BureauRadioGroup
        name="artifactKind"
        legend="Artifact kind"
        options={KIND_OPTIONS}
        value={artifactKind ?? "probe-pack"}
        onChange={setArtifactKind}
        testId="artifact-kind"
      />
      <BureauHelpText>
        Each kind hashes differently:{" "}
        <code>probe-pack</code> + <code>model-card</code> use canonical-
        JSON; <code>mcp-server</code> uses sha256 of the raw tarball
        bytes (interoperable with <code>cosign sign-blob</code>).
      </BureauHelpText>

      <BureauLabel text="Expected sha256 (optional)">
        <BureauInput
          type="text"
          name="expectedSha256"
          placeholder="64 hex chars"
          value={expectedSha256 ?? ""}
          onChange={setExpectedSha256}
          testId="expected-sha256"
        />
      </BureauLabel>
      <BureauHelpText>
        When supplied, Studio cross-checks against its computed digest;
        a mismatch is a <code>hash-mismatch</code> verdict (rejected,
        no Rekor entry).
      </BureauHelpText>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to publish this artifact's provenance, and I
        understand that the attestation + Rekor anchor are public.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Attestations are signed by the Pluck-fleet hosted key
        (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
        Each artifact kind has its own predicate URI under{" "}
        <code>https://pluck.run/SbomAi/...</code>.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Publishing…" : "Publish provenance"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="publish provenance"
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
