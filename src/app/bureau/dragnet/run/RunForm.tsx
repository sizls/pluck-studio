"use client";

// ---------------------------------------------------------------------------
// DRAGNET Run form — client component, Directive-backed
// ---------------------------------------------------------------------------
//
// Form state lives in `dragnetRunFormModule` (a Directive module). React
// reads via `useFact` / `useDerived`. Submit, redirect, and auth-fail
// routing are imperative effects fired off the same module's facts.
//
// Domain shape (per Bureau-Directive Loyalty Rule extension to Studio):
//   - Renames `vendorUrl` → `targetUrl` (DRAGNET probes target endpoints,
//     not vendor homepages).
//   - "Run a probe-pack", not "Run a probe" (a pack contains N probes).
//   - Cadence radio: "Run once" (active) / "Continuous monitoring"
//     (disabled, marked Coming soon — server rejects with same copy).
//   - ToS / probe-authorization checkbox required before submit.
//   - Localhost / private IPs blocked client-side as a cosmetic guard;
//     real DNS-resolution-time SSRF filter lands with the runner (C2).
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { useDerived, useFact } from "@directive-run/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  dragnetRunFormModule,
  type Cadence,
} from "../../../../lib/dragnet/run-form-module";

interface RunResponse {
  runId?: string;
  phraseId?: string;
  signInUrl?: string;
  error?: string;
}

const InputStyle = {
  width: "100%",
  padding: "8px 12px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  background: "var(--bureau-bg)",
  color: "var(--bureau-fg)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  marginTop: 4,
};

const LabelStyle = {
  display: "block",
  marginTop: 16,
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
};

const HelpTextStyle = {
  fontSize: 12,
  color: "var(--bureau-fg-dim)",
  marginTop: 4,
};

const ButtonStyle = {
  marginTop: 24,
  padding: "10px 20px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  background: "var(--bureau-fg)",
  color: "var(--bureau-bg)",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

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

export function DragnetRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: dragnetRunFormModule });
    sys.start();

    return sys;
  }, []);

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
      const res = await fetch("/api/bureau/dragnet/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          probePackId,
          cadence,
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
          body.error ?? `Run failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }

      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.phraseId,
      };
      system.facts.submitStatus = "succeeded";

      // Phrase ID is the canonical user-facing receipt URL.
      router.push(`/bureau/dragnet/runs/${body.phraseId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  return (
    <form onSubmit={onSubmit} data-testid="dragnet-run-form">
      <label style={LabelStyle}>
        Target endpoint
        <input
          type="url"
          name="targetUrl"
          required
          autoFocus
          placeholder="https://api.openai.com/v1/chat/completions"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          style={InputStyle}
          data-testid="target-url"
        />
      </label>
      <p style={HelpTextStyle}>
        The model API endpoint, claims/policy URL, or product surface to
        probe. Must be public (no localhost or private IPs). You assert
        below that you are authorized to probe this target.
      </p>

      <label style={LabelStyle}>
        Probe-pack ID
        <input
          type="text"
          name="probePackId"
          required
          value={probePackId}
          onChange={(e) => setProbePackId(e.target.value)}
          style={InputStyle}
          data-testid="probe-pack-id"
        />
      </label>
      <p style={HelpTextStyle}>
        The signed bundle of probes to replay. Leave as <code>canon-honesty</code>
        {" "}for the default pack, or use a NUCLEI-qualified ID like
        {" "}<code>author/pack@version</code>.
      </p>

      <fieldset
        style={{ marginTop: 16, border: "none", padding: 0 }}
        data-testid="cadence"
      >
        <legend style={LabelStyle}>Cadence</legend>
        <label style={{ display: "block", marginTop: 8 }}>
          <input
            type="radio"
            name="cadence"
            value="once"
            checked={cadence === "once"}
            onChange={() => setCadence("once")}
            data-testid="cadence-once"
          />{" "}
          Run once (one-shot probe-pack execution)
        </label>
        <label
          style={{
            display: "block",
            marginTop: 8,
            color: "var(--bureau-fg-dim)",
          }}
        >
          <input
            type="radio"
            name="cadence"
            value="continuous"
            checked={cadence === "continuous"}
            disabled
            data-testid="cadence-continuous"
          />{" "}
          Continuous monitoring <em>(coming soon)</em>
        </label>
      </fieldset>

      <label
        style={{ display: "block", marginTop: 24 }}
        data-testid="auth-ack-label"
      >
        <input
          type="checkbox"
          checked={authAck}
          onChange={(e) => setAuthAck(e.target.checked)}
          data-testid="auth-ack"
        />{" "}
        I am authorized to probe this target. (Required — DRAGNET will
        log this assertion to the public transparency log on each run.)
      </label>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Hosted-mode runs are signed by the Pluck-fleet hosted key
        (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
        Bring-your-own-key signing lands with the operator-key flow.
      </p>

      <button
        type="submit"
        disabled={!canSubmit}
        style={{ ...ButtonStyle, opacity: canSubmit ? 1 : 0.6 }}
        data-testid="run-submit"
      >
        {isSubmitting ? "Running…" : "Run probe-pack"}
      </button>

      {needsSignIn && signInUrl ? (
        <p
          style={{ marginTop: 16, color: "var(--bureau-fg-dim)" }}
          data-testid="sign-in-prompt"
        >
          You need to be signed in to run a probe-pack.{" "}
          <a href={signInUrl}>Sign in</a> and try again.
        </p>
      ) : null}

      {(hasError && errorMessage !== null) || clientGuardError ? (
        <p
          style={{ marginTop: 16, color: "#ff4444" }}
          data-testid="run-error"
          role="alert"
          aria-live="polite"
        >
          {clientGuardError ?? errorMessage}
        </p>
      ) : null}

      {/*
        Pluck-Studio Round 1 ref: submitStatus is observable for tests via
        useFact above. The render uses `isSubmitting` (derivation) but
        downstream consumers (e.g. the receipt redirect race) read the
        fact directly.
      */}
      <span data-testid="submit-status" hidden>
        {submitStatus}
      </span>
    </form>
  );
}
