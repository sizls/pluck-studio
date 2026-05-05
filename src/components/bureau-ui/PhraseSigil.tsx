// ---------------------------------------------------------------------------
// Pluck Bureau UI — PhraseSigil
// ---------------------------------------------------------------------------
//
// Renders the procedural sigil for a phrase ID. Server component — emits
// the SVG directly into the HTML so /search, /vendor, and every receipt
// page ship the crest with no client JS.
//
// The SVG bytes come from `renderPhraseSigil`, which is built entirely
// from controlled primitives + numeric attributes (no raw user input
// flows through). The accent color is sanitized at the data layer.
// `dangerouslySetInnerHTML` is therefore safe — the only string crossing
// the React boundary is one we authored byte-for-byte.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import {
  phraseSigilData,
  renderPhraseSigil,
} from "../../lib/sigil/phrase-sigil.js";

export interface PhraseSigilProps {
  /** Canonical phrase ID. Bare 3-part IDs render with no serial badge. */
  readonly phraseId: string;
  /** Output pixel size. Defaults to 64. ViewBox stays 100x100. */
  readonly size?: number;
  /** Program accent color literal (`#RRGGBB` / `hsl(...)`). Optional. */
  readonly programAccent?: string;
  /** Optional caller-supplied class for layout (e.g. flexbox alignment). */
  readonly className?: string;
  /** Optional inline style (padding, margin) — does not affect the SVG. */
  readonly style?: CSSProperties;
  /** Override the default test id; useful when multiple sigils share a row. */
  readonly testId?: string;
}

/**
 * PhraseSigil — procedural SVG sigil for a phrase ID.
 *
 * Caller responsibility: the data layer renders for ANY input (falls back
 * to defaults for invalid phraseId). Callers should gate via isPhraseId()
 * if they only want sigils for valid 4-part scoped phrase IDs. Receipt
 * views already do this; new callers must be aware.
 */
export function PhraseSigil({
  phraseId,
  size = 64,
  programAccent,
  className,
  style,
  testId,
}: PhraseSigilProps): ReactNode {
  const data = phraseSigilData(phraseId, { programAccent });
  const svg = renderPhraseSigil(data, size);
  const label = `Phrase sigil for ${phraseId}`;

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        lineHeight: 0,
        ...style,
      }}
      data-testid={testId ?? "phrase-sigil"}
      data-phrase-id={phraseId}
      data-shape={data.shape}
      aria-label={label}
      title={label}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG built from controlled primitives + sanitized accent; no raw user input crosses this boundary.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
