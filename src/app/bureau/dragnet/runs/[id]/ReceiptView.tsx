"use client";

// ---------------------------------------------------------------------------
// DRAGNET ReceiptView — Directive-backed live receipt UI
// ---------------------------------------------------------------------------
//
// State lives in `dragnetRunReceiptModule`. React reads via useFact +
// useDerived. Today the facts initialise from `params.id` and stay at
// "cycle pending" because pluck-api /v1/runs is not yet wired. When it
// lands, a `@directive-run/query` client (re-added when wired) will
// subscribe to the Supabase Realtime `runs:id=eq.{uuid}` channel and
// re-write facts in place — this render code does not change.
// ---------------------------------------------------------------------------

import { createSystem } from "@directive-run/core";
import { useDerived, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { dragnetRunReceiptModule } from "../../../../../lib/dragnet/run-receipt-module";
import { isPhraseId } from "../../../../../lib/phrase-id";

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const StatusBadgeStyle = {
  display: "inline-block",
  padding: "4px 10px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  background: "var(--bureau-fg-dim)",
  color: "var(--bureau-bg)",
  borderRadius: 4,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
};

const RunIdStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  wordBreak: "break-all" as const,
};

const StatLineStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  marginTop: 4,
};

const StubLabelStyle = {
  fontStyle: "italic" as const,
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
  marginLeft: 8,
};

interface ReceiptViewProps {
  id: string;
}

export function ReceiptView({ id }: ReceiptViewProps): ReactNode {
  const system = useMemo(() => {
    const sys = createSystem({ module: dragnetRunReceiptModule });
    sys.start();
    sys.facts.id = id;
    return sys;
  }, [id]);

  const status = useFact(system, "status");
  const probeCount = useFact(system, "probeCount");
  const classifications = useFact(system, "classifications");
  const dotColor = useFact(system, "dotColor");
  const targetDossierUrl = useFact(system, "targetDossierUrl");
  const receiptUrl = useFact(system, "receiptUrl");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isAnchored = useDerived(system, "isAnchored");
  const hasClassifications = useDerived(system, "hasClassifications");

  useEffect(() => {
    return () => {
      system.destroy();
    };
  }, [system]);

  const isPhrase = isPhraseId(id);
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">DRAGNET Cycle</h1>
        <p className="bureau-hero-tagline">
          <span
            style={StatusBadgeStyle}
            data-testid="run-status"
            aria-live="polite"
          >
            {status ?? "cycle pending"}
          </span>
        </p>

        <p style={SectionHeadingStyle}>
          {isPhrase ? "Phrase ID — your permanent receipt URL" : "Run ID"}
        </p>
        <p style={RunIdStyle} data-testid="run-id">
          {id}
        </p>
        <p style={{ marginTop: 8, fontSize: 12 }}>
          <button
            type="button"
            onClick={onCopy}
            style={{
              fontFamily: "var(--bureau-mono)",
              fontSize: 12,
              padding: "4px 10px",
              background: "var(--bureau-fg-dim)",
              color: "var(--bureau-bg)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
            data-testid="copy-url"
          >
            {copied ? "Copied!" : "Copy receipt URL"}
          </button>
          {isPhrase ? (
            <span
              style={{
                marginLeft: 12,
                color: "var(--bureau-fg-dim)",
                fontStyle: "italic",
              }}
            >
              Bookmark it — same phrase, same URL, forever.
            </span>
          ) : null}
        </p>

        {isPending ? (
          <p
            style={{
              marginTop: 16,
              fontStyle: "italic",
              color: "var(--bureau-fg-dim)",
            }}
            data-testid="pending-banner"
          >
            Stub run — <code>pluck-api /v1/runs</code> isn't yet wired,
            so this URL stays here until the runner lands. Bookmark it;
            the URL is permanent and will fill in automatically.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Cycle outcome</h2>
        <p style={StatLineStyle} data-testid="probe-count">
          Probes run: {probeCount ?? "—"}
          {probeCount === null ? (
            <span style={StubLabelStyle}>(awaiting runner)</span>
          ) : null}
        </p>
        <p style={StatLineStyle} data-testid="classifications">
          Contradict / Mirror / Shadow / Snare:{" "}
          {classifications
            ? `${classifications.contradict} / ${classifications.mirror} / ${classifications.shadow} / ${classifications.snare}`
            : "— / — / — / —"}
          {classifications === null ? (
            <span style={StubLabelStyle}>(awaiting runner)</span>
          ) : null}
        </p>
        <p style={StatLineStyle} data-testid="dot-color">
          TimelineDot: {dotColor ?? "—"}
          {dotColor === null ? (
            <span style={StubLabelStyle}>(awaiting runner)</span>
          ) : null}
        </p>
        {hasClassifications && classifications ? (
          <p style={StatLineStyle}>
            Total classified:{" "}
            {classifications.contradict +
              classifications.mirror +
              classifications.shadow +
              classifications.snare}
          </p>
        ) : null}
        <p style={{ ...StatLineStyle, marginTop: 12, fontSize: 11 }}>
          <em>
            DRAGNET classifies each probe response into one of four
            buckets; the cycle's TimelineDot color is the worst class
            seen this cycle:{" "}
            <code>contradict / mirror → red</code>,{" "}
            <code>shadow → amber</code>,{" "}
            <code>snare → green</code>. The "pack matchers" referenced
            in the program description are the predicates that perform
            the classification — they live inside the probe-pack YAML,
            not the receipt.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        {isAnchored && receiptUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">
              Rekor UUID: <code>{rekorUuid}</code>
            </p>
            <p>
              Verify offline:{" "}
              <code>
                curl {receiptUrl} | cosign verify-blob --key
                /.well-known/pluck-keys.json -
              </code>
            </p>
          </>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>Signed receipt</strong> — DSSE envelope you can verify
              offline with{" "}
              <code>cosign verify-blob --key /.well-known/pluck-keys.json</code>.
            </li>
            <li>
              <strong>Rekor entry UUID</strong> — public transparency-log
              anchor.
            </li>
            <li>
              <strong>Frame-by-frame trace</strong> — every probe → cassette
              event, scrubbable via the Pluck Bureau timeline.
            </li>
            <li>
              <strong>Share URL</strong> — public scrubber view for any
              visitor (operator opts in).
            </li>
          </ul>
        )}
      </section>

      {targetDossierUrl ? (
        <section>
          <h2 style={SectionHeadingStyle}>Target dossier</h2>
          <p>
            <a href={targetDossierUrl} data-testid="dossier-link">
              View all DRAGNET cycles against this target →
            </a>
          </p>
        </section>
      ) : null}

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Hosted-mode receipts are signed with the Pluck-fleet hosted key
          (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ). Bring-your-own-key signing lands with the operator-key flow.
        </p>
      </section>
    </>
  );
}
