"use client";

import { createSystem } from "@directive-run/core";
import { useDerived, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { isPhraseId } from "../../../../../lib/phrase-id";
import {
  KEY_REVOCATION_PREDICATE_URI,
  RE_WITNESS_REPORT_PREDICATE_URI,
  rotateRunReceiptModule,
} from "../../../../../lib/rotate/run-receipt-module";

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
  const system = useMemo(() => {
    const sys = createSystem({ module: rotateRunReceiptModule });
    sys.start();
    sys.facts.id = id;
    return sys;
  }, [id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const oldKeyFingerprint = useFact(system, "oldKeyFingerprint");
  const newKeyFingerprint = useFact(system, "newKeyFingerprint");
  const reason = useFact(system, "reason");
  const operatorNote = useFact(system, "operatorNote");
  const reWitnessedCassetteCount = useFact(system, "reWitnessedCassetteCount");
  const revocationUrl = useFact(system, "revocationUrl");
  const reWitnessReportUrl = useFact(system, "reWitnessReportUrl");
  const rekorUuid = useFact(system, "rekorUuid");
  const rotatedAt = useFact(system, "rotatedAt");

  const isPending = useDerived(system, "isPending");
  const isRotated = useDerived(system, "isRotated");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");

  useEffect(() => {
    return () => system.destroy();
  }, [system]);

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
        <h1 className="bureau-hero-title">ROTATE rotation</h1>
        <p className="bureau-hero-tagline">
          <span style={StatusBadgeStyle} data-testid="run-status" aria-live="polite">
            {status ?? "rotation pending"}
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
            Stub rotate — <code>pluck-api /v1/rotate/revoke</code> isn't yet wired.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verdict</h2>
        <p style={StatLineStyle} data-testid="verdict">
          Rotation: {verdict ?? "—"}{" "}
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
        {isRotated ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="rotated-callout">
              Rotated. KeyRevocation + ReWitnessReport anchored;{" "}
              {reWitnessedCassetteCount ?? 0} prior cassette
              {reWitnessedCassetteCount === 1 ? "" : "s"} annotated
              with the compromise window.
            </strong>
          </p>
        ) : null}
        {verdict === "old-key-already-revoked" ? (
          <p style={{ ...StatLineStyle, color: "#a78a1f" }}>
            <strong data-testid="already-revoked-callout">
              Idempotent: this key was already revoked in a prior
              rotation. No new entries emitted; existing revocation
              still authoritative.
            </strong>
          </p>
        ) : null}
        {isFailure && verdict !== "old-key-already-revoked" && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Terminal failure: no revocation, no Rekor entry. Old key
              still trusted by verifiers — fix and resubmit.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="reason-row">
          Reason: {reason ?? "—"}
        </p>
        {operatorNote ? (
          <p style={StatLineStyle} data-testid="operator-note">
            Operator note: <em>{operatorNote}</em>
          </p>
        ) : null}
        {rotatedAt ? (
          <p style={StatLineStyle} data-testid="rotated-at">
            Rotated at: {rotatedAt}
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Keys</h2>
        <p style={StatLineStyle} data-testid="old-key-row">
          Old (revoked) SPKI:{" "}
          {oldKeyFingerprint ? <code>{oldKeyFingerprint}</code> : "—"}
        </p>
        <p style={StatLineStyle} data-testid="new-key-row">
          New (active) SPKI:{" "}
          {newKeyFingerprint ? <code>{newKeyFingerprint}</code> : "—"}
        </p>
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            Trust invalidation, NOT crypto-shred — the old key's prior
            Rekor entries are not removed (impossible against a public
            Merkle tree). Verifiers MUST consult this rotation before
            trusting any historical signature from the old SPKI.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="revocation-predicate">
          Revocation predicate: <code>{KEY_REVOCATION_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="rewitness-predicate">
          Re-witness predicate: <code>{RE_WITNESS_REPORT_PREDICATE_URI}</code>
        </p>
        {isRotated && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">Rekor UUID: <code>{rekorUuid}</code></p>
            <p>
              Verify the rotation:{" "}
              <code>pluck bureau rotate verify-rotation {rekorUuid}</code>
            </p>
            {revocationUrl ? (
              <p data-testid="revocation-url">
                KeyRevocation envelope: <a href={revocationUrl}><code>{revocationUrl}</code></a>
              </p>
            ) : null}
            {reWitnessReportUrl ? (
              <p data-testid="rewitness-url">
                ReWitnessReport envelope: <a href={reWitnessReportUrl}><code>{reWitnessReportUrl}</code></a>
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a href="/bureau/rotate/run" style={NextActionStyle} data-testid="next-run">
            Rotate another key
          </a>
          <a href="/bureau/rotate" style={NextActionStyle} data-testid="next-program">
            Back to ROTATE
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          The rotation is signed by the operator's two keys: KeyRevocation
          by the OLD key (proves ownership of the compromised key);
          ReWitnessReport by the NEW key (annotates prior cassettes
          with the compromise window). Studio's hosted signing key
          plays no role — this is the operator's own crypto-graphic
          chain.
        </p>
      </section>
    </>
  );
}
