"use client";

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { isPhraseId } from "../../../../../lib/phrase-id";
import {
  TRIPWIRE_PREDICATE_URI,
  tripwireRunReceiptModule,
} from "../../../../../lib/tripwire/run-receipt-module";

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

const NextActionStyle = {
  display: "inline-block",
  marginRight: 16,
  padding: "8px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  background: "var(--bureau-fg-dim)",
  color: "var(--bureau-bg)",
  textDecoration: "none",
  borderRadius: 4,
};

interface ReceiptViewProps {
  id: string;
}

export function ReceiptView({ id }: ReceiptViewProps): ReactNode {
  // M3 fix: useDirectiveRef is the Strict-Mode-safe lifecycle hook from
  // @directive-run/react. The previous useMemo + manual destroy pattern
  // was unsafe — useMemo is NOT a guaranteed cache.
  const system = useDirectiveRef({ module: tripwireRunReceiptModule });

  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const machineId = useFact(system, "machineId");
  const policySource = useFact(system, "policySource");
  const notarize = useFact(system, "notarize");
  const watchedHostCount = useFact(system, "watchedHostCount");
  const installSnippet = useFact(system, "installSnippet");
  const ingestionEndpoint = useFact(system, "ingestionEndpoint");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const policyUrl = useFact(system, "policyUrl");
  const rekorUuid = useFact(system, "rekorUuid");
  const configuredAt = useFact(system, "configuredAt");

  const isPending = useDerived(system, "isPending");
  const isConfigured = useDerived(system, "isConfigured");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");
  const timelineUrl = useDerived(system, "timelineUrl");

  const isPhrase = isPhraseId(id);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const onCopy = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator === "undefined" || !navigator.clipboard || !url) {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 2500);
      return;
    }
    navigator.clipboard.writeText(url).then(
      () => {
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 2000);
      },
      () => {
        setCopyState("failed");
        window.setTimeout(() => setCopyState("idle"), 2500);
      },
    );
  }, []);

  const [snippetCopyState, setSnippetCopyState] = useState<
    "idle" | "copied" | "failed"
  >("idle");
  const onCopySnippet = useCallback(() => {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      !installSnippet
    ) {
      setSnippetCopyState("failed");
      window.setTimeout(() => setSnippetCopyState("idle"), 2500);
      return;
    }
    navigator.clipboard.writeText(installSnippet).then(
      () => {
        setSnippetCopyState("copied");
        window.setTimeout(() => setSnippetCopyState("idle"), 2000);
      },
      () => {
        setSnippetCopyState("failed");
        window.setTimeout(() => setSnippetCopyState("idle"), 2500);
      },
    );
  }, [installSnippet]);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">TRIPWIRE deployment</h1>
        <p className="bureau-hero-tagline">
          <span style={StatusBadgeStyle} data-testid="run-status" aria-live="polite">
            {status ?? "configuration pending"}
          </span>
        </p>
        <p style={SectionHeadingStyle}>
          {isPhrase ? "Phrase ID — your permanent receipt URL" : "Run ID"}
        </p>
        <p style={RunIdStyle} data-testid="run-id">{id}</p>
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
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Copy failed — select URL bar"
                : "Copy receipt URL"}
          </button>
          {isPhrase ? (
            <span style={{ marginLeft: 12, color: "var(--bureau-fg-dim)", fontStyle: "italic" }}>
              Bookmark it — same phrase, same URL, forever.
            </span>
          ) : null}
        </p>
        {isPending ? (
          <p style={{ marginTop: 16, fontStyle: "italic", color: "var(--bureau-fg-dim)" }} data-testid="pending-banner">
            Stub configure — <code>pluck-api /v1/tripwire/configure</code> isn't yet wired.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verdict</h2>
        <p style={StatLineStyle} data-testid="verdict">
          Configuration: {verdict ?? "—"}{" "}
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                verdictColor === "green"
                  ? "#1f7a3a"
                  : verdictColor === "amber"
                    ? "#a78a1f"
                    : verdictColor === "red"
                      ? "#a3201d"
                      : "#888273",
              marginLeft: 8,
            }}
          />
        </p>
        {verdictDetail ? <p style={StatLineStyle}>{verdictDetail}</p> : null}
        {isConfigured ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="configured-callout">
              Configured. Policy signed; install snippet + ingestion
              endpoint below. Paste the snippet into your dev machine
              and attestations start landing in the timeline.
            </strong>
          </p>
        ) : null}
        {verdict === "machine-already-active" ? (
          <p style={{ ...StatLineStyle, color: "#a78a1f" }}>
            <strong data-testid="already-active-callout">
              Machine already has an active deployment. Rotate the
              existing one via{" "}
              <a href="/bureau/rotate/run">/bureau/rotate/run</a>{" "}
              before configuring a new policy.
            </strong>
          </p>
        ) : null}
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Failure: no policy signed, no Rekor entry. Check the
              custom policy URL and resubmit.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="machine-row">
          Machine: {machineId ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="policy-row">
          Policy source: {policySource ?? "—"}
        </p>
        {watchedHostCount !== null && watchedHostCount !== undefined ? (
          <p style={StatLineStyle} data-testid="host-count-row">
            Watched hosts: {watchedHostCount}
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="notarize-row">
          Auto-notarize non-green cassettes:{" "}
          {notarize === true ? "yes" : notarize === false ? "no" : "—"}
        </p>
        {configuredAt ? (
          <p style={StatLineStyle} data-testid="configured-at">
            Configured at: {configuredAt}
          </p>
        ) : null}
      </section>

      {isConfigured && installSnippet ? (
        <section>
          <h2 style={SectionHeadingStyle}>Install snippet</h2>
          <pre
            style={{
              padding: 12,
              background: "rgba(255,255,255,0.04)",
              borderRadius: 4,
              overflow: "auto",
            }}
            data-testid="install-snippet"
          >
            <code>{installSnippet}</code>
          </pre>
          <p>
            <button
              type="button"
              onClick={onCopySnippet}
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
              data-testid="copy-snippet"
            >
              {snippetCopyState === "copied"
                ? "Copied!"
                : snippetCopyState === "failed"
                  ? "Copy failed"
                  : "Copy install snippet"}
            </button>
          </p>
          <p style={StatLineStyle}>
            Ingestion endpoint:{" "}
            {ingestionEndpoint ? <code>{ingestionEndpoint}</code> : "—"}
          </p>
        </section>
      ) : null}

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="predicate-uri">
          Predicate: <code>{TRIPWIRE_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isConfigured && policyUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">Rekor UUID: <code>{rekorUuid}</code></p>
            <p>
              Verify the policy:{" "}
              <code>cosign verify-blob {policyUrl} --key /.well-known/pluck-keys.json</code>
            </p>
          </>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          {timelineUrl ? (
            <a href={timelineUrl} style={NextActionStyle} data-testid="timeline-link">
              View per-machine timeline →
            </a>
          ) : null}
          <a href="/bureau/tripwire/run" style={NextActionStyle} data-testid="next-run">
            Configure another machine
          </a>
          <a href="/bureau/tripwire" style={NextActionStyle} data-testid="next-program">
            Back to TRIPWIRE
          </a>
          <a href="/bureau/rotate/run" style={NextActionStyle} data-testid="rotate-link">
            Rotate this deployment
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Configuration receipts are signed with the Pluck-fleet hosted
          key (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
          The runtime interceptor itself uses an operator-held key for
          per-cassette signing — Studio doesn't see request bodies.
        </p>
      </section>
    </>
  );
}
