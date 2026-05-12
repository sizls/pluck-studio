"use client";

// ---------------------------------------------------------------------------
// WatchDetailView — live state + observation history + actions
// ---------------------------------------------------------------------------
//
// SSE-subscribed live updates via /api/v1/watches/[id]/events. Operator
// actions: pause/resume, trigger now, archive. Observation list is
// receipt-style — phrase ID, classification, reasoning, evidence quote.
// ---------------------------------------------------------------------------

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  ObservationRecord,
  WatchRecord,
  WatchStatus,
} from "../../../lib/v1/watch-spec";

interface WatchDetailViewProps {
  readonly watch: WatchRecord;
  readonly initialObservations: ReadonlyArray<ObservationRecord>;
  readonly observationCount: number;
}

const STATUS_COLOR: Record<WatchStatus, string> = {
  active: "#7ee787",
  paused: "#e3a548",
  running: "#79c0ff",
  failed: "#ff8888",
  archived: "var(--bureau-fg-dim)",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const KvRowStyle = {
  display: "grid",
  gridTemplateColumns: "200px 1fr",
  padding: "6px 0",
  fontSize: 13,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const ButtonStyle = {
  padding: "8px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  background: "var(--bureau-bg)",
  color: "var(--bureau-fg)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  cursor: "pointer",
  marginRight: 8,
};

function formatTs(iso: string | null): string {
  if (iso === null) {
    return "—";
  }
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function WatchDetailView({
  watch: initial,
  initialObservations,
  observationCount,
}: WatchDetailViewProps): ReactNode {
  const [watch, setWatch] = useState<WatchRecord>(initial);
  const [observations, setObservations] = useState<ReadonlyArray<ObservationRecord>>(
    initialObservations,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const watchId = initial.watchId;
  const sourceRef = useRef<EventSource | null>(null);

  // SSE subscription — live state + observation push.
  useEffect(() => {
    const es = new EventSource(`/api/v1/watches/${watchId}/events`);
    sourceRef.current = es;

    es.addEventListener("state", (ev: MessageEvent) => {
      try {
        const record = JSON.parse(ev.data) as WatchRecord;
        setWatch(record);
      } catch {
        // ignore parse errors
      }
    });
    es.addEventListener("observation", (ev: MessageEvent) => {
      try {
        const record = JSON.parse(ev.data) as ObservationRecord;
        setObservations((prev) => [record, ...prev].slice(0, 50));
      } catch {
        // ignore
      }
    });
    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do unless we want to
      // surface offline UX.
    };

    return () => {
      es.close();
      sourceRef.current = null;
    };
  }, [watchId]);

  const doAction = useCallback(
    async (
      label: string,
      run: () => Promise<Response>,
      onOk?: (body: unknown) => void,
    ): Promise<void> => {
      setBusy(label);
      setActionError(null);
      try {
        const res = await run();
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          const err =
            body && typeof body === "object" && "error" in body
              ? String((body as { error: unknown }).error)
              : `Action failed (HTTP ${res.status})`;
          setActionError(err);
          return;
        }
        if (onOk) {
          onOk(body);
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Network error");
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const trigger = useCallback(async (): Promise<void> => {
    await doAction("trigger", () =>
      fetch(`/api/v1/watches/${watchId}/trigger`, { method: "POST" }),
    );
  }, [doAction, watchId]);

  const pauseOrResume = useCallback(async (): Promise<void> => {
    const next = watch.status === "active" ? "paused" : "active";
    await doAction(next, () =>
      fetch(`/api/v1/watches/${watchId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      }),
    );
  }, [doAction, watch.status, watchId]);

  const archive = useCallback(async (): Promise<void> => {
    if (
      !window.confirm(
        "Archive this watch? It stops running and disappears from active lists, but the history stays for audit.",
      )
    ) {
      return;
    }
    await doAction("archive", () =>
      fetch(`/api/v1/watches/${watchId}`, { method: "DELETE" }),
    );
  }, [doAction, watchId]);

  const channelsSummary = useMemo(() => {
    const c = watch.alertChannels;
    const parts: string[] = [];
    if (c.dashboard) parts.push("dashboard");
    if (c.phraseId) parts.push("phrase-id");
    if (c.email.length > 0) parts.push(`email (${c.email.length})`);
    if (c.webhook.length > 0) parts.push(`webhook (${c.webhook.length})`);
    if (c.slack.length > 0) parts.push(`slack (${c.slack.length})`);

    return parts.join(" · ");
  }, [watch.alertChannels]);

  return (
    <>
      <section className="bureau-hero">
        <h1
          className="bureau-hero-title"
          data-testid="watch-detail-name"
        >
          {watch.name}
        </h1>
        <p className="bureau-hero-tagline">
          <span
            data-testid="watch-detail-status"
            style={{
              fontFamily: "var(--bureau-mono)",
              color: STATUS_COLOR[watch.status],
              marginRight: 12,
            }}
          >
            {watch.status}
          </span>
          ·{" "}
          <span style={{ fontFamily: "var(--bureau-mono)" }}>
            {watch.cron}
          </span>{" "}
          · {watch.autonomyMode} · {watch.fetcherKind}
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Actions</h2>
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={trigger}
            disabled={busy !== null || watch.status === "archived"}
            data-testid="watch-trigger"
            style={ButtonStyle}
          >
            {busy === "trigger" ? "Triggering…" : "Trigger now"}
          </button>
          <button
            type="button"
            onClick={pauseOrResume}
            disabled={busy !== null || watch.status === "archived"}
            data-testid="watch-pause-resume"
            style={ButtonStyle}
          >
            {watch.status === "active" ? "Pause" : "Resume"}
          </button>
          <button
            type="button"
            onClick={archive}
            disabled={busy !== null || watch.status === "archived"}
            data-testid="watch-archive"
            style={ButtonStyle}
          >
            Archive
          </button>
        </div>
        {actionError !== null ? (
          <p
            data-testid="watch-action-error"
            style={{ marginTop: 12, color: "#ff8888", fontSize: 13 }}
          >
            {actionError}
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What we&apos;re watching</h2>
        <p
          data-testid="watch-detail-intent"
          style={{
            marginTop: 12,
            padding: "12px 16px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--bureau-fg-dim)",
            borderRadius: 4,
            whiteSpace: "pre-wrap",
          }}
        >
          {watch.intent}
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Configuration</h2>
        <div style={{ marginTop: 12 }}>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>URL</span>
            <code data-testid="watch-detail-url">{watch.url}</code>
          </div>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>Alert channels</span>
            <span>{channelsSummary || "—"}</span>
          </div>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>
              Confidence threshold
            </span>
            <span>{watch.confidenceThreshold}</span>
          </div>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>
              Diff threshold
            </span>
            <span>{watch.diffThreshold}</span>
          </div>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>
              Daily budget
            </span>
            <span>${watch.dailyBudgetUsd.toFixed(2)}</span>
          </div>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>Last fired</span>
            <span>
              {watch.lastFiredAt === null
                ? "never"
                : new Date(watch.lastFiredAt).toLocaleString()}
            </span>
          </div>
          <div style={KvRowStyle}>
            <span style={{ color: "var(--bureau-fg-dim)" }}>Created</span>
            <span>{formatTs(watch.createdAt)}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>
          Observations ({observationCount})
        </h2>
        {observations.length === 0 ? (
          <p
            data-testid="watch-observations-empty"
            style={{ color: "var(--bureau-fg-dim)", marginTop: 12 }}
          >
            No observations yet. Click &quot;Trigger now&quot; to run one.
          </p>
        ) : (
          <ul
            data-testid="watch-observations"
            style={{ listStyle: "none", padding: 0, marginTop: 12 }}
          >
            {observations.map((o) => (
              <li
                key={o.observationId}
                data-testid={`observation-${o.observationId}`}
                style={{
                  padding: "16px 20px",
                  marginTop: 12,
                  border: "1px solid var(--bureau-fg-dim)",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <code
                    style={{
                      fontSize: 11,
                      color: "var(--bureau-fg-dim)",
                    }}
                  >
                    {o.phraseId}
                  </code>
                  <span
                    style={{
                      fontFamily: "var(--bureau-mono)",
                      fontSize: 12,
                      color:
                        o.kind === "error"
                          ? "#ff8888"
                          : o.observation?.alertWorthy
                            ? "#7ee787"
                            : "var(--bureau-fg-dim)",
                    }}
                  >
                    {o.kind}
                    {o.observation
                      ? ` · ${o.observation.classification}`
                      : ""}
                  </span>
                </div>
                {o.errorMessage ? (
                  <p style={{ marginTop: 8, color: "#ff8888", fontSize: 13 }}>
                    {o.errorMessage}
                  </p>
                ) : null}
                {o.observation ? (
                  <>
                    <p style={{ marginTop: 8, fontSize: 14 }}>
                      {o.observation.naturalLanguageSummary}
                    </p>
                    {o.observation.causalExplanation ? (
                      <p
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                          color: "var(--bureau-fg-dim)",
                          fontStyle: "italic",
                        }}
                      >
                        Why: {o.observation.causalExplanation}
                      </p>
                    ) : null}
                    {o.observation.evidenceQuote ? (
                      <blockquote
                        style={{
                          marginTop: 8,
                          padding: "8px 12px",
                          borderLeft: "3px solid var(--bureau-fg-dim)",
                          fontSize: 12,
                          color: "var(--bureau-fg-dim)",
                        }}
                      >
                        “{o.observation.evidenceQuote}”
                      </blockquote>
                    ) : null}
                  </>
                ) : null}
                <p
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--bureau-mono)",
                    fontSize: 11,
                    color: "var(--bureau-fg-dim)",
                  }}
                >
                  {formatTs(o.fetchedAt)}
                  {o.modelUsed ? ` · ${o.modelUsed}` : ""}
                  {o.agentCostUsd > 0
                    ? ` · $${o.agentCostUsd.toFixed(4)}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
