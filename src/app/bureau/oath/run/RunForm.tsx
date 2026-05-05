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
import {
  normalizeVendorDomain,
  oathRunFormModule,
} from "../../../../lib/oath/run-form-module";

interface RunResponse {
  runId?: string;
  /** Legacy /api/bureau/oath/run shape. */
  phraseId?: string;
  /** /v1/runs shape — receiptUrl returned alongside runId. */
  receiptUrl?: string;
  signInUrl?: string;
  error?: string;
}

/**
 * Build a per-submit idempotency key for the /v1/runs POST. Bucketed by
 * minute so a double-click within ~60s collapses to the same runId.
 * Mirrors DRAGNET's pattern.
 */
function idempotencyKeyFor(vendorDomain: string, hostingOrigin: string): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);

  return `oath:${vendorDomain}:${hostingOrigin}:${minuteBucket}`;
}

// Same regex as the server route (kept in sync — drift here means an
// input that passes client-side then bounces server-side, which is bad
// UX).
const HOSTNAME_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function isClientSideBadDomain(raw: string): string | null {
  const normalized = normalizeVendorDomain(raw);
  if (!normalized) {
    return "Vendor domain is required.";
  }
  if (!HOSTNAME_PATTERN.test(normalized)) {
    return "Vendor domain must be a public hostname like 'openai.com'. Punycode for IDN domains.";
  }
  if (normalized === "localhost") {
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
    return "Hosting origin must be a valid URL (include https://).";
  }
  if (parsed.protocol !== "https:") {
    return "Hosting origin must use https:// (per OATH wire spec).";
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
  const hostingOrigin = useFact(system, "hostingOrigin");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");
  const effectiveOrigin = useDerived(system, "effectiveHostingOrigin");

  const setVendorDomain = useCallback(
    (v: string) => {
      system.facts.vendorDomain = v;
    },
    [system],
  );
  const setHostingOrigin = useCallback(
    (v: string) => {
      system.facts.hostingOrigin = v;
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
    const originError = isClientSideBadOrigin(hostingOrigin ?? "");
    if (originError !== null) {
      setClientGuardError(originError);
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      // Server normalizes URL→hostname too, but doing it client-side
      // makes the redirect URL + idempotency key self-consistent.
      const normalizedDomain = normalizeVendorDomain(vendorDomain ?? "");
      const explicitOrigin = (hostingOrigin ?? "").trim();
      const effectiveOriginForKey =
        explicitOrigin.length > 0
          ? explicitOrigin
          : `https://${normalizedDomain}`;
      // OATH is the third program migrated to the unified /v1/runs
      // surface (mirrors the DRAGNET wedge). The legacy
      // /api/bureau/oath/run route stays alive as a deprecated alias
      // for callers that haven't migrated; new client code POSTs here.
      const res = await fetch("/api/v1/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline: "bureau:oath",
          payload: {
            vendorDomain: normalizedDomain,
            hostingOrigin:
              explicitOrigin.length > 0 ? explicitOrigin : undefined,
            authorizationAcknowledged: authAck,
          },
          idempotencyKey: idempotencyKeyFor(
            normalizedDomain,
            effectiveOriginForKey,
          ),
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
          body.error ?? `Verify failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.runId,
      };
      system.facts.submitStatus = "succeeded";

      router.push(body.receiptUrl ?? `/bureau/oath/runs/${body.runId}`);
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
        Bare hostname or full URL — Studio fetches{" "}
        <code>https://{`{domain}`}/.well-known/pluck-oath.json</code>{" "}
        and verifies the DSSE envelope. Use punycode for IDN domains.
      </BureauHelpText>

      <BureauLabel text="Hosting origin (optional)">
        <BureauInput
          type="url"
          name="hostingOrigin"
          placeholder={effectiveOrigin || "https://openai.com"}
          value={hostingOrigin ?? ""}
          onChange={setHostingOrigin}
          testId="hosting-origin"
        />
      </BureauLabel>
      <BureauHelpText>
        Defaults to <code>https://{`{vendorDomain}`}</code>. Override
        when the oath is served from a sub-origin (e.g.{" "}
        <code>https://chat.openai.com</code>). At verify time we
        cross-check the served Origin against the body's{" "}
        <code>vendor</code> field — distinct from this hosting URL.
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
        {isSubmitting ? "Verifying…" : "Verify oath"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="verify an oath"
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
