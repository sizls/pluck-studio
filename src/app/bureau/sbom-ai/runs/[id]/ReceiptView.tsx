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
  PREDICATE_URI_BY_KIND,
  formatCassetteHash,
  sbomAiRunReceiptModule,
} from "../../../../../lib/sbom-ai/run-receipt-module";

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
    const sys = createSystem({ module: sbomAiRunReceiptModule });
    sys.start();
    sys.facts.id = id;
    return sys;
  }, [id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const artifactUrl = useFact(system, "artifactUrl");
  const artifactKind = useFact(system, "artifactKind");
  const computedSha256 = useFact(system, "computedSha256");
  const expectedSha256 = useFact(system, "expectedSha256");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const attestationUrl = useFact(system, "attestationUrl");
  const rekorUuid = useFact(system, "rekorUuid");
  const publishedAt = useFact(system, "publishedAt");

  const isPending = useDerived(system, "isPending");
  const isPublished = useDerived(system, "isPublished");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");
  const hashesMatch = useDerived(system, "hashesMatch");
  const lookupUrl = useDerived(system, "lookupUrl");

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

  const predicateUri = artifactKind ? PREDICATE_URI_BY_KIND[artifactKind] : null;

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">SBOM-AI provenance</h1>
        <p className="bureau-hero-tagline">
          <span style={StatusBadgeStyle} data-testid="run-status" aria-live="polite">
            {status ?? "publish pending"}
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
            Stub publish — <code>pluck-api /v1/sbom-ai/publish</code> isn't yet wired.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verdict</h2>
        <p style={StatLineStyle} data-testid="verdict">
          Publish: {verdict ?? "—"}{" "}
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
        {isPublished ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="published-callout">
              Published. Attestation anchored; consumers can verify
              before running this artifact.
            </strong>
          </p>
        ) : null}
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Rejected: no attestation, no Rekor entry.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="artifact-kind">
          Kind: {artifactKind ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="artifact-url">
          Source URL: {artifactUrl ? <code>{artifactUrl}</code> : "—"}
        </p>
        {publishedAt ? (
          <p style={StatLineStyle} data-testid="published-at">
            Published at: {publishedAt}
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Digest</h2>
        <p style={StatLineStyle} data-testid="computed-sha256">
          Computed sha256:{" "}
          {computedSha256 ? <code>{formatCassetteHash(computedSha256)}</code> : "—"}
        </p>
        {expectedSha256 ? (
          <>
            <p style={StatLineStyle} data-testid="expected-sha256">
              Expected sha256: <code>{formatCassetteHash(expectedSha256)}</code>
            </p>
            <p style={{ ...StatLineStyle, color: hashesMatch ? "#7fbe7f" : "#ff8888" }} data-testid="hash-match">
              {hashesMatch ? "✓ matches expected" : "✗ does not match expected"}
            </p>
          </>
        ) : (
          <p style={{ ...StatLineStyle, fontSize: 11, fontStyle: "italic" }}>
            (No expected hash supplied — Studio's computed digest is
            authoritative.)
          </p>
        )}
        {lookupUrl ? (
          <p style={StatLineStyle} data-testid="lookup-url">
            Canonical artifact URL: <a href={lookupUrl}><code>{lookupUrl}</code></a>
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        {predicateUri ? (
          <p style={StatLineStyle} data-testid="predicate-uri">
            Predicate: <code>{predicateUri}</code>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isPublished && attestationUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">Rekor UUID: <code>{rekorUuid}</code></p>
            <p>
              Verify offline:{" "}
              <code>pluck bureau sbom-ai verify {rekorUuid}</code>
            </p>
            <p data-testid="attestation-url">
              Attestation: <a href={attestationUrl}><code>{attestationUrl}</code></a>
            </p>
          </>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a href="/bureau/sbom-ai/run" style={NextActionStyle} data-testid="next-run">
            Publish another artifact
          </a>
          <a href="/bureau/sbom-ai" style={NextActionStyle} data-testid="next-program">
            Back to SBOM-AI
          </a>
          {lookupUrl ? (
            <a href={lookupUrl} style={NextActionStyle} data-testid="lookup-cta">
              View artifact entry →
            </a>
          ) : null}
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Attestations are signed with the Pluck-fleet hosted key
          (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
          Each artifact kind has its own predicate URI, so consumers
          can verify with <code>cosign verify --type</code> against
          the exact wire format.
        </p>
      </section>
    </>
  );
}
