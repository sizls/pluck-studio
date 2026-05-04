"use client";

// ---------------------------------------------------------------------------
// FINGERPRINT ReceiptView — Directive-backed live scan UI
// ---------------------------------------------------------------------------

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  CLASSIFICATION_THRESHOLDS,
  FINGERPRINT_DELTA_PREDICATE_URI,
  FINGERPRINT_PREDICATE_URI,
  fingerprintRunReceiptModule,
  formatCassetteHash,
} from "../../../../../lib/fingerprint/run-receipt-module";
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
  const system = useDirectiveRef({ module: fingerprintRunReceiptModule });

  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  const status = useFact(system, "status");
  const vendor = useFact(system, "vendor");
  const model = useFact(system, "model");
  const classification = useFact(system, "classification");
  const driftScore = useFact(system, "driftScore");
  const fingerprintHash = useFact(system, "fingerprintHash");
  const priorFingerprintHash = useFact(system, "priorFingerprintHash");
  const probeCount = useFact(system, "probeCount");
  const probeSetVersion = useFact(system, "probeSetVersion");
  const probes = useFact(system, "probes");
  const transport = useFact(system, "transport");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const cassetteUrl = useFact(system, "cassetteUrl");
  const deltaUrl = useFact(system, "deltaUrl");
  const rekorUuid = useFact(system, "rekorUuid");
  const scannedAt = useFact(system, "scannedAt");

  const isPending = useDerived(system, "isPending");
  const isAnchored = useDerived(system, "isAnchored");
  const isSwap = useDerived(system, "isSwap");
  const hasDelta = useDerived(system, "hasDelta");
  const classificationColor = useDerived(system, "classificationColor");
  const targetDossierUrl = useDerived(system, "targetDossierUrl");

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
        <h1 className="bureau-hero-title">FINGERPRINT scan</h1>
        <p className="bureau-hero-tagline">
          <span
            style={StatusBadgeStyle}
            data-testid="run-status"
            aria-live="polite"
          >
            {status ?? "scan pending"}
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
            Stub scan — <code>pluck-api /v1/fingerprint/scan</code> isn't
            yet wired, so this URL stays here until the runner lands.
            Bookmark it; the URL is permanent and will fill in
            automatically.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Classification</h2>
        <p style={StatLineStyle} data-testid="classification">
          Drift: {classification ?? "—"}{" "}
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background:
                classificationColor === "green"
                  ? "#1f7a3a"
                  : classificationColor === "amber"
                    ? "#a78a1f"
                    : classificationColor === "red"
                      ? "#a3201d"
                      : "#888273", // gray = no scan yet
              marginLeft: 8,
            }}
          />
          {driftScore !== null && driftScore !== undefined ? (
            <span style={{ marginLeft: 12 }}>
              (score: <code>{driftScore.toFixed(3)}</code>)
            </span>
          ) : null}
        </p>
        {isSwap ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="swap-callout">
              SWAP — vendor's model changed entirely. Public silent-swap
              alert fires when this scan anchors (RSS at{" "}
              <code>/bureau/fingerprint/swaps.rss</code> + @pluckbureau
              social bot).
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="vendor-model">
          Vendor / model: {vendor ?? "—"} / {model ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="probe-count">
          Probes run: {probeCount ?? "—"} (5-probe calibration set,
          version <code>{probeSetVersion ?? "—"}</code>)
        </p>
        <p style={StatLineStyle} data-testid="transport">
          Transport: {transport ? <code>{transport}</code> : "—"}
        </p>
        {scannedAt ? (
          <p style={StatLineStyle} data-testid="scanned-at">
            Scanned at: {scannedAt}
          </p>
        ) : null}
        <details style={{ marginTop: 12 }}>
          <summary
            style={{
              fontSize: 11,
              color: "var(--bureau-fg-dim)",
              cursor: "pointer",
            }}
          >
            Drift-classification thresholds
          </summary>
          <ul
            style={{ marginTop: 8, fontSize: 11, lineHeight: 1.6 }}
            data-testid="threshold-doc"
          >
            <li>
              <code>stable</code>{" "}
              <span style={{ color: "#1f7a3a" }}>green</span> —{" "}
              {CLASSIFICATION_THRESHOLDS.stable}
            </li>
            <li>
              <code>minor</code>{" "}
              <span style={{ color: "#a78a1f" }}>amber</span> —{" "}
              {CLASSIFICATION_THRESHOLDS.minor}
            </li>
            <li>
              <code>major</code>{" "}
              <span style={{ color: "#a3201d" }}>red</span> —{" "}
              {CLASSIFICATION_THRESHOLDS.major}
            </li>
            <li>
              <code>swap</code>{" "}
              <span style={{ color: "#a3201d" }}>red</span> —{" "}
              {CLASSIFICATION_THRESHOLDS.swap}
            </li>
          </ul>
        </details>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Fingerprint</h2>
        <p style={StatLineStyle} data-testid="fingerprint-hash">
          Current hash:{" "}
          {fingerprintHash ? (
            <code>{formatCassetteHash(fingerprintHash)}</code>
          ) : (
            "—"
          )}
        </p>
        <p style={StatLineStyle} data-testid="prior-fingerprint-hash">
          Prior scan hash:{" "}
          {priorFingerprintHash ? (
            <code>{formatCassetteHash(priorFingerprintHash)}</code>
          ) : (
            "—"
          )}
        </p>
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            Hashes are SHA-256 over the canonical-JSON probe-response
            cassette body, prefixed{" "}
            <code>local:</code> per the FINGERPRINT wire spec.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Probe responses</h2>
        {probes && probes.length > 0 ? (
          <ul style={{ lineHeight: 1.7 }}>
            {probes.map((p) => (
              <li key={p.probeId} data-testid={`probe-${p.probeId}`}>
                <strong>{p.probeId}</strong>: <em>{p.prompt}</em>
                <br />
                <span
                  style={{
                    fontFamily: "var(--bureau-mono)",
                    fontSize: 12,
                    color: "var(--bureau-fg-dim)",
                  }}
                >
                  → {p.responseText}
                  {p.tokens != null ? ` (${p.tokens} tokens)` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (Awaiting scan — 5 probe prompts and their responses appear
            here once the runner anchors the receipt.)
          </p>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="cassette-predicate-uri">
          Cassette predicate: <code>{FINGERPRINT_PREDICATE_URI}</code>
        </p>
        {hasDelta ? (
          <p style={StatLineStyle} data-testid="delta-predicate-uri">
            Delta predicate:{" "}
            <code>{FINGERPRINT_DELTA_PREDICATE_URI}</code>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="signer-fingerprint">
          Signer SPKI:{" "}
          {signerFingerprint ? <code>{signerFingerprint}</code> : "—"}
        </p>
        {isAnchored && cassetteUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">
              Rekor UUID: <code>{rekorUuid}</code>
            </p>
            <p>
              Re-run the delta locally to audit drift:
              <br />
              <code>
                pluck bureau fingerprint scan --vendor {vendor ?? "&lt;vendor&gt;"}{" "}
                --model {model ?? "&lt;model&gt;"} --responder ./responder.js
                --out ./.fp
              </code>
              <br />
              <code>
                pluck bureau fingerprint delta {priorFingerprintHash
                  ? formatCassetteHash(priorFingerprintHash)
                  : "&lt;prior&gt;"}{" "}
                {fingerprintHash
                  ? formatCassetteHash(fingerprintHash)
                  : "&lt;current&gt;"}
              </code>
            </p>
            {deltaUrl ? (
              <p data-testid="delta-url">
                Delta envelope: <a href={deltaUrl}><code>{deltaUrl}</code></a>
              </p>
            ) : null}
          </>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>ModelFingerprint cassette</strong> — the signed
              envelope of this scan's probe responses.
            </li>
            {hasDelta ? (
              <li>
                <strong>FingerprintDelta envelope</strong> — separate
                signed envelope encoding the per-probe diff +
                classification, anchored as its own Rekor entry.
              </li>
            ) : (
              <li>
                <strong>FingerprintDelta envelope</strong> — emitted
                only for second-and-later scans of the same target.
                This is the first scan; the next scan triggers the
                delta.
              </li>
            )}
            <li>
              <strong>Rekor entry</strong> — public transparency-log
              anchor; cross-checks the fingerprint hash against the
              vendor's prior scans.
            </li>
          </ul>
        )}
      </section>

      {targetDossierUrl ? (
        <section>
          <h2 style={SectionHeadingStyle}>Target dossier</h2>
          <p>
            <a href={targetDossierUrl} data-testid="dossier-link">
              View all FINGERPRINT scans against this target →
            </a>
          </p>
        </section>
      ) : null}

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a
            href="/bureau/fingerprint/run"
            style={NextActionStyle}
            data-testid="next-run"
          >
            Scan another model
          </a>
          <a
            href="/bureau/fingerprint"
            style={NextActionStyle}
            data-testid="next-program"
          >
            Back to FINGERPRINT
          </a>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(
              `${id} — FINGERPRINT scan`,
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
          Scan receipts are signed with the Pluck-fleet hosted key
          (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ).
        </p>
      </section>
    </>
  );
}
