"use client";

// ---------------------------------------------------------------------------
// OATH Run form — client component, Directive-backed
// ---------------------------------------------------------------------------
//
// The second program activated through the Studio activation pattern.
// Same architectural shape as DRAGNET (Directive module + useFact +
// shared bureau-ui/forms primitives), different field set:
//
//   - vendorDomain: bare hostname ("openai.com")
//   - expectedOrigin: optional override (defaults to https://<domain>)
//   - authorizationAcknowledged: required
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
import { oathRunFormModule } from "../../../../lib/oath/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const HOSTNAME_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isClientSideBadDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return "Vendor domain is required.";
  }
  if (!HOSTNAME_PATTERN.test(trimmed)) {
    return "Vendor domain must be a public hostname like 'openai.com' (no scheme, no path, no IPs).";
  }
  if (trimmed === "localhost") {
    return "Vendor domain cannot be localhost.";
  }
  return null;
}

function isClientSideBadOrigin(raw: string): string | null {
  if (raw.trim().length === 0) {
    return null; // empty is fine — defaults to https://<vendorDomain> server-side
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return "Expected origin must be a valid URL (include https://).";
  }
  if (parsed.protocol !== "https:") {
    return "Expected origin must use https:// (per OATH wire spec).";
  }
  return null;
}

export function OathRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: oathRunFormModule });
    sys.start();
    return sys;
  }, []);

  const vendorDomain = useFact(system, "vendorDomain");
  const expectedOrigin = useFact(system, "expectedOrigin");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");
  const effectiveOrigin = useDerived(system, "effectiveExpectedOrigin");

  const setVendorDomain = useCallback(
    (v: string) => {
      system.facts.vendorDomain = v;
    },
    [system],
  );
  const setExpectedOrigin = useCallback(
    (v: string) => {
      system.facts.expectedOrigin = v;
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
    const domainError = isClientSideBadDomain(vendorDomain ?? "");
    if (domainError !== null) {
      setClientGuardError(domainError);
      return;
    }
    const originError = isClientSideBadOrigin(expectedOrigin ?? "");
    if (originError !== null) {
      setClientGuardError(originError);
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/bureau/oath/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vendorDomain,
          expectedOrigin: expectedOrigin && expectedOrigin.length > 0
            ? expectedOrigin
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

      router.push(`/bureau/oath/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="oath-run-form">
      <BureauLabel text="Vendor domain">
        <BureauInput
          type="text"
          name="vendorDomain"
          required
          autoFocus
          placeholder="openai.com"
          value={vendorDomain ?? ""}
          onChange={setVendorDomain}
          testId="vendor-domain"
        />
      </BureauLabel>
      <BureauHelpText>
        Bare hostname only. Studio fetches{" "}
        <code>https://{`{domain}`}/.well-known/pluck-oath.json</code>{" "}
        and verifies the DSSE envelope.
      </BureauHelpText>

      <BureauLabel text="Expected origin (optional)">
        <BureauInput
          type="url"
          name="expectedOrigin"
          placeholder={effectiveOrigin || "https://openai.com"}
          value={expectedOrigin ?? ""}
          onChange={setExpectedOrigin}
          testId="expected-origin"
        />
      </BureauLabel>
      <BureauHelpText>
        Override the default <code>https://{`{domain}`}</code> when the
        oath is hosted on a different sub-origin (e.g.{" "}
        <code>https://chat.openai.com</code>). Cross-checked against
        the body's <code>vendor</code> field at verify time.
      </BureauHelpText>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to fetch this vendor's oath. (Required — fetches
        are HTTPS-only, capped at 256 KiB, 10s timeout, no redirects;
        the assertion is logged to the public transparency log.)
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        OATH receipts are signed with the Pluck-fleet hosted key
        (
        <a href="/.well-known/pluck-keys.json">
          <code>/.well-known/pluck-keys.json</code>
        </a>
        ). Vendor-side oath signing keys are the vendor's own.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Verifying…" : "Fetch + verify oath"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt signInUrl={signInUrl} testId="sign-in-prompt" />
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
