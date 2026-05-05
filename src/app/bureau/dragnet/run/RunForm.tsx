"use client";

// ---------------------------------------------------------------------------
// DRAGNET Run form — client component, Directive-backed
// ---------------------------------------------------------------------------
//
// Form state lives in `dragnetRunFormModule` (a Directive module). React
// reads via `useFact` / `useDerived`. Submit, redirect, and auth-fail
// routing are imperative effects fired off the same module's facts.
//
// Renders via shared `bureau-ui/forms` primitives — every Bureau program
// activation form composes these primitives with a per-program Directive
// module + per-program field set. OATH is the second program to wire
// using this pattern (proves generalizability per the v1 plan).
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { useDerived, useFact } from "@directive-run/react";
import { useRouter, useSearchParams } from "next/navigation";
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
  dragnetRunFormModule,
  type Cadence,
} from "../../../../lib/dragnet/run-form-module";

interface RunResponse {
  runId?: string;
  /** Legacy /api/bureau/dragnet/run shape. */
  phraseId?: string;
  /** /v1/runs shape — receiptUrl returned alongside runId. */
  receiptUrl?: string;
  signInUrl?: string;
  error?: string;
}

const CADENCE_OPTIONS: ReadonlyArray<{
  value: Cadence;
  label: ReactNode;
  disabled?: boolean;
  testId?: string;
}> = [
  {
    value: "once",
    label: "Run once (one-shot probe-pack execution)",
    testId: "cadence-once",
  },
  {
    value: "continuous",
    label: (
      <>
        Continuous monitoring <em>(coming soon)</em>
      </>
    ),
    disabled: true,
    testId: "cadence-continuous",
  },
];

/**
 * Build a per-submit idempotency key for the /v1/runs POST. We bucket
 * by minute so a double-click within ~60s collapses to the same runId,
 * but a deliberate "run again" 2 minutes later is a fresh run. Cheap
 * client-side; the server hashes (pipeline+payload+key) before storing.
 */
function idempotencyKeyFor(targetUrl: string, probePackId: string): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);

  return `dragnet:${probePackId}:${targetUrl}:${minuteBucket}`;
}

function isClientSideBadTarget(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "Target endpoint is required.";
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "Target endpoint must be a valid URL (include https://).";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Target endpoint must use http:// or https://.";
  }
  const host = parsed.hostname.toLowerCase();
  const localish =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "::" ||
    host === "127.0.0.1";
  if (localish) {
    return "Target endpoint cannot point at localhost or loopback addresses.";
  }
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 10 || a === 127 || a === 0) {
      return "Target endpoint cannot point at private/loopback IPs.";
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return "Target endpoint cannot point at private/loopback IPs.";
    }
    if (a === 192 && b === 168) {
      return "Target endpoint cannot point at private/loopback IPs.";
    }
    if (a === 169 && b === 254) {
      return "Target endpoint cannot point at link-local addresses.";
    }
  }
  return null;
}

/**
 * Map a vendor slug from `?vendor=<slug>` (set by /extract's "Probe with
 * DRAGNET" CTA) to a sensible default target URL. Studio only knows the
 * slug at extraction time — this mapping turns the slug into the public
 * API endpoint a probe-pack would actually hit. Unrecognized slugs fall
 * through (the operator fills in the URL).
 *
 * Kept tiny and inline because the mapping is documented in IDEAS.md +
 * tested at the e2e layer; a full vendor-endpoint registry is a future
 * concern (probably belongs in `lib/programs/registry.ts` next to the
 * vendor honesty index queries).
 */
function vendorSlugToDefaultUrl(slug: string): string | null {
  const lower = slug.trim().toLowerCase();
  if (lower === "openai" || lower === "chatgpt" || lower === "gpt") {
    return "https://api.openai.com/v1/chat/completions";
  }
  if (lower === "anthropic" || lower === "claude") {
    return "https://api.anthropic.com/v1/messages";
  }
  if (lower === "google" || lower === "gemini" || lower === "bard") {
    return "https://generativelanguage.googleapis.com/v1/models";
  }

  return null;
}

export function DragnetRunForm(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillVendor = searchParams.get("vendor");
  const prefillAssertion = searchParams.get("assertion");
  const isPrefilledFromExtract = prefillVendor !== null || prefillAssertion !== null;

  const system = useMemo(() => {
    const sys = createSystem({ module: dragnetRunFormModule });
    sys.start();
    // Pre-fill from /extract → DRAGNET handoff. The operator must STILL
    // review + click submit (auth-ack required); pre-filling is just a
    // convenience hop, never an auto-submit. See IDEAS.md R1 idea 3
    // ("gate behind human-confirmation step to avoid hallucinated probes
    // / defamation").
    if (prefillVendor !== null) {
      const defaultUrl = vendorSlugToDefaultUrl(prefillVendor);
      if (defaultUrl !== null) {
        sys.facts.targetUrl = defaultUrl;
      }
    }

    return sys;
  }, [prefillVendor]);

  const targetUrl = useFact(system, "targetUrl");
  const probePackId = useFact(system, "probePackId");
  const cadence = useFact(system, "cadence");
  const authAck = useFact(system, "authorizationAcknowledged");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");

  const setTargetUrl = useCallback(
    (v: string) => {
      system.facts.targetUrl = v;
    },
    [system],
  );
  const setProbePackId = useCallback(
    (v: string) => {
      system.facts.probePackId = v;
    },
    [system],
  );
  const setCadence = useCallback(
    (v: Cadence) => {
      system.facts.cadence = v;
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
    const guardError = isClientSideBadTarget(targetUrl ?? "");
    if (guardError !== null) {
      setClientGuardError(guardError);
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      // DRAGNET is the wedge migration to the unified /v1/runs surface
      // (Phase 3 of the AE review). The legacy /api/bureau/dragnet/run
      // route stays alive as a deprecated alias for callers that haven't
      // migrated; new client code POSTs here.
      const res = await fetch("/api/v1/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline: "bureau:dragnet",
          payload: {
            targetUrl,
            probePackId,
            cadence,
            authorizationAcknowledged: authAck,
          },
          // Optional client-side idempotency key — guarantees duplicate
          // submits (double-click, network retry) collapse to the same
          // runId. Server falls through gracefully when omitted.
          idempotencyKey: idempotencyKeyFor(targetUrl ?? "", probePackId ?? ""),
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
          body.error ?? `Run failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }

      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.runId,
      };
      system.facts.submitStatus = "succeeded";

      router.push(body.receiptUrl ?? `/bureau/dragnet/runs/${body.runId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="dragnet-run-form">
      {isPrefilledFromExtract ? (
        <div
          data-testid="dragnet-prefill-banner"
          role="status"
          aria-live="polite"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            fontFamily: "var(--bureau-mono)",
            fontSize: 13,
            color: "var(--bureau-fg)",
            border: "1px dashed var(--bureau-fg-dim)",
            borderRadius: 4,
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          Probe pre-filled from{" "}
          <a href="/extract" style={{ textDecoration: "underline" }}>
            screenshot extraction
          </a>{" "}
          — review and submit to run.
          {prefillAssertion ? (
            <p
              data-testid="dragnet-prefill-assertion"
              style={{
                marginTop: 8,
                fontSize: 12,
                color: "var(--bureau-fg-dim)",
                lineHeight: 1.5,
              }}
            >
              <strong>Assertion:</strong> {prefillAssertion}
            </p>
          ) : null}
        </div>
      ) : null}
      <BureauLabel text="Target endpoint">
        <BureauInput
          type="url"
          name="targetUrl"
          required
          autoFocus
          placeholder="https://api.openai.com/v1/chat/completions"
          value={targetUrl ?? ""}
          onChange={setTargetUrl}
          testId="target-url"
        />
      </BureauLabel>
      <BureauHelpText>
        The model API endpoint, claims/policy URL, or product surface to
        probe. Must be public (no localhost or private IPs). You assert
        below that you are authorized to probe this target.
      </BureauHelpText>

      <BureauLabel text="Probe-pack ID">
        <BureauInput
          type="text"
          name="probePackId"
          required
          value={probePackId ?? ""}
          onChange={setProbePackId}
          testId="probe-pack-id"
        />
      </BureauLabel>
      <BureauHelpText>
        The signed bundle of probes to replay. Leave as <code>canon-honesty</code>{" "}
        for the default pack, or use a NUCLEI-qualified ID like{" "}
        <code>author/pack@version</code>.
      </BureauHelpText>

      <BureauRadioGroup
        name="cadence"
        legend="Cadence"
        options={CADENCE_OPTIONS}
        value={cadence ?? "once"}
        onChange={setCadence}
        testId="cadence"
      />

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to probe this target. (Required — DRAGNET will
        log this assertion to the public transparency log on each run.)
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Hosted-mode runs are signed by the Pluck-fleet hosted key
        (
        <a href="/.well-known/pluck-keys.json">
          <code>/.well-known/pluck-keys.json</code>
        </a>
        ). Bring-your-own-key signing lands with the operator-key flow.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Running…" : "Run probe-pack"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="run a probe-pack"
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
