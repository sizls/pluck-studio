"use client";

// ---------------------------------------------------------------------------
// CUSTODY Run form — fourth program through the activation pattern
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
import { custodyRunFormModule } from "../../../../lib/custody/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const VENDOR_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isClientSideBadBundleUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Bundle URL is required.";
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Bundle URL must be a valid URL (include https://).";
  }
  if (parsed.protocol !== "https:") {
    return "Bundle URL must use https:// (per CUSTODY wire spec).";
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "::1" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0"
  ) {
    return "Bundle URL cannot point at localhost or loopback addresses.";
  }
  return null;
}

function isClientSideBadVendor(raw: string): string | null {
  if (raw.trim().length === 0) {
    return null; // optional field
  }
  const lowered = raw.trim().toLowerCase();
  if (!VENDOR_PATTERN.test(lowered)) {
    return "Expected vendor must be a public hostname like 'openai.com' (no scheme, no path).";
  }
  if (lowered === "localhost") {
    return "Expected vendor cannot be localhost.";
  }
  return null;
}

export function CustodyRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: custodyRunFormModule });
    sys.start();
    return sys;
  }, []);

  const bundleUrl = useFact(system, "bundleUrl");
  const expectedVendor = useFact(system, "expectedVendor");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");

  const setBundleUrl = useCallback(
    (v: string) => {
      system.facts.bundleUrl = v;
    },
    [system],
  );
  const setExpectedVendor = useCallback(
    (v: string) => {
      system.facts.expectedVendor = v;
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
    const urlError = isClientSideBadBundleUrl(bundleUrl ?? "");
    if (urlError !== null) {
      setClientGuardError(urlError);
      return;
    }
    const vendorError = isClientSideBadVendor(expectedVendor ?? "");
    if (vendorError !== null) {
      setClientGuardError(vendorError);
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/custody/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bundleUrl: bundleUrl?.trim(),
          expectedVendor: expectedVendor && expectedVendor.length > 0
            ? expectedVendor.trim().toLowerCase()
            : undefined,
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
          body.error ?? `Verify failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";

      router.push(`/bureau/custody/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="custody-run-form">
      <BureauLabel text="Bundle URL">
        <BureauInput
          type="url"
          name="bundleUrl"
          required
          autoFocus
          placeholder="https://example.com/path/to/bundle.intoto.jsonl"
          value={bundleUrl ?? ""}
          onChange={setBundleUrl}
          testId="bundle-url"
        />
      </BureauLabel>
      <BureauHelpText>
        HTTPS-only public URL of the CustodyBundle JSON. Studio fetches
        ≤ 256 KiB, 10s timeout, no redirects per the CUSTODY wire spec
        — same constraints as <code>pluck bureau custody verify</code>.
      </BureauHelpText>

      <BureauLabel text="Expected vendor (optional)">
        <BureauInput
          type="text"
          name="expectedVendor"
          placeholder="openai.com"
          value={expectedVendor ?? ""}
          onChange={setExpectedVendor}
          testId="expected-vendor"
        />
      </BureauLabel>
      <BureauHelpText>
        Bare hostname slug. Studio asserts{" "}
        <code>body.vendor === expectedVendor</code> at verify time —
        catches a swapped or relabelled bundle. Leave empty to trust
        the bundle's self-declared vendor.
      </BureauHelpText>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to fetch this bundle, and I understand that
        the verification verdict + per-check breakdown will be public
        — signed by the Pluck-fleet hosted key and Sigstore-Rekor
        anchored.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Verdict receipts are signed by the Pluck-fleet hosted key
        (
        <a href="/.well-known/pluck-keys.json">
          <code>/.well-known/pluck-keys.json</code>
        </a>
        ). The bundle itself is signed by the operator's WebAuthn-bound
        passkey — the keystone of FRE 902(13) admissibility.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Verifying…" : "Verify bundle"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="verify a custody bundle"
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
