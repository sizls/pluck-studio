// ---------------------------------------------------------------------------
// Pluck Bureau UI – DossierViewer
// ---------------------------------------------------------------------------
//
// Renders a (program, vendor, model) dossier as a horizontal timeline
// of dots. The bureau verifies the dossier hash before render; if
// verification fails the viewer shows a tamper-warning banner instead
// of the timeline.
// ---------------------------------------------------------------------------

import type { Dossier } from "@sizls/pluck-bureau-core";
import { verifyDossier } from "@sizls/pluck-bureau-core";
import type { ReactNode } from "react";

import { QuorumBadge } from "./QuorumBadge.js";
import { TimelineDotMark } from "./TimelineDot.js";

export interface DossierViewerProps {
  dossier: Dossier;
}

export function DossierViewer({ dossier }: DossierViewerProps): ReactNode {
  const verification = verifyDossier(dossier);
  if (!verification.ok) {
    return (
      <div className="bureau-dossier-viewer bureau-dossier-tamper">
        <strong>Dossier verification failed.</strong> {verification.reason}
      </div>
    );
  }
  const greenCount = dossier.dots.filter((d) => d.tone === "green").length;
  const redCount = dossier.dots.filter((d) => d.tone === "red").length;
  const blackCount = dossier.dots.filter((d) => d.tone === "black").length;

  return (
    <div className="bureau-dossier-viewer">
      <header className="bureau-dossier-header">
        <h2 className="bureau-dossier-title">
          {dossier.subject.vendor}/{dossier.subject.model}
        </h2>
        <span className="bureau-dossier-program">{dossier.program}</span>
        <span className="bureau-dossier-stats">
          <span className="bureau-tone-green">●</span> {greenCount}
          {" • "}
          <span className="bureau-tone-red">●</span> {redCount}
          {" • "}
          <span className="bureau-tone-black">◆</span> {blackCount}
        </span>
      </header>
      <div className="bureau-dossier-timeline" role="list">
        {dossier.dots.map((dot) => (
          <TimelineDotMark key={dot.dotId} dot={dot} />
        ))}
      </div>
      {dossier.quorum && (
        <footer className="bureau-dossier-footer">
          quorum:{" "}
          <span title={`signed at ${dossier.quorum.signedAt}`}>
            {dossier.quorum.threshold.required}-of-
            {dossier.quorum.threshold.outOf} {dossier.quorum.decision}
          </span>
        </footer>
      )}
    </div>
  );
}

/** Re-export for callers that want to render quorum results standalone. */
export { QuorumBadge };
