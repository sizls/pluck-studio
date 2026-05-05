// ---------------------------------------------------------------------------
// /search — Phrase-ID Auto-Stitch Search
// ---------------------------------------------------------------------------
//
// Paste any phrase ID in. See every related receipt across all 11
// Bureau programs out. The keystone search experience — every receipt
// URL becomes a discoverable nexus.
//
// Architecture:
//   - Server-rendered. The form posts via GET to /search?q=<phrase> so
//     it works without JS (URL bar paste → results in one keystroke).
//   - Aggregator: `searchPhraseId(query)` — pure helper that runs
//     against vendor-preview today, swaps to pluck-api `/v1/runs`
//     when live data lands.
//   - Decomposition card: shows scope/adjective/noun/serial with the
//     semantic label from PHRASE_ID_PREFIX_CONVENTIONS.
//   - Results: direct match (canonical receipt) + related-by-scope
//     grid (every other receipt sharing the scope across programs).
//
// All summary strings carry the `(illustrative)` suffix from
// vendor-preview — page cannot be screenshotted as factual telemetry.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { PhraseSigil } from "../../components/bureau-ui/PhraseSigil.js";
import { VerdictBadge } from "../../components/bureau-ui/VerdictBadge.js";
import {
  PHRASE_ID_PREFIX_CONVENTIONS,
  type PhraseIdPrefixConvention,
} from "../../lib/programs/registry.js";
import { verdictToBadgeVariant } from "../../lib/programs/verdict-mapping.js";
import { PREVIEW_NOW } from "../../lib/programs/vendor-preview.js";
import {
  sampleSearchablePhraseIds,
  searchPhraseId,
  type SearchAggregateResult,
  type SearchResult,
} from "../../lib/search/phrase-stitch.js";
import { VERDICT_COLORS, formatRelative } from "../vendor/_ui.js";

const PAGE_DESCRIPTION =
  "Phrase-ID Auto-Stitch Search — paste any phrase ID, see every related receipt across all 11 Bureau programs.";

// Force dynamic rendering so Next.js never statically caches /search.
// Search query strings echo arbitrary user input (emails, secrets pasted
// into the URL bar) into the rendered HTML — caching at the CDN or
// build layer would leak that input across users. With
// `dynamic = "force-dynamic"` the framework defaults Cache-Control to
// `private, no-store`-equivalent behavior on the response.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search — Pluck Studio",
  description: PAGE_DESCRIPTION,
  // Refuse search-engine indexing. /search?q=<anything> must NOT become
  // a permanent searchable record of arbitrary queries. `index: false`
  // emits a `<meta name="robots" content="noindex, nofollow">` into the
  // response head; `googleBot` mirrors it explicitly so Google honors it
  // even when crawled via the dedicated bot.
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: "Search — Pluck Studio",
    description: PAGE_DESCRIPTION,
    type: "website",
  },
};

const HeaderStyle: CSSProperties = {
  borderBottom: "1px solid var(--bureau-fg-dim)",
  paddingBottom: 16,
  marginBottom: 24,
};

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
  marginBottom: 12,
};

const FormStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  marginTop: 16,
  flexWrap: "wrap",
};

const InputStyle: CSSProperties = {
  flex: "1 1 320px",
  minWidth: 0,
  padding: "10px 12px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  color: "var(--bureau-fg)",
};

const ButtonStyle: CSSProperties = {
  padding: "10px 18px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  background: "var(--bureau-fg)",
  color: "var(--bureau-bg)",
  border: "none",
  borderRadius: 4,
  cursor: "pointer",
};

const CardStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 16,
  marginTop: 12,
  background: "rgba(255, 255, 255, 0.02)",
};

const DecompositionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const DecompositionCellStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  padding: "10px 12px",
  background: "rgba(255, 255, 255, 0.02)",
};

const DecompositionLabelStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 10,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--bureau-fg-dim)",
};

const DecompositionValueStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 16,
  marginTop: 4,
  color: "var(--bureau-fg)",
  wordBreak: "break-all",
};

const ResultsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const ResultTileStyle: CSSProperties = {
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 16,
  background: "rgba(255, 255, 255, 0.02)",
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

const ResultTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

const ResultDotStyle = (color: string): CSSProperties => ({
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

const ResultProgramStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  letterSpacing: "0.08em",
  color: "var(--bureau-fg-dim)",
};

const ResultPhraseStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg)",
  marginTop: 4,
  wordBreak: "break-all",
};

const ResultSummaryStyle: CSSProperties = {
  marginTop: 8,
  fontSize: 13,
  lineHeight: 1.5,
};

const ResultMetaStyle: CSSProperties = {
  marginTop: 8,
  fontFamily: "var(--bureau-mono)",
  fontSize: 11,
  color: "var(--bureau-fg-dim)",
};

const ErrorStyle: CSSProperties = {
  ...CardStyle,
  borderLeft: "3px solid #ef4444",
  background: "rgba(239, 68, 68, 0.06)",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
};

const InfoStyle: CSSProperties = {
  ...CardStyle,
  borderLeft: "3px solid #fbbf24",
  background: "rgba(251, 191, 36, 0.06)",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  lineHeight: 1.6,
};

interface PageProps {
  readonly searchParams: Promise<{ q?: string }>;
}

function ResultTile({
  result,
  testid,
}: {
  result: SearchResult;
  testid: string;
}): ReactNode {
  const tileStyle: CSSProperties = {
    ...ResultTileStyle,
    borderLeft: `3px solid ${result.programAccent}`,
    display: "grid",
    gridTemplateColumns: "auto 1fr",
    gap: 14,
    alignItems: "start",
  };

  return (
    <a
      href={result.receiptUrl}
      style={tileStyle}
      data-testid={testid}
      data-program-slug={result.programSlug}
    >
      <PhraseSigil
        phraseId={result.phraseId}
        programAccent={result.programAccent}
        size={64}
      />
      <div>
        <div style={ResultTopRowStyle}>
          <span
            aria-hidden="true"
            style={ResultDotStyle(VERDICT_COLORS[result.verdictColor])}
          />
          <span style={ResultProgramStyle}>{result.programName}</span>
          {(() => {
            const variant = verdictToBadgeVariant(
              result.programSlug,
              result.verdictColor,
            );

            return variant ? <VerdictBadge variant={variant} size="sm" /> : null;
          })()}
        </div>
        <div style={ResultPhraseStyle}>{result.phraseId}</div>
        <p style={ResultSummaryStyle}>{result.summary}</p>
        <p style={ResultMetaStyle}>
          {formatRelative(result.capturedAt, PREVIEW_NOW)}
        </p>
      </div>
    </a>
  );
}

function Decomposition({
  parsed,
}: {
  parsed: SearchAggregateResult["parsed"];
}): ReactNode {
  const convention: PhraseIdPrefixConvention | undefined =
    PHRASE_ID_PREFIX_CONVENTIONS[parsed.scope];

  // Try matching across registry entries when scope didn't directly hit.
  // ("openai" hits dragnet/oath/fingerprint/custody at once — show
  // their shared semantic.)
  const semanticLabel = convention
    ? convention.prefixSource
    : "scope (free-form)";
  const rationale = convention
    ? convention.rationale
    : "Scope label varies by program — see /what-we-dont-know for the per-program prefix convention.";

  return (
    <article style={CardStyle} data-testid="search-decomposition">
      <h2 style={SectionHeadingStyle}>Phrase-ID decomposition</h2>
      <div style={DecompositionGridStyle}>
        <div style={DecompositionCellStyle}>
          <div style={DecompositionLabelStyle}>scope</div>
          <div style={DecompositionValueStyle}>{parsed.scope || "—"}</div>
        </div>
        <div style={DecompositionCellStyle}>
          <div style={DecompositionLabelStyle}>adjective</div>
          <div style={DecompositionValueStyle}>{parsed.adjective}</div>
        </div>
        <div style={DecompositionCellStyle}>
          <div style={DecompositionLabelStyle}>noun</div>
          <div style={DecompositionValueStyle}>{parsed.noun}</div>
        </div>
        <div style={DecompositionCellStyle}>
          <div style={DecompositionLabelStyle}>serial</div>
          <div style={DecompositionValueStyle}>{parsed.serial}</div>
        </div>
      </div>
      <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6 }}>
        <strong>Scope means:</strong> {semanticLabel}.
      </p>
      <p
        style={{
          marginTop: 6,
          fontSize: 12,
          color: "var(--bureau-fg-dim)",
          lineHeight: 1.6,
        }}
      >
        {rationale}
      </p>
    </article>
  );
}

function SearchForm({ q }: { q: string }): ReactNode {
  return (
    <form
      method="GET"
      action="/search"
      style={FormStyle}
      data-testid="search-form"
      role="search"
    >
      <label htmlFor="search-input" style={{ display: "none" }}>
        Phrase ID
      </label>
      <input
        id="search-input"
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Paste a phrase ID — e.g. openai-bold-marlin-1188"
        style={InputStyle}
        autoComplete="off"
        spellCheck={false}
        data-testid="search-input"
      />
      <button
        type="submit"
        style={ButtonStyle}
        data-testid="search-submit"
      >
        Stitch →
      </button>
    </form>
  );
}

function EmptyState({ samples }: { samples: ReadonlyArray<string> }): ReactNode {
  return (
    <section data-testid="search-empty-state">
      <h2 style={SectionHeadingStyle}>Examples</h2>
      <p style={{ lineHeight: 1.7 }}>
        Paste any phrase ID from a receipt URL. Try one of these
        stub-era samples:
      </p>
      <ul
        style={{ marginTop: 12, padding: 0, listStyle: "none", lineHeight: 2 }}
      >
        {samples.map((sample) => (
          <li key={sample}>
            <a
              href={`/search?q=${encodeURIComponent(sample)}`}
              data-testid="search-sample-link"
              style={{ fontFamily: "var(--bureau-mono)", fontSize: 14 }}
            >
              {sample}
            </a>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: 16, lineHeight: 1.7 }}>
        Or try one of the cross-cutting hubs:{" "}
        <a href="/runs">/runs</a> · <a href="/today">/today</a> ·{" "}
        <a href="/vendor">/vendor</a>.
      </p>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: PageProps): Promise<ReactNode> {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const trimmed = query.trim();
  const result = trimmed.length > 0 ? searchPhraseId(trimmed) : null;
  const samples = sampleSearchablePhraseIds();

  return (
    <div data-testid="search-page">
      <section className="bureau-hero" style={HeaderStyle}>
        <h1 className="bureau-hero-title">Phrase-ID Auto-Stitch</h1>
        <p className="bureau-hero-tagline">
          Paste any phrase ID. See every related receipt across all 11
          Bureau programs — same vendor, same partner, same platform,
          same scope. Every receipt URL is a discoverable nexus.
        </p>
        <SearchForm q={trimmed} />
      </section>

      {result === null ? (
        <EmptyState samples={samples} />
      ) : (
        <SearchResults result={result} samples={samples} />
      )}

      <section>
        <h2 style={SectionHeadingStyle}>How it works</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            Phrase IDs follow{" "}
            <code>&lt;scope&gt;-&lt;adj&gt;-&lt;noun&gt;-&lt;NNNN&gt;</code>.
            The <em>scope</em> encodes program-specific context — vendor
            for DRAGNET / OATH / FINGERPRINT / CUSTODY / NUCLEI / MOLE,
            partner for WHISTLE, platform for BOUNTY, kind for SBOM-AI,
            reason for ROTATE, machine-id for TRIPWIRE.
          </li>
          <li>
            Auto-stitch fans out from the scope: every receipt that
            shares it across the 11 programs surfaces in one view.
          </li>
          <li>
            Today the index runs on stub-era preview activity. When{" "}
            <code>pluck-api /v1/runs</code> lands, the helper swaps to a
            live <code>?phraseIdPrefix=</code> query — same UI, real
            data.
          </li>
        </ul>
      </section>
    </div>
  );
}

function SearchResults({
  result,
  samples,
}: {
  result: SearchAggregateResult;
  samples: ReadonlyArray<string>;
}): ReactNode {
  const { parsed, directMatch, relatedByScope, totalCount } = result;

  if (!parsed.valid) {
    return (
      <section data-testid="search-results">
        <p style={ErrorStyle} data-testid="search-error">
          {parsed.error ?? "Unparseable phrase ID."}
        </p>
        <EmptyState samples={samples} />
      </section>
    );
  }

  return (
    <section data-testid="search-results">
      <Decomposition parsed={parsed} />

      <h2 style={SectionHeadingStyle}>
        Direct match {directMatch ? "(1)" : "(0)"}
      </h2>
      {directMatch ? (
        <div style={ResultsGridStyle}>
          <ResultTile result={directMatch} testid="search-direct-match" />
        </div>
      ) : (
        <p style={InfoStyle} data-testid="search-no-direct-match">
          No receipt found for <code>{parsed.normalized}</code> yet — the
          unified store is stub-era. <code>pluck-api</code> will surface
          live receipts.
        </p>
      )}

      <h2 style={SectionHeadingStyle}>
        Related by scope <code>{parsed.scope}</code> ({relatedByScope.length})
      </h2>
      {relatedByScope.length > 0 ? (
        <div style={ResultsGridStyle}>
          {relatedByScope.map((r) => (
            <ResultTile
              key={`${r.programSlug}:${r.phraseId}`}
              result={r}
              testid="search-related-result"
            />
          ))}
        </div>
      ) : (
        <p style={InfoStyle} data-testid="search-no-related">
          No related receipts found for scope{" "}
          <code>{parsed.scope}</code>. The scope may not be a
          vendor-bearing program prefix yet covered by stub data — see{" "}
          <a href="/what-we-dont-know">/what-we-dont-know</a> for the
          full prefix convention.
        </p>
      )}

      <p
        style={{
          marginTop: 12,
          fontFamily: "var(--bureau-mono)",
          fontSize: 12,
          color: "var(--bureau-fg-dim)",
        }}
        data-testid="search-total-count"
      >
        {totalCount} total receipt{totalCount === 1 ? "" : "s"} stitched.
      </p>
    </section>
  );
}
