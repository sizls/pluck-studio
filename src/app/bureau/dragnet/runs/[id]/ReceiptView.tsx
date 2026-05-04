"use client";

// ---------------------------------------------------------------------------
// DRAGNET ReceiptView — Directive-backed live receipt UI
// ---------------------------------------------------------------------------
//
// State lives in `dragnetRunReceiptModule`. React reads via useFact +
// useDerived. Today the facts initialise from `params.id` and stay at
// "cycle pending" because pluck-api /v1/runs is not yet wired. When it
// lands, a `@directive-run/query` client (re-added when wired) will
// subscribe to the Supabase Realtime `runs:id=eq.{uuid}` channel and
// re-write facts in place — this render code does not change.
// ---------------------------------------------------------------------------

import { useDerived, useDirectiveRef, useFact } from "@directive-run/react";
import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  DRAGNET_CYCLE_PREDICATE_URI,
  dragnetRunReceiptModule,
} from "../../../../../lib/dragnet/run-receipt-module";
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
  // @directive-run/react. It stores the system in a ref, recreates it
  // after Strict Mode's simulated cleanup, and destroys-once on real
  // unmount. The previous useMemo + manual destroy pattern was unsafe
  // because useMemo is NOT a guaranteed cache — Strict Mode could leave
  // a destroyed system cached for the next render.
  const system = useDirectiveRef({ module: dragnetRunReceiptModule });

  // Sync the id fact whenever the route param changes. The system itself
  // is stable across id changes; we just write to the reactive fact and
  // let derivations recompute. (Pre-M3 the system was destroyed and
  // recreated when id changed, which is wasteful — same render output.)
  useEffect(() => {
    system.facts.id = id;
  }, [system, id]);

  // /v1/runs migration probe — once a runId is in the unified store,
  // we tag the receipt as "via /v1/runs" so it's obvious which path the
  // page used. Old phrase IDs (created before the migration, or after
  // store TTL eviction) fall back to the pre-/v1 stub render — same UI,
  // no indicator. Graceful migration runway per the Phase 3 plan.
  //
  // This is purely cosmetic. To avoid burning a network round-trip on
  // every receipt render in production we gate the probe behind dev
  // builds OR an explicit `?debug=1` query param. The chosen-cheaper
  // option per the AE review.
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
  const probeCount = useFact(system, "probeCount");
  const classifications = useFact(system, "classifications");
  const dotColor = useFact(system, "dotColor");
  const targetDossierUrl = useFact(system, "targetDossierUrl");
  const receiptUrl = useFact(system, "receiptUrl");
  const rekorUuid = useFact(system, "rekorUuid");

  const isPending = useDerived(system, "isPending");
  const isAnchored = useDerived(system, "isAnchored");
  const hasClassifications = useDerived(system, "hasClassifications");

  const isPhrase = isPhraseId(id);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const onCopy = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";

    if (typeof navigator === "undefined" || !navigator.clipboard || !url) {
      // No clipboard API (insecure context, old browser, sandboxed iframe).
      // Surface a "failed" state so the user can manually select the URL bar.
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
        // iOS Safari / permission-denied — fall back to a visible cue.
        setCopyState("failed");
        window.setTimeout(() => setCopyState("idle"), 2500);
      },
    );
  }, []);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">DRAGNET Cycle</h1>
        <p className="bureau-hero-tagline">
          <span
            style={StatusBadgeStyle}
            data-testid="run-status"
            aria-live="polite"
          >
            {status ?? "cycle pending"}
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
            Stub run — <code>pluck-api /v1/runs</code> isn't yet wired,
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
        <h2 style={SectionHeadingStyle}>Cycle outcome</h2>
        <p style={StatLineStyle} data-testid="probe-count">
          Probes run: {probeCount ?? "—"}
        </p>
        <p style={StatLineStyle} data-testid="classifications">
          Contradict / Mirror / Shadow / Snare:{" "}
          {classifications
            ? `${classifications.contradict} / ${classifications.mirror} / ${classifications.shadow} / ${classifications.snare}`
            : "— / — / — / —"}
        </p>
        <p style={StatLineStyle} data-testid="dot-color">
          TimelineDot: {dotColor ?? "—"}
        </p>
        {hasClassifications && classifications ? (
          <p style={StatLineStyle}>
            Total classified:{" "}
            {classifications.contradict +
              classifications.mirror +
              classifications.shadow +
              classifications.snare}
          </p>
        ) : null}
        <p style={{ ...StatLineStyle, marginTop: 12, fontSize: 11 }}>
          <em>
            DRAGNET classifies each probe response into one of four
            buckets; the cycle's TimelineDot color is the worst class
            seen this cycle:{" "}
            <code>contradict / mirror → red</code>,{" "}
            <code>shadow → amber</code>,{" "}
            <code>snare → green</code>. The "pack matchers" referenced
            in the program description are the predicates that perform
            the classification — they live inside the probe-pack YAML,
            not the receipt.
          </em>
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Verification</h2>
        <p style={StatLineStyle} data-testid="predicate-uri">
          Predicate: <code>{DRAGNET_CYCLE_PREDICATE_URI}</code>
        </p>
        {isAnchored && receiptUrl && rekorUuid ? (
          <>
            <p data-testid="rekor-uuid">
              Rekor UUID: <code>{rekorUuid}</code>
            </p>
            <p>
              Verify offline:{" "}
              <code>
                curl {receiptUrl} | cosign verify-blob --key
                /.well-known/pluck-keys.json -
              </code>
            </p>
          </>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>Signed receipt</strong> — DSSE envelope you can verify
              offline with{" "}
              <code>cosign verify-blob --key /.well-known/pluck-keys.json</code>.
            </li>
            <li>
              <strong>Rekor entry UUID</strong> — public transparency-log
              anchor.
            </li>
            <li>
              <strong>Frame-by-frame trace</strong> — every probe → cassette
              event, scrubbable via the Pluck Bureau timeline.
            </li>
            <li>
              <strong>Share URL</strong> — public scrubber view for any
              visitor (operator opts in).
            </li>
          </ul>
        )}
      </section>

      {targetDossierUrl ? (
        <section>
          <h2 style={SectionHeadingStyle}>Target dossier</h2>
          <p>
            <a href={targetDossierUrl} data-testid="dossier-link">
              View all DRAGNET cycles against this target →
            </a>
          </p>
        </section>
      ) : null}

      <section>
        <h2 style={SectionHeadingStyle}>Next</h2>
        <p>
          <a
            href="/bureau/dragnet/run"
            style={NextActionStyle}
            data-testid="next-run"
          >
            Run another cycle
          </a>
          <a
            href="/bureau/dragnet"
            style={NextActionStyle}
            data-testid="next-program"
          >
            Back to DRAGNET
          </a>
          <a
            href={`https://x.com/intent/tweet?text=${encodeURIComponent(
              `${id} — DRAGNET cycle receipt`,
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
          Hosted-mode receipts are signed with the Pluck-fleet hosted key
          (
          <a href="/.well-known/pluck-keys.json">
            <code>/.well-known/pluck-keys.json</code>
          </a>
          ). Bring-your-own-key signing lands with the operator-key flow.
        </p>
      </section>
    </>
  );
}
