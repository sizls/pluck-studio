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
  ALLOWED_LICENSES,
  isAllowedLicense,
  isValidAuthor,
  isValidPackName,
  isValidRekorUuid,
  nucleiRunFormModule,
  parseVendorScope,
  validateCron,
} from "../../../../lib/nuclei/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const LICENSE_OPTIONS = ALLOWED_LICENSES.map((l) => ({
  value: l,
  label: l,
  testId: `license-${l.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
}));

export function NucleiRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: nucleiRunFormModule });
    sys.start();
    return sys;
  }, []);

  const author = useFact(system, "author");
  const packName = useFact(system, "packName");
  const sbomRekorUuid = useFact(system, "sbomRekorUuid");
  const vendorScope = useFact(system, "vendorScope");
  const license = useFact(system, "license");
  const recommendedInterval = useFact(system, "recommendedInterval");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");
  const vendorScopeIsValid = useDerived(system, "vendorScopeIsValid");
  const vendorScopeCount = useDerived(system, "vendorScopeCount");
  const sbomRekorUuidIsValid = useDerived(system, "sbomRekorUuidIsValid");
  const recommendedIntervalIsValid = useDerived(
    system,
    "recommendedIntervalIsValid",
  );

  const setAuthor = useCallback(
    (v: string) => {
      system.facts.author = v;
    },
    [system],
  );
  const setPackName = useCallback(
    (v: string) => {
      system.facts.packName = v;
    },
    [system],
  );
  const setSbomRekorUuid = useCallback(
    (v: string) => {
      system.facts.sbomRekorUuid = v;
    },
    [system],
  );
  const setVendorScope = useCallback(
    (v: string) => {
      system.facts.vendorScope = v;
    },
    [system],
  );
  const setLicense = useCallback(
    (v: string) => {
      system.facts.license = v;
    },
    [system],
  );
  const setRecommendedInterval = useCallback(
    (v: string) => {
      system.facts.recommendedInterval = v;
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
    if (!isValidAuthor((author ?? "").trim().toLowerCase())) {
      setClientGuardError("Author must be a short lowercase slug (e.g. 'alice').");
      return;
    }
    if (!isValidPackName((packName ?? "").trim())) {
      setClientGuardError("Pack name must be '<slug>@<version>' (e.g. 'canon-honesty@0.1').");
      return;
    }
    if (!isValidRekorUuid((sbomRekorUuid ?? "").trim())) {
      setClientGuardError("SBOM-AI Rekor UUID must be 64–80 hex characters.");
      return;
    }
    const { invalid } = parseVendorScope(vendorScope ?? "");
    if (invalid.length > 0) {
      setClientGuardError(`Invalid vendor scope entries: ${invalid.join(", ")}`);
      return;
    }
    if (!isAllowedLicense((license ?? "").trim())) {
      setClientGuardError("License must be an allowed SPDX identifier.");
      return;
    }
    if (!validateCron((recommendedInterval ?? "").trim())) {
      setClientGuardError(
        "Recommended interval must be a valid 5-field cron expression (e.g. '0 */4 * * *').",
      );
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/nuclei/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          author: (author ?? "").trim().toLowerCase(),
          packName: (packName ?? "").trim(),
          sbomRekorUuid: (sbomRekorUuid ?? "").trim().toLowerCase(),
          vendorScope: (vendorScope ?? "").trim(),
          license: (license ?? "").trim(),
          recommendedInterval: (recommendedInterval ?? "").trim(),
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
      router.push(`/bureau/nuclei/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="nuclei-run-form">
      <BureauLabel text="Author">
        <BureauInput
          type="text"
          name="author"
          required
          autoFocus
          placeholder="alice"
          value={author ?? ""}
          onChange={setAuthor}
          testId="author"
        />
      </BureauLabel>
      <BureauHelpText>
        Short lowercase slug — your registry handle (e.g.{" "}
        <code>alice</code>, <code>openai-eng</code>). The pack lives at{" "}
        <code>/bureau/nuclei/{`{author}`}/{`{pack}`}</code>.
      </BureauHelpText>

      <BureauLabel text="Pack name + version">
        <BureauInput
          type="text"
          name="packName"
          required
          placeholder="canon-honesty@0.1"
          value={packName ?? ""}
          onChange={setPackName}
          testId="pack-name"
        />
      </BureauLabel>
      <BureauHelpText>
        Versioned name in the form <code>&lt;slug&gt;@&lt;version&gt;</code>.
        Bumping <code>@version</code> publishes a new entry; consumers
        pin to specific versions.
      </BureauHelpText>

      <BureauLabel text="SBOM-AI Rekor UUID">
        <BureauInput
          type="text"
          name="sbomRekorUuid"
          required
          placeholder="64–80 hex chars (from /bureau/sbom-ai/run)"
          value={sbomRekorUuid ?? ""}
          onChange={setSbomRekorUuid}
          testId="sbom-rekor-uuid"
        />
      </BureauLabel>
      <BureauHelpText>
        <strong>Required.</strong> Without a SBOM-AI cross-reference,
        the entry lands at <code>trustTier: "ingested"</code> and
        consumers refuse to honor it. Publish via{" "}
        <a href="/bureau/sbom-ai/run" target="_blank" rel="noreferrer">
          /bureau/sbom-ai/run
        </a>{" "}
        first; copy the Rekor UUID from that receipt; paste it here.
        {!sbomRekorUuidIsValid && (sbomRekorUuid ?? "").length > 0 ? (
          <span
            style={{ color: "#ff8888" }}
            data-testid="sbom-rekor-uuid-invalid"
          >
            {" "}— must be 64–80 hex characters.
          </span>
        ) : null}
      </BureauHelpText>

      <BureauLabel text="Vendor scope">
        <BureauInput
          type="text"
          name="vendorScope"
          required
          placeholder="openai/gpt-4o, anthropic/claude-3-5-sonnet"
          value={vendorScope ?? ""}
          onChange={setVendorScope}
          testId="vendor-scope"
        />
      </BureauLabel>
      <BureauHelpText>
        Comma-separated <code>vendor/model</code> pairs the pack is
        designed to probe. Subscribers run the pack only against
        targets in scope.{" "}
        {vendorScopeCount > 0 ? (
          <span data-testid="vendor-scope-count">
            ({vendorScopeCount} pair{vendorScopeCount === 1 ? "" : "s"} parsed)
          </span>
        ) : null}
        {!vendorScopeIsValid && (vendorScope ?? "").length > 0 ? (
          <span style={{ color: "#ff8888" }} data-testid="vendor-scope-invalid">
            {" "}— some entries are malformed.
          </span>
        ) : null}
      </BureauHelpText>

      <BureauRadioGroup
        name="license"
        legend="License (SPDX identifier)"
        options={LICENSE_OPTIONS}
        value={license ?? "MIT"}
        onChange={setLicense}
        testId="license"
      />

      <BureauLabel text="Recommended cron interval">
        <BureauInput
          type="text"
          name="recommendedInterval"
          required
          placeholder="0 */4 * * *"
          value={recommendedInterval ?? ""}
          onChange={setRecommendedInterval}
          testId="recommended-interval"
        />
      </BureauLabel>
      <BureauHelpText>
        Default cron expression DRAGNET subscribers will use unless
        they override. Conservative default: every 4 hours.
      </BureauHelpText>
      {!recommendedIntervalIsValid && (recommendedInterval ?? "").length > 0 ? (
        <BureauHelpText error testId="recommended-interval-invalid">
          Not a valid 5-field cron expression. Format: <code>min hour dom month dow</code>{" "}
          (e.g. <code>0 */4 * * *</code>, <code>*/15 * * * *</code>,{" "}
          <code>0 0 * * 1-5</code>).
        </BureauHelpText>
      ) : null}

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to publish this pack and the SBOM-AI
        cross-reference is genuine. I understand the registry entry +
        Rekor anchor are public.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Registry entries are signed by the Pluck-fleet hosted key
        (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
        The probe-pack body itself is signed by your own key — Studio
        doesn't see it; it lives at the URL you registered with SBOM-AI.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Publishing…" : "Publish to registry"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="publish to the registry"
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
