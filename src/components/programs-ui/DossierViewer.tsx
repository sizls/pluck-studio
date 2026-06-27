// ---------------------------------------------------------------------------
// Pluck UI – DossierViewer
// ---------------------------------------------------------------------------
//
// Renders a (program, vendor, model) dossier as a horizontal timeline
// of dots. The Pluck verifies the dossier hash before render; if
// verification fails the viewer shows a tamper-warning banner instead
// of the timeline.
// ---------------------------------------------------------------------------

import type { Dossier } from "@sizls/pluck-core";
import { verifyDossier } from "@sizls/pluck-core";
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
      <div className="studio-dossier-viewer studio-dossier-tamper">
        <strong>Dossier verification failed.</strong> {verification.reason}
      </div>
    );
  }
  const greenCount = dossier.dots.filter((d) => d.tone === "green").length;
  const redCount = dossier.dots.filter((d) => d.tone === "red").length;
  const blackCount = dossier.dots.filter((d) => d.tone === "black").length;

  return (
    <div className="studio-dossier-viewer">
      <header className="studio-dossier-header">
        <h2 className="studio-dossier-title">
          {dossier.subject.vendor}/{dossier.subject.model}
        </h2>
        <span className="studio-dossier-program">{dossier.program}</span>
        <span className="studio-dossier-stats">
          <span className="studio-tone-green">●</span> {greenCount}
          {" • "}
          <span className="studio-tone-red">●</span> {redCount}
          {" • "}
          <span className="studio-tone-black">◆</span> {blackCount}
        </span>
      </header>
      <div className="studio-dossier-timeline" role="list">
        {dossier.dots.map((dot) => (
          <TimelineDotMark key={dot.dotId} dot={dot} />
        ))}
      </div>
      {dossier.quorum && (
        <footer className="studio-dossier-footer">
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
