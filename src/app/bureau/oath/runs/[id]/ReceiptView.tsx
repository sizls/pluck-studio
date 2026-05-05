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

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { V1RunStatusBanner } from "../../../../../components/bureau-ui/V1RunStatusBanner.js";
import { PhraseSigil } from "../../../../../components/bureau-ui/PhraseSigil.js";
import { isPhraseId } from "../../../../../lib/phrase-id";
import {
  OATH_PREDICATE_URI,
  oathRunReceiptModule,
} from "../../../../../lib/oath/run-receipt-module";

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
  const system = useDirectiveRef({ module: oathRunReceiptModule });

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
  const vendorDomain = useFact(system, "vendorDomain");
  const hostingOrigin = useFact(system, "hostingOrigin");
  const signerFingerprint = useFact(system, "signerFingerprint");
  const claimsCount = useFact(system, "claimsCount");
  const claims = useFact(system, "claims");
  const expiresAt = useFact(system, "expiresAt");
  const oathEnvelopeUrl = useFact(system, "oathEnvelopeUrl");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isVerified = useDerived(system, "isVerified");
  const isFailure = useDerived(system, "isFailure");
  const hasStaleClaim = useDerived(system, "hasStaleClaim");
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
      <V1RunStatusBanner id={id} />
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

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {isPhrase ? (
            <PhraseSigil phraseId={id} programAccent="#a78a1f" size={96} />
          ) : null}
          <div style={{ minWidth: 0 }}>
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
          </div>
        </div>

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
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Failure: no Rekor entry will be emitted for this cycle.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="vendor-domain">
          Vendor: {vendorDomain ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="hosting-origin">
          Hosting origin: {hostingOrigin ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="claims-count">
          Claims: {claimsCount ?? "—"}
        </p>
        {expiresAt ? (
          <p style={StatLineStyle} data-testid="expires-at">
            Envelope expires: {expiresAt}
          </p>
        ) : null}
        {hasStaleClaim ? (
          <p style={{ ...StatLineStyle, color: "#a78a1f" }}>
            One or more claims past <code>expiresAt</code> — sealed.
          </p>
        ) : null}
        <p style={{ ...StatLineStyle, marginTop: 12, fontSize: 11 }}>
          <em>
            OATH verdicts (color legend): <code>verified</code>{" "}
            <span style={{ color: "#1f7a3a" }}>green</span> (DSSE valid
            + Origin matches body's <code>vendor</code> + envelope
            within TTL) · <code>oath-expired</code>{" "}
            <span style={{ color: "#a78a1f" }}>amber</span>{" "}
            (sealed-claim) · <code>did-not-commit</code>{" "}
            <span style={{ color: "#a78a1f" }}>amber</span> (no oath
            published — social-pressure badge) ·{" "}
            <code>signature-failed</code> · <code>origin-mismatch</code>{" "}
            · <code>not-found</code> · <code>fetch-failed</code>{" "}
            <span style={{ color: "#a3201d" }}>red</span>.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Claims</h2>
        {claims && claims.length > 0 ? (
          <ul style={{ lineHeight: 1.7 }}>
            {claims.map((c) => (
              <li key={c.id} data-testid={`claim-${c.id}`}>
                <strong>{c.id}</strong> — {c.text}{" "}
                <em style={{ color: "var(--bureau-fg-dim)" }}>
                  (expires {c.expiresAt}
                  {c.verdict === "oath-expired" ? (
                    <>
                      ; <span style={{ color: "#a78a1f" }}>oath-expired</span>
                    </>
                  ) : null}
                  )
                </em>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (Awaiting verification — claims appear here once the runner
            anchors the receipt.)
          </p>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="predicate-uri">
          Predicate: <code>{OATH_PREDICATE_URI}</code>
        </p>
        {isVerified && oathEnvelopeUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">
              Rekor UUID: <code>{rekorUuid}</code>
            </p>
            <p>
              Verify the oath envelope offline:{" "}
              <code>
                pluck bureau oath verify {oathEnvelopeUrl}{" "}
                --expected-origin {hostingOrigin}
              </code>
            </p>
            <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
              <em>
                Note: this command verifies the vendor's signed oath
                envelope (the <code>&lt;hash&gt;.intoto.jsonl</code>{" "}
                artifact). The cycle receipt itself (this URL) is
                signed separately by the Pluck-fleet hosted key — see
                Signing below.
              </em>
            </p>
          </>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>DSSE envelope</strong> — verify offline with{" "}
              <code>
                pluck bureau oath verify ./.oath/&lt;hash&gt;.intoto.jsonl
              </code>{" "}
              (operator-side artifact path).
            </li>
            <li>
              <strong>Rekor entry</strong> — public transparency-log
              anchor; cross-checks the served Origin against the body's{" "}
              <code>vendor</code> field.
            </li>
            <li>
              <strong>Signer fingerprint</strong> — SPKI fingerprint of
              the vendor's signing key (64-char hex).{" "}
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
          Cycle receipts are signed with the Pluck-fleet hosted key
          (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ). The vendor's oath itself is signed with the vendor's own
          key — fingerprint shown above on success.
        </p>
      </section>
    </>
  );
}
