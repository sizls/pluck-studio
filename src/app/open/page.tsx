// ---------------------------------------------------------------------------
// /open — Phrase-ID Speed-Dial index
// ---------------------------------------------------------------------------
//
// The naked `/open` URL. The actual speed-dial happens at
// `/open/<phrase>` (see `[phrase]/route.ts`); this page renders when
// an operator strips the path segment, lands here by accident, or
// pastes the bare prefix into the URL bar.
//
// Pure server-render. No state. Explains the speed-dial in two
// sentences, shows a sample link or two pulled from
// `sampleSearchablePhraseIds()` so the curious operator can click
// straight through, and cross-links to /search for the "I want the
// related-by-scope grid, not just the receipt" path.
//
// `noindex` because /open variants must NOT pile up as crawled URLs.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";

import { sampleSearchablePhraseIds } from "../../lib/search/phrase-stitch.js";

const PAGE_DESCRIPTION =
  "Phrase-ID Speed-Dial — paste any phrase ID into the URL bar after /open/ to jump straight to its receipt page.";

export const metadata: Metadata = {
  title: "Speed-dial — Pluck Studio",
  description: PAGE_DESCRIPTION,
  // /open is the entrypoint to a redirect surface — refuse indexing on
  // both /open and every /open/<phrase> variant. The route handler
  // sets the same X-Robots-Tag for safety.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    title: "Speed-dial — Pluck Studio",
    description: PAGE_DESCRIPTION,
    type: "website",
  },
};

const Styles: Record<string, CSSProperties> = {
  header: {
    borderBottom: "1px solid var(--bureau-fg-dim)",
    paddingBottom: 16,
    marginBottom: 24,
  },
  h2: {
    fontFamily: "var(--bureau-mono)",
    fontSize: 13,
    color: "var(--bureau-fg-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginTop: 32,
    marginBottom: 12,
  },
  code: {
    fontFamily: "var(--bureau-mono)",
    fontSize: 13,
    background: "rgba(255, 255, 255, 0.05)",
    padding: "2px 6px",
    borderRadius: 3,
    wordBreak: "break-all",
  },
  list: { display: "grid", gap: 8, marginTop: 12, paddingLeft: 0, listStyle: "none" },
  sample: {
    border: "1px solid var(--bureau-fg-dim)",
    borderRadius: 6,
    padding: 16,
    background: "rgba(255, 255, 255, 0.02)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    textDecoration: "none",
    color: "inherit",
    fontFamily: "var(--bureau-mono)",
    fontSize: 13,
  },
};

function SampleLink({ phraseId, index }: { phraseId: string; index: number }): ReactNode {
  return (
    <li>
      <a
        href={`/open/${phraseId}`}
        style={Styles.sample}
        data-testid="open-sample-link"
        data-sample-index={index}
      >
        <span>/open/{phraseId}</span>
        <span style={{ color: "var(--bureau-fg-dim)" }}>→ receipt</span>
      </a>
    </li>
  );
}

export default function OpenIndexPage(): ReactNode {
  const samples = sampleSearchablePhraseIds().slice(0, 3);

  return (
    <main
      data-testid="open-index"
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "32px 24px 64px",
      }}
    >
      <header style={Styles.header}>
        <h1
          style={{
            fontFamily: "var(--bureau-mono)",
            fontSize: 28,
            margin: 0,
          }}
        >
          Phrase-ID Speed-Dial
        </h1>
        <p
          style={{
            marginTop: 8,
            color: "var(--bureau-fg-dim)",
            lineHeight: 1.5,
          }}
        >
          {PAGE_DESCRIPTION}
        </p>
      </header>

      <section>
        <h2 style={Styles.h2}>How it works</h2>
        <p style={{ lineHeight: 1.6 }}>
          Paste any phrase ID into the URL bar after{" "}
          <code style={Styles.code}>/open/</code> and you'll be redirected
          to whichever Bureau program owns that receipt. PhraseIds are a
          global namespace — you don't have to remember which program a
          run came from to land on its receipt page.
        </p>
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>
          Example: <code style={Styles.code}>/open/swift-falcon-3742</code>{" "}
          resolves to the canonical receipt URL (e.g.{" "}
          <code style={Styles.code}>
            /bureau/dragnet/runs/openai-bold-marlin-1188
          </code>
          ).
        </p>
        <p style={{ marginTop: 12, lineHeight: 1.6 }}>
          Short-form alias for the type-impatient:{" "}
          <code style={Styles.code}>/o/swift-falcon-3742</code> — identical
          behavior, fewer keystrokes.
        </p>
      </section>

      {samples.length > 0 ? (
        <section>
          <h2 style={Styles.h2}>Try it</h2>
          <p style={{ color: "var(--bureau-fg-dim)" }}>
            A handful of round-trip-safe sample IDs from the live
            preview data:
          </p>
          <ul style={Styles.list}>
            {samples.map((id, i) => (
              <SampleLink key={id} phraseId={id} index={i} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 style={Styles.h2}>Didn't find what you wanted?</h2>
        <p
          style={{ lineHeight: 1.6 }}
          data-testid="open-search-cross-link"
        >
          If the speed-dial misses (an unfamiliar scope, a phrase ID
          that's been TTL-evicted, a typo) you'll be redirected to{" "}
          <a href="/search">/search</a> with the original query
          pre-filled — same parser, plus the related-by-scope grid for
          orientation.
        </p>
      </section>
    </main>
  );
}
