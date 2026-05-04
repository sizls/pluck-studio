"use client";

// ---------------------------------------------------------------------------
// CUSTODY ReceiptView — Directive-backed FRE 902(13) verdict UI
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

import {
  CUSTODY_PREDICATE_URI,
  custodyRunReceiptModule,
  formatCassetteHash,
} from "../../../../../lib/custody/run-receipt-module";
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

const CheckRowStyle = (passed: boolean) => ({
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  marginTop: 6,
  color: passed ? "var(--bureau-fg)" : "#ff8888",
});

interface ReceiptViewProps {
  id: string;
}

export function ReceiptView({ id }: ReceiptViewProps): ReactNode {
  const system = useMemo(() => {
    const sys = createSystem({ module: custodyRunReceiptModule });
    sys.start();
    sys.facts.id = id;
    return sys;
  }, [id]);

  const status = useFact(system, "status");
  const verdict = useFact(system, "verdict");
  const verdictDetail = useFact(system, "verdictDetail");
  const bundleUrl = useFact(system, "bundleUrl");
  const bundleHash = useFact(system, "bundleHash");
  const vendor = useFact(system, "vendor");
  const expectedVendor = useFact(system, "expectedVendor");
  const capturedAt = useFact(system, "capturedAt");
  const checks = useFact(system, "checks");
  const webauthn = useFact(system, "webauthn");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const receiptUrl = useFact(system, "receiptUrl");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isCompliant = useDerived(system, "isCompliant");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");
  const passedCheckCount = useDerived(system, "passedCheckCount");
  const failedCheckCount = useDerived(system, "failedCheckCount");

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
        <h1 className="bureau-hero-title">CUSTODY verification</h1>
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
            Stub verify — <code>pluck-api /v1/custody/verify</code>{" "}
            isn't yet wired, so this URL stays here until the runner
            lands. Bookmark it; the URL is permanent and will fill in
            automatically.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verdict</h2>
        <p style={StatLineStyle} data-testid="verdict">
          FRE 902(13): {verdict ?? "—"}{" "}
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
        {verdictDetail ? (
          <p style={StatLineStyle}>{verdictDetail}</p>
        ) : null}
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Failure: bundle is NOT FRE 902(13) compliant. No Rekor
              entry will be emitted; per-check breakdown below.
            </strong>
          </p>
        ) : null}
        {isCompliant ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="compliant-callout">
              Compliant. The bundle survives Daubert reliability and
              FRE 902(13) self-authentication.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="bundle-url">
          Bundle URL: {bundleUrl ? <code>{bundleUrl}</code> : "—"}
        </p>
        <p style={StatLineStyle} data-testid="bundle-hash">
          Bundle hash:{" "}
          {bundleHash ? <code>{formatCassetteHash(bundleHash)}</code> : "—"}
        </p>
        <p style={StatLineStyle} data-testid="vendor-row">
          Vendor (declared / expected): {vendor ?? "—"} /{" "}
          {expectedVendor ?? "(any)"}
        </p>
        {capturedAt ? (
          <p style={StatLineStyle} data-testid="captured-at">
            Captured at: {capturedAt}
          </p>
        ) : null}
        <p style={{ ...StatLineStyle, marginTop: 12, fontSize: 11 }}>
          <em>
            Verdicts: <code>compliant</code>{" "}
            <span style={{ color: "#1f7a3a" }}>green</span> (passes all
            FRE 902(13) checks) · <code>webauthn-missing</code> /{" "}
            <code>signature-invalid</code> /{" "}
            <code>dom-hash-mismatch</code> / <code>cassette-mismatch</code>{" "}
            / <code>bundle-malformed</code> / <code>not-found</code> /{" "}
            <code>fetch-failed</code>{" "}
            <span style={{ color: "#a3201d" }}>red</span>. CUSTODY is
            binary — admissibility either holds or it doesn't.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Per-check breakdown</h2>
        {checks && checks.length > 0 ? (
          <>
            <p style={StatLineStyle}>
              <strong data-testid="check-summary">
                {passedCheckCount} passed / {failedCheckCount} failed
              </strong>
            </p>
            <ul style={{ listStyle: "none", padding: 0 }}>
              {checks.map((c) => (
                <li
                  key={c.id}
                  style={CheckRowStyle(c.passed)}
                  data-testid={`check-${c.id}`}
                >
                  {c.passed ? "✓" : "✗"} <strong>{c.label}</strong>
                  {c.detail ? (
                    <span
                      style={{
                        marginLeft: 8,
                        color: "var(--bureau-fg-dim)",
                      }}
                    >
                      — {c.detail}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (Awaiting verification — the per-check breakdown
            (signature, DOM-hash, cassettes, WebAuthn, schema, ts
            monotonic, envelope TTL) appears here once the runner
            anchors the receipt.)
          </p>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>WebAuthn (the keystone)</h2>
        {webauthn ? (
          <>
            <p style={StatLineStyle} data-testid="webauthn-aaguid">
              AAGUID: <code>{webauthn.aaguid}</code>
            </p>
            <p style={StatLineStyle} data-testid="webauthn-authenticator">
              Authenticator: {webauthn.authenticatorName ?? "(unknown)"}
            </p>
            <p style={StatLineStyle} data-testid="webauthn-trusted">
              FIDO MDS allowlist:{" "}
              {webauthn.trusted ? (
                <span style={{ color: "#7fbe7f" }}>trusted</span>
              ) : (
                <span style={{ color: "#ff8888" }}>not in allowlist</span>
              )}
            </p>
          </>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (WebAuthn attestation summary appears here once verification
            completes. Disk-only signing keys fail this check —
            <code>fre902Compliant: false</code>.)
          </p>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="predicate-uri">
          Predicate: <code>{CUSTODY_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isCompliant && receiptUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">
              Rekor UUID: <code>{rekorUuid}</code>
            </p>
            <p>
              Verify the bundle offline:{" "}
              <code>pluck bureau custody verify {bundleUrl}</code>
            </p>
          </>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>CustodyBundle envelope</strong> — verify offline
              with{" "}
              <code>pluck bureau custody verify ./bundle.intoto.jsonl</code>
              .
            </li>
            <li>
              <strong>Rekor entry</strong> — public transparency-log
              anchor; emitted only on <code>compliant</code> verdicts.
            </li>
          </ul>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a
            href="/bureau/custody/run"
            style={NextActionStyle}
            data-testid="next-run"
          >
            Verify another bundle
          </a>
          <a
            href="/bureau/custody/verify"
            style={NextActionStyle}
            data-testid="next-offline"
          >
            Drag-drop verify (offline)
          </a>
          <a
            href="/bureau/custody"
            style={NextActionStyle}
            data-testid="next-program"
          >
            Back to CUSTODY
          </a>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(
              `${id} — CUSTODY verification`,
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
          Verdict receipts are signed with the Pluck-fleet hosted key
          (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ). The bundle itself is signed by the operator's
          WebAuthn-bound passkey — fingerprint shown above on success.
        </p>
      </section>
    </>
  );
}
