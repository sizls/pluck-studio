"use client";

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  BOUNTY_SUBMISSION_PREDICATE_URI,
  EVIDENCE_PACKET_PREDICATE_URI,
  bountyRunReceiptModule,
} from "../../../../../lib/bounty/run-receipt-module";
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
  // was unsafe because useMemo is NOT a guaranteed cache — Strict Mode
  // could leave a destroyed system cached for the next render.
  const system = useDirectiveRef({ module: bountyRunReceiptModule });

  // Sync id reactively; system itself is stable across id changes.
  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  // /v1/runs migration probe — once a runId is in the unified store,
  // tag the receipt as "via /v1/runs" so it's obvious which path the
  // page used. Gated behind dev builds OR an explicit `?debug=1` query
  // param to avoid burning a network round-trip on every receipt
  // render in production. The probe response carries only the run
  // record; auth tokens never appear in /v1/runs.
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
  const target = useFact(system, "target");
  const program = useFact(system, "program");
  const vendor = useFact(system, "vendor");
  const model = useFact(system, "model");
  const sourceRekorUuid = useFact(system, "sourceRekorUuid");
  const platformSubmissionId = useFact(system, "platformSubmissionId");
  const bountyAmount = useFact(system, "bountyAmount");
  const submittedAt = useFact(system, "submittedAt");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const packetUrl = useFact(system, "packetUrl");
  const submissionUrl = useFact(system, "submissionUrl");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isFiled = useDerived(system, "isFiled");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");
  const programDossierUrl = useDerived(system, "programDossierUrl");

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
        <h1 className="bureau-hero-title">BOUNTY filing</h1>
        <p className="bureau-hero-tagline">
          <span style={StatusBadgeStyle} data-testid="run-status" aria-live="polite">
            {status ?? "filing pending"}
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
            Stub file — <code>pluck-api /v1/bounty/file</code> isn't yet wired, so this URL stays here until the runner lands.
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
          Filing: {verdict ?? "—"}{" "}
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
        {isFiled ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="filed-callout">
              Filed. Platform submission accepted; Rekor entry emitted.
            </strong>
          </p>
        ) : null}
        {verdict === "rate-limited" ? (
          <p style={{ ...StatLineStyle, color: "#a78a1f" }}>
            <strong data-testid="rate-limited-callout">
              Rate-limited (transient). HackerOne 600/hr, Bugcrowd 300/hr — try again after the window.
            </strong>
          </p>
        ) : null}
        {isFailure && verdict !== "rate-limited" && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Terminal failure: no platform record, no Rekor entry.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="target-program">
          Target / program: {target ?? "—"} / {program ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="vendor-model">
          Affected vendor / model: {vendor ?? "—"} / {model ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="source-rekor">
          Source evidence Rekor UUID:{" "}
          {sourceRekorUuid ? <code>{sourceRekorUuid}</code> : "—"}
        </p>
        {platformSubmissionId ? (
          <p style={StatLineStyle} data-testid="platform-submission-id">
            Platform submission ID: <code>{platformSubmissionId}</code>
          </p>
        ) : null}
        {bountyAmount !== null && bountyAmount !== undefined ? (
          <p style={StatLineStyle} data-testid="bounty-amount">
            Bounty awarded: <strong>${bountyAmount.toLocaleString()}</strong>
          </p>
        ) : null}
        {submittedAt ? (
          <p style={StatLineStyle} data-testid="submitted-at">
            Submitted at: {submittedAt}
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="evidence-predicate">
          EvidencePacket predicate: <code>{EVIDENCE_PACKET_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="submission-predicate">
          BountySubmission predicate:{" "}
          <code>{BOUNTY_SUBMISSION_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isFiled && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">Rekor UUID: <code>{rekorUuid}</code></p>
            {packetUrl ? (
              <p data-testid="packet-url">
                EvidencePacket: <a href={packetUrl}><code>{packetUrl}</code></a>
              </p>
            ) : null}
            {submissionUrl ? (
              <p data-testid="submission-url">
                BountySubmission: <a href={submissionUrl}><code>{submissionUrl}</code></a>
              </p>
            ) : null}
          </>
        ) : null}
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            No platform auth token appears here or in the EvidencePacket
            body. Studio reads operator-stored credentials at dispatch
            time; the token never crosses the form, the receipt, or the
            adapter's logged output.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a href="/bureau/bounty/run" style={NextActionStyle} data-testid="next-run">
            File another bounty
          </a>
          <a href="/bureau/bounty" style={NextActionStyle} data-testid="next-program">
            Back to BOUNTY
          </a>
          {programDossierUrl ? (
            <a href={programDossierUrl} style={NextActionStyle} data-testid="dossier-link">
              View FINGERPRINT dossier for {vendor}/{model} →
            </a>
          ) : null}
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Filing receipts are signed with the Pluck-fleet hosted key
          (<a href="/.well-known/pluck-keys.json"><code>/.well-known/pluck-keys.json</code></a>).
        </p>
      </section>
    </>
  );
}
