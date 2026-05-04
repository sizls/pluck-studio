"use client";

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  CANARY_DOCUMENT_PREDICATE_URI,
  MEMORIZATION_VERDICT_PREDICATE_URI,
  formatCassetteHash,
  moleRunReceiptModule,
} from "../../../../../lib/mole/run-receipt-module";
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
  const system = useDirectiveRef({ module: moleRunReceiptModule });

  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const canaryId = useFact(system, "canaryId");
  const canarySha256 = useFact(system, "canarySha256");
  const canaryByteLength = useFact(system, "canaryByteLength");
  const fingerprintPhrases = useFact(system, "fingerprintPhrases");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const manifestUrl = useFact(system, "manifestUrl");
  const rekorUuid = useFact(system, "rekorUuid");
  const sealedAt = useFact(system, "sealedAt");

  const isPending = useDerived(system, "isPending");
  const isSealed = useDerived(system, "isSealed");
  const isReWitnessed = useDerived(system, "isReWitnessed");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");

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

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">MOLE canary seal</h1>
        <p className="bureau-hero-tagline">
          <span style={StatusBadgeStyle} data-testid="run-status" aria-live="polite">
            {status ?? "seal pending"}
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
            Stub seal — <code>pluck-api /v1/mole/seal</code> isn't yet wired.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verdict</h2>
        <p style={StatLineStyle} data-testid="verdict">
          Seal: {verdict ?? "—"}{" "}
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                verdictColor === "green"
                  ? "#1f7a3a"
                  : verdictColor === "red"
                    ? "#a3201d"
                    : "#888273",
              marginLeft: 8,
            }}
          />
        </p>
        {verdictDetail ? <p style={StatLineStyle}>{verdictDetail}</p> : null}
        {isSealed && !isReWitnessed ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="sealed-callout">
              Sealed. Rekor timestamp predates any probe-run. Operator
              holds the canary body locally.
            </strong>
          </p>
        ) : null}
        {isReWitnessed ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="re-witnessed-callout">
              Re-witnessed. This canary&apos;s seal predates probe — the
              original Rekor timestamp is preserved. Signing identity has
              been re-attested via a{" "}
              <a href="/bureau/rotate">ROTATE ReWitnessReport</a> after a
              key rotation. Trust-chain intact; downstream verifiers honor
              this canary identically to a fresh seal.
            </strong>
          </p>
        ) : null}
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Rejected: no seal published. Fix the named cause and resubmit.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="canary-id-row">
          Canary ID: {canaryId ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="canary-sha-row">
          Canary sha256:{" "}
          {canarySha256 ? <code>{formatCassetteHash(canarySha256)}</code> : "—"}
        </p>
        <p style={StatLineStyle} data-testid="canary-bytes-row">
          Canary length:{" "}
          {canaryByteLength !== null && canaryByteLength !== undefined
            ? `${canaryByteLength.toLocaleString()} bytes`
            : "—"}
        </p>
        {sealedAt ? (
          <p style={StatLineStyle} data-testid="sealed-at">
            Sealed at: {sealedAt}
          </p>
        ) : null}
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            The canary body itself is intentionally NOT on the receipt
            — only the sha256 + the fingerprint phrases below. Operator
            holds the raw text locally for the journalist conversation.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Fingerprint phrases</h2>
        {fingerprintPhrases && fingerprintPhrases.length > 0 ? (
          <ul style={{ lineHeight: 1.7 }}>
            {fingerprintPhrases.map((p, i) => (
              <li key={i} data-testid={`fingerprint-${i}`}>
                <code>{p}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (Awaiting seal — phrases appear once the runner anchors.)
          </p>
        )}
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            These phrases enter the public log. If a model regurgitates
            any of them verbatim, MOLE's separate{" "}
            <code>cite</code> step emits a <code>MemorizationVerdict/v1</code>{" "}
            with the prompt + response + Rekor cross-references.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="canary-predicate">
          Canary predicate: <code>{CANARY_DOCUMENT_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="verdict-predicate">
          (Per-probe verdict predicate, used by the separate cite step:{" "}
          <code>{MEMORIZATION_VERDICT_PREDICATE_URI}</code>)
        </p>
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isSealed && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">Rekor UUID: <code>{rekorUuid}</code></p>
            {manifestUrl ? (
              <p data-testid="manifest-url">
                Manifest envelope: <a href={manifestUrl}><code>{manifestUrl}</code></a>
              </p>
            ) : null}
            <p>
              Verify the seal:{" "}
              <code>pluck bureau mole verify {rekorUuid}</code>
            </p>
            <p>
              Run probes against this canary (separate CLI step):{" "}
              <code>pluck bureau mole run ./mole-pack.json --target openai/gpt-4o</code>
            </p>
          </>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a href="/bureau/mole/run" style={NextActionStyle} data-testid="next-run">
            Seal another canary
          </a>
          <a href="/bureau/mole" style={NextActionStyle} data-testid="next-program">
            Back to MOLE
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Seal manifests are signed by the Pluck-fleet hosted key
          (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
          Probe-runs against the canary use an operator-held key for
          per-probe signing — separate from the seal.
        </p>
      </section>
    </>
  );
}
