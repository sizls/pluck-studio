"use client";

// ---------------------------------------------------------------------------
// NewWatchForm — Directive-backed Create-Watch form
// ---------------------------------------------------------------------------
//
// Mirrors DragnetRunForm pattern: form state lives in watchFormModule,
// React reads via useFact / useDerived. Submit hits POST /api/v1/watches,
// redirects to the receipt URL on success.
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
  StudioButton,
  StudioCheckbox,
  StudioError,
  StudioHelpText,
  StudioInput,
  StudioLabel,
  StudioRadioGroup,
  StudioSignInPrompt,
  StudioTextarea,
} from "../../../components/programs-ui/forms";
import { watchFormModule } from "../../../lib/watch/watch-form-module";
import type {
  AlertChannels,
  AutonomyMode,
  FetcherKind,
} from "../../../lib/v1/watch-spec";

interface CreateWatchResponse {
  watchId?: string;
  receiptUrl?: string;
  status?: string;
  signInUrl?: string;
  error?: string;
}

const FETCHER_OPTIONS: ReadonlyArray<{
  value: FetcherKind;
  label: ReactNode;
  testId?: string;
  disabled?: boolean;
}> = [
  {
    value: "playwright",
    label: "Playwright (handles JS-rendered + auth-walled pages)",
    testId: "fetcher-playwright",
  },
  {
    value: "http",
    label: "Plain HTTP (faster + cheaper for static pages and APIs)",
    testId: "fetcher-http",
  },
  {
    value: "browserbase",
    label: (
      <>
        Browserbase <em>(coming soon)</em>
      </>
    ),
    disabled: true,
    testId: "fetcher-browserbase",
  },
];

// Autonomy options lead with the OUTCOME (what the operator gets), not
// the jargon. Internal slug remains for the API + telemetry; readers see
// the behavior first. R2 DX fix.
const AUTONOMY_OPTIONS: ReadonlyArray<{
  value: AutonomyMode;
  label: ReactNode;
  testId?: string;
}> = [
  {
    value: "diff-gated",
    label:
      "Cost-saver — cheap text diff first, agent only on real change (recommended)",
    testId: "autonomy-diff-gated",
  },
  {
    value: "full-auto",
    label: "Always-on agent — alert whenever the agent is confident",
    testId: "autonomy-full-auto",
  },
  {
    value: "always-agent",
    label: "Always agent + human review — every alert lands in an approval queue",
    testId: "autonomy-always-agent",
  },
];

const CRON_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "*/15 * * * *", label: "Every 15 minutes" },
  { value: "0 * * * *", label: "Hourly" },
  { value: "@daily", label: "Daily (midnight UTC)" },
  { value: "0 9 * * 1", label: "Weekly (Mon 9am UTC)" },
];

function clientSideUrlGuard(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "URL is required.";
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return "URL must be valid (include https://).";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "URL must use http:// or https://.";
  }
  const host = parsed.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "127.0.0.1"
  ) {
    return "URL cannot point at localhost or loopback.";
  }

  return null;
}

/**
 * Stable per-render idempotency key. Earlier this used a client-side
 * minute-bucket on the clock, which produced a NEW key when a slow
 * round-trip crossed a minute boundary — a duplicate-click after a
 * 60s wait created two watches. A `crypto.randomUUID()` minted ONCE
 * per form mount means: every click within the same mount collapses
 * to the same watchId; reloading the form creates a fresh key. Server
 * clock is the only one that matters for de-duplication.
 */
function newIdempotencyKey(): string {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return `watch:${globalThis.crypto.randomUUID()}`;
  }

  return `watch:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export function NewWatchForm(): ReactNode {
  const router = useRouter();

  const system = useMemo(() => {
    const sys = createSystem({ module: watchFormModule });
    sys.start();

    return sys;
  }, []);

  // One idempotency key per form mount. Submitting twice — even seconds
  // apart, even across a slow network — collapses to the same watchId.
  // Resetting the form (component unmount + remount) creates a fresh key.
  const idempotencyKey = useMemo(() => newIdempotencyKey(), []);

  const name = useFact(system, "name");
  const url = useFact(system, "url");
  const cron = useFact(system, "cron");
  const intent = useFact(system, "intent");
  const fetcherKind = useFact(system, "fetcherKind");
  const autonomyMode = useFact(system, "autonomyMode");
  const alertChannels = useFact(system, "alertChannels");
  const submitStatus = useFact(system, "submitStatus");
  const errorMessage = useFact(system, "errorMessage");
  const signInUrl = useFact(system, "signInUrl");

  const isSubmitting = useDerived(system, "isSubmitting");
  const canSubmit = useDerived(system, "canSubmit");
  const hasError = useDerived(system, "hasError");
  const needsSignIn = useDerived(system, "needsSignIn");

  const setName = useCallback(
    (v: string) => {
      system.facts.name = v;
    },
    [system],
  );
  const setUrl = useCallback(
    (v: string) => {
      system.facts.url = v;
    },
    [system],
  );
  const setCron = useCallback(
    (v: string) => {
      system.facts.cron = v;
    },
    [system],
  );
  const setIntent = useCallback(
    (v: string) => {
      system.facts.intent = v;
    },
    [system],
  );
  const setFetcherKind = useCallback(
    (v: FetcherKind) => {
      system.facts.fetcherKind = v;
    },
    [system],
  );
  const setAutonomyMode = useCallback(
    (v: AutonomyMode) => {
      system.facts.autonomyMode = v;
    },
    [system],
  );
  const currentChannels: AlertChannels = useMemo(
    () => ({
      dashboard: alertChannels?.dashboard ?? true,
      phraseId: alertChannels?.phraseId ?? true,
      email: alertChannels?.email ?? [],
      webhook: alertChannels?.webhook ?? [],
      slack: alertChannels?.slack ?? [],
    }),
    [alertChannels],
  );
  const setChannelFlag = useCallback(
    (key: "dashboard" | "phraseId", v: boolean) => {
      system.facts.alertChannels = { ...currentChannels, [key]: v };
    },
    [currentChannels, system],
  );
  const setChannelList = useCallback(
    (key: "email" | "webhook" | "slack", raw: string) => {
      const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      system.facts.alertChannels = { ...currentChannels, [key]: list };
    },
    [currentChannels, system],
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
    const guard = clientSideUrlGuard(url ?? "");
    if (guard !== null) {
      setClientGuardError(guard);
      return;
    }
    setClientGuardError(null);

    system.facts.errorMessage = null;
    system.facts.signInUrl = null;
    system.facts.submitStatus = "submitting";

    try {
      const res = await fetch("/api/v1/watches", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          url,
          cron,
          intent,
          fetcherKind,
          autonomyMode,
          alertChannels,
          idempotencyKey,
        }),
      });

      const body = (await res.json()) as CreateWatchResponse;

      if (res.status === 401) {
        system.facts.signInUrl = body.signInUrl ?? "/sign-in";
        system.facts.submitStatus = "failed";
        return;
      }

      if (!res.ok || !body.watchId) {
        system.facts.errorMessage =
          body.error ?? `Create failed (HTTP ${res.status})`;
        system.facts.submitStatus = "failed";
        return;
      }

      system.facts.lastResult = {
        watchId: body.watchId,
        receiptUrl: body.receiptUrl ?? `/watch/${body.watchId}`,
      };
      system.facts.submitStatus = "succeeded";
      router.push(body.receiptUrl ?? `/watch/${body.watchId}`);
    } catch (err) {
      system.facts.errorMessage =
        err instanceof Error ? err.message : "Network error";
      system.facts.submitStatus = "failed";
    }
  }

  const errorToShow = clientGuardError ?? (hasError ? errorMessage : null);

  return (
    <form onSubmit={onSubmit} data-testid="new-watch-form">
      <StudioLabel text="Name">
        <StudioInput
          type="text"
          name="name"
          required
          autoFocus
          placeholder="iPhone 15 Pro price drop"
          value={name ?? ""}
          onChange={setName}
          testId="watch-name"
        />
      </StudioLabel>
      <StudioHelpText>
        A short, human label for this watch. Shown in lists and alert
        subjects.
      </StudioHelpText>

      <StudioLabel text="Page to watch">
        <StudioInput
          type="url"
          name="url"
          required
          placeholder="https://www.apple.com/shop/buy-iphone/iphone-15-pro"
          value={url ?? ""}
          onChange={setUrl}
          testId="watch-url"
        />
      </StudioLabel>
      <StudioHelpText>
        Any public URL. Must be reachable from the open internet (no
        localhost, no private IPs). Auth-walled pages work when you pick
        Playwright as the fetcher.
      </StudioHelpText>

      <StudioLabel text="What to watch for">
        <StudioTextarea
          name="intent"
          required
          rows={4}
          placeholder="Watch for the iPhone 15 Pro 256GB to drop below $899, OR for any 'Sale' / 'Discount' messaging to appear next to the price."
          value={intent ?? ""}
          onChange={setIntent}
          testId="watch-intent"
        />
      </StudioLabel>
      <StudioHelpText>
        Describe it the way you&apos;d describe it to a colleague. The
        agent reads this every run alongside the page. 20-2000 characters.
      </StudioHelpText>

      <StudioLabel text="Cadence (cron)">
        <StudioInput
          type="text"
          name="cron"
          required
          placeholder="@daily"
          value={cron ?? ""}
          onChange={setCron}
          testId="watch-cron"
        />
      </StudioLabel>
      <StudioHelpText>
        5-field cron expression or @-macro. Quick picks:{" "}
        {CRON_PRESETS.map((p, i) => (
          <span key={p.value}>
            {i > 0 ? " · " : null}
            <button
              type="button"
              onClick={() => setCron(p.value)}
              aria-pressed={cron === p.value}
              data-testid={`cron-preset-${p.value.replace(/\W+/g, "-")}`}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "var(--studio-fg)",
                cursor: "pointer",
                textDecoration: "underline",
                textDecorationThickness: cron === p.value ? 3 : 1,
                fontWeight: cron === p.value ? 700 : 400,
                font: "inherit",
              }}
            >
              {p.label}
            </button>
          </span>
        ))}
      </StudioHelpText>

      <StudioRadioGroup
        name="fetcherKind"
        legend="How to fetch the page"
        options={FETCHER_OPTIONS}
        value={fetcherKind ?? "playwright"}
        onChange={setFetcherKind}
        testId="watch-fetcher"
      />

      <StudioRadioGroup
        name="autonomyMode"
        legend="Autonomy mode"
        options={AUTONOMY_OPTIONS}
        value={autonomyMode ?? "diff-gated"}
        onChange={setAutonomyMode}
        testId="watch-autonomy"
      />

      <fieldset
        style={{ marginTop: 16, border: "none", padding: 0 }}
        data-testid="watch-channels"
      >
        <legend style={{ display: "block", marginTop: 12 }}>Alert channels</legend>

        <StudioCheckbox
          checked={alertChannels?.dashboard ?? true}
          onChange={(v) => setChannelFlag("dashboard", v)}
          testId="channel-dashboard"
        >
          Studio dashboard (live SSE stream)
        </StudioCheckbox>

        <StudioCheckbox
          checked={alertChannels?.phraseId ?? true}
          onChange={(v) => setChannelFlag("phraseId", v)}
          testId="channel-phrase-id"
        >
          Pluck phrase-ID receipt (audit-friendly, composes with Pluck)
        </StudioCheckbox>

        <StudioLabel text="Email recipients (comma-separated, optional)">
          <StudioInput
            type="text"
            name="email"
            placeholder="alerts@example.com, ops@example.com"
            value={(alertChannels?.email ?? []).join(", ")}
            onChange={(v) => setChannelList("email", v)}
            testId="channel-email"
          />
        </StudioLabel>

        <StudioLabel text="Webhook URLs (comma-separated, https://, optional)">
          <StudioInput
            type="text"
            name="webhook"
            placeholder="https://hooks.example.com/watch"
            value={(alertChannels?.webhook ?? []).join(", ")}
            onChange={(v) => setChannelList("webhook", v)}
            testId="channel-webhook"
          />
        </StudioLabel>

        <StudioLabel text="Slack webhook URLs (comma-separated, optional)">
          <StudioInput
            type="text"
            name="slack"
            placeholder="https://hooks.slack.com/services/…"
            value={(alertChannels?.slack ?? []).join(", ")}
            onChange={(v) => setChannelList("slack", v)}
            testId="channel-slack"
          />
        </StudioLabel>
      </fieldset>

      <p
        style={{ marginTop: 16, fontSize: 12, color: "var(--studio-fg-dim)" }}
      >
        Week-1 stub: the Worker + Playwright + observation agent ship in
        Week-2. Triggering a fresh watch runs a one-shot fetch and writes
        a mock observation so you can see the UI loop end-to-end.
      </p>

      <StudioButton type="submit" disabled={!canSubmit} testId="watch-submit">
        {isSubmitting ? "Creating…" : "Create watch"}
      </StudioButton>

      {needsSignIn && signInUrl ? (
        <StudioSignInPrompt
          signInUrl={signInUrl}
          action="create a watch"
          testId="sign-in-prompt"
        />
      ) : null}

      {errorToShow ? (
        <StudioError message={errorToShow} testId="watch-error" />
      ) : null}

      <span data-testid="submit-status" hidden>
        {submitStatus}
      </span>
    </form>
  );
}
