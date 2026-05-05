"use client";

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { CalendarStrip } from "../../../../../components/bureau-ui/CalendarStrip";
import {
  NUCLEI_PACK_ENTRY_PREDICATE_URI,
  nucleiRunReceiptModule,
} from "../../../../../lib/nuclei/run-receipt-module";
import { V1RunStatusBanner } from "../../../../../components/bureau-ui/V1RunStatusBanner.js";
import { PhraseSigil } from "../../../../../components/bureau-ui/PhraseSigil.js";
import { isPhraseId } from "../../../../../lib/phrase-id";
import { SbomAiSourceArtifact } from "./SbomAiSourceArtifact";

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
  const system = useDirectiveRef({ module: nucleiRunReceiptModule });

  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  // /v1/runs migration probe — once a runId is in the unified store,
  // we tag the receipt as "via /v1/runs" so it's obvious which path
  // the page used. Old phrase IDs (created before the migration, or
  // after store TTL eviction) fall back to the pre-/v1 stub render —
  // same UI, no indicator. Mirrors the DRAGNET probe.
  //
  // Gated behind dev builds OR an explicit `?debug=1` query param to
  // avoid burning a network round-trip on every receipt render in
  // production.
  const [viaV1, setViaV1] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      const hasDebug =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("debug") === "1";
      if (!hasDebug) {
        return;
      }
    }
    let cancelled = false;
    fetch(`/api/v1/runs/${encodeURIComponent(id)}`, {
      headers: { "content-type": "application/json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((record) => {
        if (cancelled || record === null) {
          return;
        }
        setViaV1(true);
      })
      .catch(() => {
        // Network or 404 — fall back to the legacy stub. No-op.
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const author = useFact(system, "author");
  const packName = useFact(system, "packName");
  const sbomRekorUuid = useFact(system, "sbomRekorUuid");
  const vendorScope = useFact(system, "vendorScope");
  const license = useFact(system, "license");
  const recommendedInterval = useFact(system, "recommendedInterval");
  const trustTier = useFact(system, "trustTier");
  const packEntryUrl = useFact(system, "packEntryUrl");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const rekorUuid = useFact(system, "rekorUuid");
  const publishedAt = useFact(system, "publishedAt");

  const isPending = useDerived(system, "isPending");
  const isPublished = useDerived(system, "isPublished");
  const isFullyVerified = useDerived(system, "isFullyVerified");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");
  const packDossierUrl = useDerived(system, "packDossierUrl");

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
      <V1RunStatusBanner id={id} />
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">NUCLEI registry entry</h1>
        <p className="bureau-hero-tagline">
          <span style={StatusBadgeStyle} data-testid="run-status" aria-live="polite">
            {status ?? "publish pending"}
          </span>
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {isPhrase ? (
            <PhraseSigil phraseId={id} programAccent="#9b59b6" size={96} />
          ) : null}
          <div style={{ minWidth: 0 }}>
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
          </div>
        </div>
        {isPending ? (
          <p style={{ marginTop: 16, fontStyle: "italic", color: "var(--bureau-fg-dim)" }} data-testid="pending-banner">
            Stub publish — <code>pluck-api /v1/nuclei/publish</code> isn't yet wired.
          </p>
        ) : null}

        {viaV1 ? (
          <p
            style={{
              marginTop: 8,
              fontFamily: "var(--bureau-mono)",
              fontSize: 11,
              color: "var(--bureau-fg-dim)",
              opacity: 0.7,
            }}
            data-testid="via-v1-indicator"
          >
            via <code>/v1/runs</code>
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
        {isFullyVerified ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="published-verified-callout">
              Published (verified) — consumers honor. SBOM-AI
              cross-reference confirmed; subscribers can pin to this entry.
            </strong>
          </p>
        ) : null}
        {isPublished && !isFullyVerified ? (
          <p style={{ ...StatLineStyle, color: "#a78a1f" }}>
            <strong data-testid="published-ingested-callout">
              Registry-fenced — entry exists in NUCLEI but consumers
              refuse to honor without an SBOM-AI cross-reference.
              Downstream verifiers will not run anything pinned to it.
            </strong>
            <br />
            <small
              style={{
                fontFamily: "var(--bureau-mono)",
                color: "var(--bureau-fg-dim)",
                fontStyle: "italic",
              }}
              data-testid="published-ingested-verdict-tag"
              data-verdict="published-ingested-only"
            >
              Status: Registry-fenced (no SBOM-AI cross-reference).
              Verdict tag:{" "}
              <code>published-ingested-only</code>
            </small>
          </p>
        ) : null}
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Rejected: not registered. Fix the named cause and resubmit.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="author-row">
          Author: {author ?? "—"}
        </p>
        <p
          style={{
            fontFamily: "var(--bureau-mono)",
            fontSize: 12,
            color: "var(--bureau-fg-dim)",
            marginTop: 2,
            fontStyle: "italic",
          }}
          data-testid="author-handle-note"
        >
          <small>
            Author handle is operator-asserted; not yet bound to
            authenticated identity. Pre-pluck-api stub.
          </small>
        </p>
        <p style={StatLineStyle} data-testid="pack-row">
          Pack: {packName ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="sbom-rekor-row">
          SBOM-AI Rekor UUID:{" "}
          {sbomRekorUuid ? <code>{sbomRekorUuid}</code> : "—"}
        </p>
        <p style={StatLineStyle} data-testid="trust-tier-row">
          Trust tier: {trustTier ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="license-row">
          License: {license ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="interval-row">
          Recommended interval: {recommendedInterval ?? "—"}
        </p>
        <CalendarStrip cron={recommendedInterval} count={7} />
        {vendorScope && vendorScope.length > 0 ? (
          <p style={StatLineStyle} data-testid="vendor-scope-row">
            Vendor scope ({vendorScope.length}):{" "}
            {vendorScope.map((p, i) => (
              <span key={p}>
                <code>{p}</code>
                {i < vendorScope.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        ) : null}
        {publishedAt ? (
          <p style={StatLineStyle} data-testid="published-at">
            Published at: {publishedAt}
          </p>
        ) : null}
      </section>

      <SbomAiSourceArtifact sbomRekorUuid={sbomRekorUuid ?? null} />

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="predicate-uri">
          Predicate: <code>{NUCLEI_PACK_ENTRY_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isPublished && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">Rekor UUID: <code>{rekorUuid}</code></p>
            {packEntryUrl ? (
              <p data-testid="pack-entry-url">
                Entry envelope: <a href={packEntryUrl}><code>{packEntryUrl}</code></a>
              </p>
            ) : null}
            <p>
              Verify offline:{" "}
              <code>pluck bureau nuclei verify {rekorUuid}</code>
            </p>
          </>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          {packDossierUrl ? (
            <a href={packDossierUrl} style={NextActionStyle} data-testid="dossier-link">
              View pack dossier →
            </a>
          ) : null}
          <a href="/bureau/nuclei/run" style={NextActionStyle} data-testid="next-run">
            Publish another pack
          </a>
          <a href="/bureau/nuclei/leaderboard" style={NextActionStyle} data-testid="next-leaderboard">
            Leaderboard
          </a>
          <a href="/bureau/nuclei" style={NextActionStyle} data-testid="next-program">
            Back to NUCLEI
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Registry entries are signed by the Pluck-fleet hosted key
          (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
          The probe-pack body itself is signed by your own key — Studio
          doesn't see it; it lives at the URL you registered with SBOM-AI.
        </p>
      </section>
    </>
  );
}
