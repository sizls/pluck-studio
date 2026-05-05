"use client";

// ---------------------------------------------------------------------------
// WHISTLE Run form — Wave-3 migration to /v1/runs
// ---------------------------------------------------------------------------
//
// PRIVACY INVARIANT: this form NEVER posts source-identifying material.
// The receipt URL prefix is the routing-partner slug — NOT the source.
// The bundleUrl participates in the canonical hash (idempotency dedupe)
// but is intentionally NOT echoed in the receipt. The shared validator
// (validateWhistlePayload) backstops by REJECTING any payload key
// resembling source-identifying material (sourceName, sourceEmail, etc.).
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
  BureauRadioGroup,
  BureauSignInPrompt,
  BureauTextarea,
} from "../../../../components/bureau-ui/forms";
import {
  CATEGORY_LABELS,
  ROUTING_PARTNER_LABELS,
  whistleRunFormModule,
  type Category,
  type RoutingPartner,
} from "../../../../lib/whistle/run-form-module";

interface RunResponse {
  runId?: string;
  /** Legacy /api/bureau/whistle/run shape. */
  phraseId?: string;
  /** /v1/runs shape — receiptUrl returned alongside runId. */
  receiptUrl?: string;
  signInUrl?: string;
  error?: string;
}

/**
 * Build a per-submit idempotency key for the /v1/runs POST. Bucketed by
 * minute so a double-click within ~60s collapses to the same runId.
 * Mirrors the legacy synthesized key.
 */
function idempotencyKeyFor(
  routingPartner: string,
  category: string,
  bundleUrl: string,
): string {
  const minuteBucket = Math.floor(Date.now() / 60_000);

  return `whistle:${routingPartner}:${category}:${bundleUrl}:${minuteBucket}`;
}

const CATEGORY_OPTIONS: ReadonlyArray<{
  value: Category;
  label: ReactNode;
  testId?: string;
}> = (
  ["training-data", "policy-violation", "safety-incident"] as const
).map((c) => ({
  value: c,
  label: CATEGORY_LABELS[c],
  testId: `category-${c}`,
}));

const ROUTING_OPTIONS: ReadonlyArray<{
  value: RoutingPartner;
  label: ReactNode;
  testId?: string;
}> = (
  ["propublica", "bellingcat", "404media", "eff-press"] as const
).map((p) => ({
  value: p,
  label: ROUTING_PARTNER_LABELS[p],
  testId: `routing-${p}`,
}));

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
    return "Bundle URL must use https:// (per WHISTLE wire spec).";
  }
  return null;
}

export function WhistleRunForm(): ReactNode {
  const router = useRouter();
  const system = useMemo(() => {
    const sys = createSystem({ module: whistleRunFormModule });
    sys.start();
    return sys;
  }, []);

  const bundleUrl = useFact(system, "bundleUrl");
  const category = useFact(system, "category");
  const routingPartner = useFact(system, "routingPartner");
  const manualRedactPhrase = useFact(system, "manualRedactPhrase");
  const anonAck = useFact(system, "anonymityCaveatAcknowledged");
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
  const setCategory = useCallback(
    (v: Category) => {
      system.facts.category = v;
    },
    [system],
  );
  const setRoutingPartner = useCallback(
    (v: RoutingPartner) => {
      system.facts.routingPartner = v;
    },
    [system],
  );
  const setManualRedactPhrase = useCallback(
    (v: string) => {
      system.facts.manualRedactPhrase = v;
    },
    [system],
  );
  const setAnonAck = useCallback(
    (v: boolean) => {
      system.facts.anonymityCaveatAcknowledged = v;
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
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const normalizedBundleUrl = (bundleUrl ?? "").trim();
      const normalizedCategory = category ?? "training-data";
      const normalizedPartner = routingPartner ?? "propublica";
      const trimmedRedact = (manualRedactPhrase ?? "").trim();

      // PRIVACY: payload contains the canonical activation fields only.
      // The receipt page never echoes bundleUrl back; it lives in the
      // canonical hash for idempotency dedupe. The shared validator
      // REJECTS any payload key resembling source-identifying material.
      const res = await fetch("/api/v1/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pipeline: "bureau:whistle",
          payload: {
            bundleUrl: normalizedBundleUrl,
            category: normalizedCategory,
            routingPartner: normalizedPartner,
            manualRedactPhrase:
              trimmedRedact.length > 0 ? trimmedRedact : undefined,
            anonymityCaveatAcknowledged: anonAck,
            authorizationAcknowledged: authAck,
          },
          idempotencyKey: idempotencyKeyFor(
            normalizedPartner,
            normalizedCategory,
            normalizedBundleUrl,
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
          body.error ?? `Submit failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }
      system.facts.lastResult = {
        runId: body.runId,
        phraseId: body.runId,
      };
      system.facts.submitStatus = "succeeded";

      router.push(body.receiptUrl ?? `/bureau/whistle/runs/${body.runId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="whistle-run-form">
      <BureauLabel text="Bundle URL">
        <BureauInput
          type="url"
          name="bundleUrl"
          required
          autoFocus
          placeholder="https://anonymous-host.example/tip.json"
          value={bundleUrl ?? ""}
          onChange={setBundleUrl}
          testId="bundle-url"
        />
      </BureauLabel>
      <BureauHelpText>
        HTTPS-only public URL of the pre-redacted tip-bundle JSON.
        Studio fetches ≤ 256 KiB, 10s timeout, no redirects. Host the
        bundle on a venue you trust — Studio's IP appears in the
        access log of whoever's serving it.
      </BureauHelpText>

      <BureauRadioGroup
        name="category"
        legend="Category"
        options={CATEGORY_OPTIONS}
        value={category ?? "training-data"}
        onChange={setCategory}
        testId="category"
      />

      <BureauRadioGroup
        name="routingPartner"
        legend="Routing partner"
        options={ROUTING_OPTIONS}
        value={routingPartner ?? "propublica"}
        onChange={setRoutingPartner}
        testId="routing-partner"
      />
      <BureauHelpText>
        V2-A scope: one routing partner per submission. Multi-target
        routing requires the CLI ({" "}
        <code>pluck bureau whistle submit --routing "a,b"</code>) until
        the multi-select form lands.
      </BureauHelpText>

      <BureauLabel text="Manual-redact phrase (optional)">
        <BureauTextarea
          name="manualRedactPhrase"
          placeholder="Phrase or pattern that should be scrubbed from the bundle before routing"
          value={manualRedactPhrase ?? ""}
          onChange={setManualRedactPhrase}
          rows={3}
          testId="manual-redact"
        />
      </BureauLabel>
      <BureauHelpText>
        Studio's layered redactor (TRIPWIRE secret-scrub +
        k-anonymity floor + stylometric refusal) runs unconditionally.
        Use this field to add a project-specific phrase that
        wouldn't otherwise match a generic scrub pattern. Max 256
        characters.
      </BureauHelpText>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #ff8888",
          background: "rgba(255, 0, 0, 0.04)",
          borderRadius: 4,
        }}
      >
        <p
          style={{
            fontFamily: "var(--bureau-mono)",
            fontSize: 13,
            color: "#ff8888",
            marginTop: 0,
            marginBottom: 12,
          }}
        >
          <strong>Anonymity is best-effort, NOT absolute.</strong>
        </p>
        <p style={{ fontSize: 13, marginBottom: 12 }}>
          The ephemeral key + redactor protect against trivial
          deanonymization (key reuse, accidental secret disclosure,
          obvious stylometric leaks). They do <strong>NOT</strong>{" "}
          protect against timing/IP-layer correlation, stylometric
          attacks against small populations, file metadata / EXIF, or
          CFAA / Computer Misuse Act liability when the evidence comes
          from inside a vendor.
        </p>
        <p style={{ fontSize: 13, marginBottom: 0 }}>
          Read{" "}
          <a href="/bureau/whistle">
            <code>/bureau/whistle</code>
          </a>{" "}
          before submitting. Speak to a lawyer first when filing in{" "}
          <code>policy-violation</code> or <code>safety-incident</code>{" "}
          with vendor-internal evidence.
        </p>
      </div>

      <BureauCheckbox
        checked={anonAck ?? false}
        onChange={setAnonAck}
        testId="anonymity-ack"
      >
        I have read and understand the anonymity caveat.
      </BureauCheckbox>

      <BureauCheckbox
        checked={authAck ?? false}
        onChange={setAuthAck}
        testId="auth-ack"
      >
        I am authorized to submit this bundle, and I understand that
        the cycle receipt + Rekor anchor are public — though the
        bundle's contents are routed only to the partner above.
      </BureauCheckbox>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--bureau-fg-dim)" }}
      >
        Submission receipts are signed by the Pluck-fleet hosted key
        (
        <a href="/.well-known/pluck-keys.json">
          <code>/.well-known/pluck-keys.json</code>
        </a>
        ). The bundle itself is signed by an ephemeral Ed25519 key
        rotated per-submission — Studio doesn't retain it.
      </p>

      <BureauButton type="submit" disabled={!canSubmit} testId="run-submit">
        {isSubmitting ? "Submitting…" : "Submit tip"}
      </BureauButton>

      {needsSignIn && signInUrl ? (
        <BureauSignInPrompt
          signInUrl={signInUrl}
          action="submit a tip"
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
