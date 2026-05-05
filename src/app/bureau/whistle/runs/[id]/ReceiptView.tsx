"use client";

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
  WHISTLE_PREDICATE_URI,
  formatCassetteHash,
  whistleRunReceiptModule,
} from "../../../../../lib/whistle/run-receipt-module";

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

const LayerRowStyle = (passed: boolean) => ({
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  marginTop: 6,
  color: passed ? "var(--bureau-fg)" : "#ff8888",
});

interface ReceiptViewProps {
  id: string;
}

export function ReceiptView({ id }: ReceiptViewProps): ReactNode {
  // M3 fix: useDirectiveRef is the Strict-Mode-safe lifecycle hook from
  // @directive-run/react. The previous useMemo + manual destroy pattern
  // was unsafe — useMemo is NOT a guaranteed cache.
  const system = useDirectiveRef({ module: whistleRunReceiptModule });

  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  // /v1/runs migration probe — gated behind dev builds OR `?debug=1`.
  // The probe response carries only the routing-partner-prefixed run
  // record; bundleUrl + source identity never appear in /v1/runs (the
  // bundleUrl is in the canonical hash for idempotency but the receipt
  // never echoes it back — anonymity-by-default).
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
  const category = useFact(system, "category");
  const bundleHash = useFact(system, "bundleHash");
  const redactionLayers = useFact(system, "redactionLayers");
  const routingDeliveries = useFact(system, "routingDeliveries");
  const ephemeralSignerFingerprint = useFact(
    system,
    "ephemeralSignerFingerprint",
  );
  const submittedAt = useFact(system, "submittedAt");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isAccepted = useDerived(system, "isAccepted");
  const isHeld = useDerived(system, "isHeld");
  const isFailure = useDerived(system, "isFailure");
  const verdictColor = useDerived(system, "verdictColor");
  const redactionTriggered = useDerived(system, "redactionTriggered");

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
        <h1 className="bureau-hero-title">WHISTLE submission</h1>
        <p className="bureau-hero-tagline">
          <span
            style={StatusBadgeStyle}
            data-testid="run-status"
            aria-live="polite"
          >
            {status ?? "submission pending"}
          </span>
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
          {isPhrase ? (
            <PhraseSigil phraseId={id} programAccent="#a3201d" size={96} />
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
            Stub submit —{" "}
            <code>pluck-api /v1/whistle/submit</code> isn't yet wired,
            so this URL stays here until the runner lands. Bookmark it;
            the URL is permanent and will fill in automatically.
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
          Submission: {verdict ?? "—"}{" "}
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
        {verdictDetail ? (
          <p style={StatLineStyle}>{verdictDetail}</p>
        ) : null}
        {isAccepted ? (
          <p style={{ ...StatLineStyle, color: "#7fbe7f" }}>
            <strong data-testid="accepted-callout">
              Accepted. Routed to partner; Rekor entry emitted.
            </strong>
          </p>
        ) : null}
        {isHeld ? (
          <p style={{ ...StatLineStyle, color: "#a78a1f" }}>
            <strong data-testid="held-callout">
              Held. Redaction layer flagged a signal — fix and
              resubmit. No Rekor entry, no partner delivery yet. The
              held submission isn't terminal.
            </strong>
          </p>
        ) : null}
        {isFailure && verdict ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            <strong data-testid="failure-callout">
              Terminal failure: no partner delivery, no Rekor entry.
              Per-layer breakdown below.
            </strong>
          </p>
        ) : null}
        <p style={StatLineStyle} data-testid="category-row">
          Category: {category ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="bundle-hash">
          Bundle hash:{" "}
          {bundleHash ? <code>{formatCassetteHash(bundleHash)}</code> : "—"}
        </p>
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            Bundle source URL is intentionally NOT on the receipt —
            receipt URLs are publicly addressable, so the bundle's
            origin is the operator's secret. Only the bundle hash
            (post-redaction) is published.
          </em>
        </p>
        {submittedAt ? (
          <p style={StatLineStyle} data-testid="submitted-at">
            Submitted at: {submittedAt}
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Redaction</h2>
        {redactionLayers && redactionLayers.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {redactionLayers.map((l) => (
              <li
                key={l.layer}
                style={LayerRowStyle(l.passed)}
                data-testid={`layer-${l.layer}`}
              >
                {l.passed ? "✓" : "✗"} <strong>{l.layer}</strong>
                {l.signals.length > 0 ? (
                  <span
                    style={{ marginLeft: 8, color: "var(--bureau-fg-dim)" }}
                  >
                    — fired on: {l.signals.join(", ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (Awaiting submission — secret-scrub + k-anonymity floor +
            stylometric refusal layers report here once the runner
            anchors the receipt.)
          </p>
        )}
        {redactionTriggered ? (
          <p style={{ ...StatLineStyle, color: "#ff8888" }}>
            One or more redaction layers fired. Submission held until
            you address the flagged signals.
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Routing</h2>
        {routingDeliveries && routingDeliveries.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {routingDeliveries.map((d) => (
              <li
                key={d.partner}
                style={LayerRowStyle(d.status === "delivered")}
                data-testid={`delivery-${d.partner}`}
              >
                {d.status === "delivered"
                  ? "✓"
                  : d.status === "refused"
                    ? "✗"
                    : "•"}{" "}
                <strong>{d.partner}</strong> — {d.status}
                {d.partnerAck ? (
                  <span
                    style={{ marginLeft: 8, color: "var(--bureau-fg-dim)" }}
                  >
                    (ack: <code>{d.partnerAck}</code>)
                  </span>
                ) : null}
                {d.refusalReason ? (
                  <span
                    style={{ marginLeft: 8, color: "var(--bureau-fg-dim)" }}
                  >
                    — {d.refusalReason}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ ...StatLineStyle, fontStyle: "italic" }}>
            (Awaiting routing — partner-side acknowledgement IDs appear
            here once delivery completes.)
          </p>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="predicate-uri">
          Predicate: <code>{WHISTLE_PREDICATE_URI}</code>
        </p>
        <p style={StatLineStyle} data-testid="ephemeral-signer">
          Ephemeral signer SPKI:{" "}
          {ephemeralSignerFingerprint ? (
            <code>{ephemeralSignerFingerprint}</code>
          ) : (
            "—"
          )}
        </p>
        <p style={{ ...StatLineStyle, fontSize: 11, marginTop: 8 }}>
          <em>
            Per-submission ephemeral key — Studio doesn't retain it.
            Two submissions from the same operator have unrelated
            signer fingerprints.
          </em>
        </p>
        {isAccepted && rekorUuid ? (
          <p data-testid="rekor-uuid">
            Rekor UUID: <code>{rekorUuid}</code>
          </p>
        ) : null}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a
            href="/bureau/whistle/run"
            style={NextActionStyle}
            data-testid="next-run"
          >
            Submit another tip
          </a>
          <a
            href="/bureau/whistle"
            style={NextActionStyle}
            data-testid="next-program"
          >
            Back to WHISTLE
          </a>
          {/* Note: NO "Share on X" — sharing a WHISTLE receipt URL
              is the operator's choice; we don't surface it as a
              default next-action. Operators who want to publish
              copy the URL via the button above. */}
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Signing</h2>
        <p style={{ fontSize: 13 }}>
          Submission receipts are signed with the Pluck-fleet hosted
          key (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ). The bundle itself is signed by an ephemeral key rotated
          per-submission — the receipt's purpose is to prove the
          submission was logged + routed, not to bind the bundle to a
          stable identity.
        </p>
      </section>
    </>
  );
}
