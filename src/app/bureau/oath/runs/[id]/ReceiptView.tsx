"use client";

// ---------------------------------------------------------------------------
// OATH ReceiptView — Directive-backed live verification UI
// ---------------------------------------------------------------------------
//
// Sibling to DRAGNET's ReceiptView. Different output shape (verdict +
// claims list vs. classification counts + dot color), same architectural
// scaffolding (per-id Directive system, useFact + useDerived, share/copy/
// next-actions block, OG card route at sibling opengraph-image.tsx).
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

import { isPhraseId } from "../../../../../lib/phrase-id";
import { oathRunReceiptModule } from "../../../../../lib/oath/run-receipt-module";

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
    const sys = createSystem({ module: oathRunReceiptModule });
    sys.start();
    sys.facts.id = id;
    return sys;
  }, [id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const vendorDomain = useFact(system, "vendorDomain");
  const expectedOrigin = useFact(system, "expectedOrigin");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const claimsCount = useFact(system, "claimsCount");
  const claims = useFact(system, "claims");
  const expiresAt = useFact(system, "expiresAt");
  const receiptUrl = useFact(system, "receiptUrl");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isVerified = useDerived(system, "isVerified");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");

  useEffect(() => {
    return () => {
      system.destroy();
    };
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
        <h1 className="bureau-hero-title">OATH verification</h1>
        <p className="bureau-hero-tagline">
          <span
            style={StatusBadgeStyle}
            data-testid="run-status"
            aria-live="polite"
          >
            {status ?? "verification pending"}
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
            {copyState === "copied"
              ? "Copied!"
              : copyState === "failed"
                ? "Copy failed — select URL bar"
                : "Copy receipt URL"}
          </button>
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
            Stub verify — <code>pluck-api /v1/oath/verify</code> isn't
            yet wired, so this URL stays here until the runner lands.
            Bookmark it; the URL is permanent and will fill in
            automatically.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verdict</h2>
        <p style={StatLineStyle} data-testid="verdict">
          Verdict: {verdict ?? "—"}{" "}
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
                    : "#a3201d",
              marginLeft: 8,
            }}
          />
        </p>
        {verdictDetail ? (
          <p style={StatLineStyle}>{verdictDetail}</p>
        ) : null}
        <p style={StatLineStyle} data-testid="vendor-domain">
          Vendor: {vendorDomain ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="expected-origin">
          Expected origin: {expectedOrigin ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="claims-count">
          Claims: {claimsCount ?? "—"}
        </p>
        {expiresAt ? (
          <p style={StatLineStyle} data-testid="expires-at">
            Expires: {expiresAt}
          </p>
        ) : null}
        <p style={{ ...StatLineStyle, marginTop: 12, fontSize: 11 }}>
          <em>
            OATH verdicts: <code>verified</code> (DSSE valid + Origin
            matches + within TTL) · <code>signature-failed</code> ·{" "}
            <code>origin-mismatch</code> · <code>expired</code>{" "}
            (sealed-claim semantics) · <code>not-found</code> ·{" "}
            <code>fetch-failed</code>.
          </em>
        </p>
      </section>

      {claims && claims.length > 0 ? (
        <section>
          <h2 style={SectionHeadingStyle}>Claims</h2>
          <ul style={{ lineHeight: 1.7 }}>
            {claims.map((c) => (
              <li key={c.id} data-testid={`claim-${c.id}`}>
                <strong>{c.id}</strong> — {c.text}{" "}
                <em style={{ color: "var(--bureau-fg-dim)" }}>
                  (expires {c.expiresAt})
                </em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        {isVerified && receiptUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">
              Rekor UUID: <code>{rekorUuid}</code>
            </p>
            <p>
              Verify offline:{" "}
              <code>
                pluck bureau oath verify {receiptUrl} --expected-origin{" "}
                {expectedOrigin}
              </code>
            </p>
          </>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>DSSE envelope</strong> — verify offline with{" "}
              <code>pluck bureau oath verify ./oath.intoto.jsonl</code>.
            </li>
            <li>
              <strong>Rekor entry</strong> — public transparency-log
              anchor; cross-checks the served Origin against the body's
              <code> vendor</code> field.
            </li>
            <li>
              <strong>Signer fingerprint</strong> — Ed25519 SPKI
              fingerprint of the vendor's signing key.{" "}
              {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
            </li>
          </ul>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a
            href="/bureau/oath/run"
            style={NextActionStyle}
            data-testid="next-run"
          >
            Verify another oath
          </a>
          <a
            href="/bureau/oath"
            style={NextActionStyle}
            data-testid="next-program"
          >
            Back to OATH
          </a>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(
              `${id} — OATH verification`,
            )}&url=${encodeURIComponent(
              typeof window !== "undefined" ? window.location.href : "",
            )}`}
            style={NextActionStyle}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="next-share-x"
          >
            Share on X
          </a>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Receipt envelopes are signed with the Pluck-fleet hosted key
          (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ). The vendor's oath itself is signed with the vendor's own
          Ed25519 key — fingerprint shown above on success.{" "}
          {isFailure && verdict ? (
            <em>
              On{" "}
              <code data-testid="failure-verdict">{verdict}</code>{" "}
              verdicts, no Rekor entry is emitted.
            </em>
          ) : null}
        </p>
      </section>
    </>
  );
}
