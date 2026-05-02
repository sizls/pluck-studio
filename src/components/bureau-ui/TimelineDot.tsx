// ---------------------------------------------------------------------------
// Pluck Bureau UI – TimelineDotMark
// ---------------------------------------------------------------------------
//
// Renders a single timeline dot (`TimelineDot` data type from core)
// onto a horizontal Bureau timeline. Three tones:
//   green – clean signed observation
//   red   – falsification (contradict / mirror / shadow / snare hit)
//   black – quorum split or observation corruption
//
// Component is named `TimelineDotMark` (not `TimelineDot`) so it does
// not collide with the `TimelineDot` data type exported by
// `@sizls/pluck-bureau-core`. This separation is locked at Phase 0
// because 11 future Bureau programs will import both.
//
// Click → navigates to the dot's deep-dive page where the operator
// sees the underlying cassette, the sigstore search link, and the
// cosign verification command.
// ---------------------------------------------------------------------------

import type { TimelineDot } from "@sizls/pluck-bureau-core";
import type { ReactNode } from "react";

export interface TimelineDotMarkProps {
  dot: TimelineDot;
  /** Optional href override – defaults to `/bureau/<program>/<vendor>/<model>/<dotId>`. */
  href?: string;
}

export function TimelineDotMark({ dot, href }: TimelineDotMarkProps): ReactNode {
  const url =
    href ??
    `/bureau/${dot.program}/${encodeURIComponent(dot.subject.vendor)}/${encodeURIComponent(dot.subject.model)}/${dot.dotId}`;
  const tooltip =
    `${dot.tone.toUpperCase()} • ${dot.emittedAt}\n` +
    `${dot.reason}${dot.summary ? `\n${dot.summary}` : ""}\n` +
    `rekor uuid: ${dot.rekorUuid}`;

  return (
    <a
      href={url}
      className={`bureau-timeline-dot bureau-tone-${dot.tone}`}
      title={tooltip}
      aria-label={`${dot.tone} dot: ${dot.reason}`}
      data-dot-id={dot.dotId}
      data-rekor-uuid={dot.rekorUuid}
    >
      <span className="bureau-timeline-dot-mark" aria-hidden="true">
        {dot.tone === "green" ? "●" : dot.tone === "red" ? "●" : "◆"}
      </span>
    </a>
  );
}
