"use client";

// ---------------------------------------------------------------------------
// FINGERPRINT Run form — third program through the Studio activation pattern
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
  BureauSignInPrompt,
} from "../../../../components/bureau-ui/forms";
import {
  fingerprintRunFormModule,
  isValidModelSlug,
  isValidVendorSlug,
} from "../../../../lib/fingerprint/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

function isClientSideBadVendor(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) {
    return "Vendor is required.";
  }
  if (!isValidVendorSlug(v)) {
    return "Vendor must be a short lowercase slug (e.g. 'openai').";
  }
  return null;
}

function isClientSideBadModel(raw: string): string | null {
  const m = raw.trim().toLowerCase();
  if (!m) {
    return "Model is required.";
  }
  if (!isValidModelSlug(m)) {
    return "Model must be a slug like 'gpt-4o' or 'claude-3-5-sonnet'.";
  }
  return null;
}

export function FingerprintRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: fingerprintRunFormModule });
    sys.start();
    return sys;
  }, []);

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
  const targetSlug = useDerived(system, "targetSlug");

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
    const vendorError = isClientSideBadVendor(vendor ?? "");
    if (vendorError !== null) {
      setClientGuardError(vendorError);
      return;
    }
    const modelError = isClientSideBadModel(model ?? "");
    if (modelError !== null) {
      setClientGuardError(modelError);
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/fingerprint/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendor: vendor?.trim().toLowerCase(),
          model: model?.trim().toLowerCase(),
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
          body.error ?? `Scan failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";

      router.push(`/bureau/fingerprint/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="fingerprint-run-form">
      <BureauLabel text="Vendor">
        <BureauInput
          type="text"
          name="vendor"
          required
          autoFocus
          placeholder="openai"
          value={vendor ?? ""}
          onChange={setVendor}
          testId="vendor"
        />
      </BureauLabel>
      <BureauHelpText>
        Short slug. The vendor whose model is being scanned —{" "}
        <code>openai</code>, <code>anthropic</code>, <code>meta</code>,{" "}
        <code>google</code>, etc.
      </BureauHelpText>

      <BureauLabel text="Model">
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
        Vendor-specific model identifier. Slug-style: lowercase,
        digits, dots, hyphens, underscores. Examples:{" "}
        <code>gpt-4o</code>, <code>claude-3-5-sonnet</code>,{" "}
        <code>llama-3.1-70b</code>.
      </BureauHelpText>

      {targetSlug ? (
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--bureau-fg-dim)",
          }}
          data-testid="target-slug-preview"
        >
          Target: <code>{targetSlug}</code> — the dossier at{" "}
          <code>/bureau/fingerprint/{targetSlug}</code> updates with this
          scan.
        </p>
      ) : null}

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to scan this vendor's model. (Required —
        FINGERPRINT logs this assertion to the public transparency log
        on each scan.)
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Hosted-mode scans are signed by the Pluck-fleet hosted key
        (
        <a href="/.well-known/pluck-keys.json">
          <code>/.well-known/pluck-keys.json</code>
        </a>
        ). The 5-probe calibration set is fixed; the responder
        transport (OpenAI / Anthropic / OpenRouter / Ollama) is wired
        per-vendor.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Scanning…" : "Scan model"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="scan a model"
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
