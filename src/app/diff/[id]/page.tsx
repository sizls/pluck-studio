// ---------------------------------------------------------------------------
// /diff/<id>?since=<phrase-id> — Receipt Diff
// ---------------------------------------------------------------------------
// Two cycles, one vendor, side-by-side. Path param `id` = BASE phrase
// ID; query `?since=<phrase>` = TARGET. Five UI states off the
// `DiffResult` discriminated union: instructions / ok / invalid /
// not-found / different-vendors. Privacy posture matches /search:
// `dynamic = "force-dynamic"`, robots `noindex, nofollow`.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { PhraseSigil } from "../../../components/bureau-ui/PhraseSigil.js";
import { VerdictBadge } from "../../../components/bureau-ui/VerdictBadge.js";
import {
  diffReceipts,
  formatTimeDelta,
  sampleCrossVendorPair,
  sampleDiffPair,
  type DiffResult,
  type ReceiptDiff,
  type ReceiptDiffSide,
} from "../../../lib/diff/receipt-diff.js";
import { verdictToBadgeVariant } from "../../../lib/programs/verdict-mapping.js";
import { PREVIEW_NOW } from "../../../lib/programs/vendor-preview.js";
import { VERDICT_COLORS, formatRelative } from "../../vendor/_ui.js";

const DESC =
  "Receipt Diff — compare two cycles of a vendor side-by-side. Vendor-honesty time machine.";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receipt Diff — Pluck Studio",
  description: DESC,
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  openGraph: { title: "Receipt Diff — Pluck Studio", description: DESC, type: "website" },
};

const S: Record<string, CSSProperties> = {
  header: { borderBottom: "1px solid var(--bureau-fg-dim)", paddingBottom: 16, marginBottom: 24 },
  h2: { fontFamily: "var(--bureau-mono)", fontSize: 13, color: "var(--bureau-fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 32, marginBottom: 12 },
  card: { border: "1px solid var(--bureau-fg-dim)", borderRadius: 6, padding: 16, marginTop: 12, background: "rgba(255, 255, 255, 0.02)" },
  err: { border: "1px solid var(--bureau-fg-dim)", borderLeft: "3px solid #ef4444", borderRadius: 6, padding: 16, marginTop: 12, background: "rgba(239, 68, 68, 0.06)", fontFamily: "var(--bureau-mono)", fontSize: 13, lineHeight: 1.7 },
  info: { border: "1px solid var(--bureau-fg-dim)", borderLeft: "3px solid #fbbf24", borderRadius: 6, padding: 16, marginTop: 12, background: "rgba(251, 191, 36, 0.06)", fontFamily: "var(--bureau-mono)", fontSize: 13, lineHeight: 1.7 },
  // Stacks at <640px, two columns above. Same `auto-fit` trick /vendor and /search use.
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginTop: 12 },
  topRow: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  programLabel: { fontFamily: "var(--bureau-mono)", fontSize: 12, letterSpacing: "0.08em", color: "var(--bureau-fg-dim)" },
  phrase: { fontFamily: "var(--bureau-mono)", fontSize: 14, color: "var(--bureau-fg)", marginTop: 4, wordBreak: "break-all" },
  summary: { marginTop: 8, fontSize: 13, lineHeight: 1.5 },
  meta: { marginTop: 8, fontFamily: "var(--bureau-mono)", fontSize: 11, color: "var(--bureau-fg-dim)" },
  arrow: { fontFamily: "var(--bureau-mono)", color: "var(--bureau-fg-dim)", fontSize: 16 },
  sigilRow: { display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap", marginTop: 16 },
  txStyle: { display: "flex", alignItems: "center", gap: 12, marginTop: 8, flexWrap: "wrap" },
};

const dot = (color: string): CSSProperties => ({
  display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0,
});

const cardStyle = (accent: string): CSSProperties => ({
  ...S.card,
  borderLeft: `3px solid ${accent}`,
  display: "grid",
  gridTemplateColumns: "auto 1fr",
  gap: 14,
  alignItems: "start",
  textDecoration: "none",
  color: "inherit",
});

function colorFor(v: string): string {
  return VERDICT_COLORS[v as keyof typeof VERDICT_COLORS] ?? "var(--bureau-fg-dim)";
}

function ReceiptCard({ side, testid }: { side: ReceiptDiffSide; testid: string }): ReactNode {
  const variant = verdictToBadgeVariant(side.programSlug, side.verdictColor);

  return (
    <a href={side.receiptUrl} style={cardStyle(side.programAccent)} data-testid={testid} data-program-slug={side.programSlug}>
      <PhraseSigil phraseId={side.phraseId} programAccent={side.programAccent} size={64} />
      <div>
        <div style={S.topRow}>
          <span aria-hidden="true" style={dot(colorFor(side.verdictColor))} />
          <span style={S.programLabel}>{side.programName}</span>
          {variant ? <VerdictBadge variant={variant} size="sm" /> : null}
        </div>
        <div style={S.phrase}>{side.phraseId}</div>
        <p style={S.summary}>{side.summary}</p>
        <p style={S.meta}>{formatRelative(side.capturedAt, PREVIEW_NOW)}</p>
      </div>
    </a>
  );
}

function VerdictTransition({ diff }: { diff: ReceiptDiff }): ReactNode {
  const baseV = verdictToBadgeVariant(diff.base.programSlug, diff.base.verdictColor);
  const targetV = verdictToBadgeVariant(diff.target.programSlug, diff.target.verdictColor);

  return (
    <div data-testid="diff-verdict-changed">
      <p style={S.h2}>Verdict changed</p>
      <div style={S.txStyle}>
        <span aria-hidden="true" style={dot(colorFor(diff.base.verdictColor))} />
        {baseV ? <VerdictBadge variant={baseV} size="sm" /> : null}
        <span style={S.programLabel}>{diff.base.verdictColor}</span>
        <span style={S.arrow} aria-hidden="true">→</span>
        <span aria-hidden="true" style={dot(colorFor(diff.target.verdictColor))} />
        {targetV ? <VerdictBadge variant={targetV} size="sm" /> : null}
        <span style={S.programLabel}>{diff.target.verdictColor}</span>
      </div>
    </div>
  );
}

function SummaryDiff({ diff }: { diff: ReceiptDiff }): ReactNode {
  return (
    <div data-testid="diff-summary-changed" style={{ marginTop: 16 }}>
      <p style={S.h2}>Summary changed</p>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>
        <span style={S.programLabel}>before</span><br />{diff.base.summary}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>
        <span style={S.programLabel}>after</span><br />{diff.target.summary}
      </p>
    </div>
  );
}

function ChangesPanel({ diff }: { diff: ReceiptDiff }): ReactNode {
  const anyChange = diff.verdictChanged || diff.summaryChanged;

  return (
    <article style={{ ...S.card, marginTop: 24 }} data-testid="diff-changes-panel">
      <h2 style={{ ...S.h2, marginTop: 0 }}>Changes</h2>
      {diff.verdictChanged ? <VerdictTransition diff={diff} /> : null}
      {diff.summaryChanged ? <SummaryDiff diff={diff} /> : null}
      {!anyChange ? (
        <p style={{ fontSize: 13, lineHeight: 1.6 }}>
          No verdict or summary change between these two cycles. The receipts agree.
        </p>
      ) : null}
      <p style={{ ...S.meta, marginTop: 16 }} data-testid="diff-time-delta">
        {diff.timeDeltaMs === 0 ? (
          <>Captured at the same instant.</>
        ) : (
          <>Captured {formatTimeDelta(diff.timeDeltaMs)} · {Math.abs(diff.timeDeltaMs)}ms apart.</>
        )}
      </p>
      {!diff.sameProgram ? (
        <p style={{ ...S.meta, marginTop: 8 }} data-testid="diff-cross-program">
          Different programs probed the same vendor — useful for triangulation.{" "}
          {diff.base.programName} on the left, {diff.target.programName} on the right.
        </p>
      ) : null}
    </article>
  );
}

function InstructionsState({ baseId }: { baseId: string }): ReactNode {
  const sample = sampleDiffPair();

  return (
    <section data-testid="diff-instructions">
      <h2 style={S.h2}>How it works</h2>
      <p style={{ lineHeight: 1.7 }}>
        Append <code>?since=&lt;phrase-id&gt;</code> to compare two cycles of the same
        vendor side-by-side. Both phrase IDs must share the same scope (vendor) — diffing
        OpenAI vs Anthropic doesn't make sense; the page will tell you so explicitly.
      </p>
      <p style={{ lineHeight: 1.7, marginTop: 12 }}>
        Your base receipt: <code style={{ wordBreak: "break-all" }}>{baseId}</code>
      </p>

      <h2 style={S.h2}>Try a sample diff</h2>
      <p style={S.info} data-testid="diff-sample-callout">
        <a href={`/diff/${sample.base}?since=${sample.target}`} data-testid="diff-sample-link">
          /diff/{sample.base}?since={sample.target}
        </a>
        <br />Two DRAGNET cycles against the same vendor — verdict flipped between cycles.
      </p>

      <h2 style={S.h2}>Find phrase IDs to diff</h2>
      <p style={{ lineHeight: 1.7 }}>
        Browse <a href="/search">/search</a> for related receipts by scope, or pick a vendor
        at <a href="/vendor">/vendor</a> to see every cycle for one provider.
      </p>
    </section>
  );
}

function InvalidPhraseState({ which, phraseId }: { which: "base" | "target"; phraseId: string }): ReactNode {
  return (
    <section data-testid="diff-invalid-state">
      <p style={S.err} data-testid="diff-invalid-error">
        The {which} phrase ID <code style={{ wordBreak: "break-all" }}>{phraseId || "(empty)"}</code>{" "}
        isn't a 4-part scoped phrase ID. The diff page needs the canonical{" "}
        <code>&lt;scope&gt;-&lt;adj&gt;-&lt;noun&gt;-&lt;NNNN&gt;</code> form on both sides.
      </p>
      <p style={{ marginTop: 16, lineHeight: 1.7 }}>
        Recover at <a href="/search">/search</a> — paste the phrase ID and you'll see the
        decomposition + every related receipt. Or try the <a href="/vendor">/vendor</a> index.
      </p>
    </section>
  );
}

function NotFoundState({ which, phraseId }: { which: "base" | "target"; phraseId: string }): ReactNode {
  return (
    <section data-testid="diff-not-found-state">
      <p style={S.info} data-testid="diff-not-found-error">
        No receipt found for the {which} phrase ID{" "}
        <code style={{ wordBreak: "break-all" }}>{phraseId}</code>. The unified store is
        stub-era — when <code>pluck-api /v1/runs</code> lands the diff page surfaces every
        anchored cycle. For now, only receipts that exist in the vendor-preview activity
        index resolve.
      </p>
      <p style={{ marginTop: 16, lineHeight: 1.7 }}>
        Browse <a href="/search">/search</a> to find a phrase ID that round-trips, or hop
        over to <a href="/vendor">/vendor</a>.
      </p>
    </section>
  );
}

function DifferentVendorsState({ baseScope, targetScope, base, target }: { baseScope: string; targetScope: string; base: ReceiptDiffSide; target: ReceiptDiffSide }): ReactNode {
  const sample = sampleDiffPair();

  return (
    <section data-testid="diff-different-vendors-state">
      <p style={S.info} data-testid="diff-different-vendors-error">
        These two phrase IDs target different vendors — <code>{baseScope}</code> on the
        left, <code>{targetScope}</code> on the right. Diffing across vendors doesn't make
        sense (the receipts answer different questions).
      </p>

      <h2 style={S.h2}>Receipts for context</h2>
      <div style={S.grid}>
        <ReceiptCard side={base} testid="diff-base-receipt" />
        <ReceiptCard side={target} testid="diff-target-receipt" />
      </div>

      <h2 style={S.h2}>Try a same-vendor diff</h2>
      <p style={S.info}>
        <a href={`/diff/${sample.base}?since=${sample.target}`} data-testid="diff-sample-link">
          /diff/{sample.base}?since={sample.target}
        </a>
        <br />Two cycles of the same vendor — what diff is built for.
      </p>
    </section>
  );
}

function OkState({ diff }: { diff: ReceiptDiff }): ReactNode {
  return (
    <section data-testid="diff-ok-state">
      <h2 style={S.h2}>Comparing <code>{diff.vendorScope}</code> across two cycles</h2>

      <div style={S.sigilRow} data-testid="diff-sigil-row">
        <PhraseSigil phraseId={diff.base.phraseId} programAccent={diff.base.programAccent} size={56} />
        <span style={S.arrow} aria-hidden="true">→</span>
        <PhraseSigil phraseId={diff.target.phraseId} programAccent={diff.target.programAccent} size={56} />
      </div>

      <div style={S.grid}>
        <ReceiptCard side={diff.base} testid="diff-base-receipt" />
        <ReceiptCard side={diff.target} testid="diff-target-receipt" />
      </div>

      <ChangesPanel diff={diff} />
    </section>
  );
}

function pickResult(result: DiffResult): ReactNode {
  // Exhaustive switch over DiffResult.kind so a 5th union member added
  // later forces this file to handle it (TS `never` check below).
  switch (result.kind) {
    case "ok":
      return <OkState diff={result.diff} />;
    case "invalid-phrase":
      return <InvalidPhraseState which={result.which} phraseId={result.phraseId} />;
    case "not-found":
      return <NotFoundState which={result.which} phraseId={result.phraseId} />;
    case "different-vendors":
      return (
        <DifferentVendorsState
          baseScope={result.baseScope}
          targetScope={result.targetScope}
          base={result.base}
          target={result.target}
        />
      );
    default: {
      const _exhaustive: never = result;
      void _exhaustive;
      return null;
    }
  }
}

interface PageProps {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<{ since?: string | string[] }>;
}

export default async function DiffPage({ params, searchParams }: PageProps): Promise<ReactNode> {
  const { id: rawId } = await params;
  const { since: rawSince } = await searchParams;

  const baseId = typeof rawId === "string" ? decodeURIComponent(rawId).trim() : "";
  const targetId = typeof rawSince === "string" ? rawSince.trim() : "";

  const result = targetId.length > 0 ? diffReceipts(baseId, targetId) : null;
  const cross = sampleCrossVendorPair();

  return (
    <div data-testid="diff-page">
      <section className="bureau-hero" style={S.header}>
        <h1 className="bureau-hero-title">Receipt Diff</h1>
        <p className="bureau-hero-tagline">
          Two cycles. One vendor. Side by side. Vendor-honesty time machine.
        </p>
      </section>

      {result === null ? <InstructionsState baseId={baseId} /> : pickResult(result)}

      <section>
        <h2 style={S.h2}>How diffing works</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            Phrase IDs follow <code>&lt;scope&gt;-&lt;adj&gt;-&lt;noun&gt;-&lt;NNNN&gt;</code>.
            The scope is the vendor (or partner / platform / kind / reason / machine-id).
            Diffs only fire when both sides share the same scope.
          </li>
          <li>
            Cross-program comparison is allowed when the vendors match — e.g.
            DRAGNET-vs-FINGERPRINT for <code>openai</code>. The page flags the
            cross-program case so you know two probes triangulated, not one probe rerun.
          </li>
          <li>
            Today the diff runs on stub-era preview activity. When{" "}
            <code>pluck-api /v1/runs</code> lands the helper swaps to real anchored
            receipts — same UI, real data.
          </li>
        </ul>
      </section>

      <p style={{ marginTop: 32, fontFamily: "var(--bureau-mono)", fontSize: 11, color: "var(--bureau-fg-dim)" }}>
        Sample cross-vendor pair (rejected as expected):{" "}
        <a href={`/diff/${cross.base}?since=${cross.target}`} data-testid="diff-cross-vendor-sample-link">
          /diff/openai-…?since=anthropic-…
        </a>
      </p>
    </div>
  );
}
