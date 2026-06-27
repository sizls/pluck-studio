// ---------------------------------------------------------------------------
// Pluck UI – QuorumBadge
// ---------------------------------------------------------------------------

import type { QuorumVote } from "@sizls/pluck-core";
import type { ReactNode } from "react";

export interface QuorumBadgeProps {
  vote: QuorumVote;
}

export function QuorumBadge({ vote }: QuorumBadgeProps): ReactNode {
  const agreeCount = vote.signers.filter((s) => s.verdict === "agree").length;
  const disagreeCount = vote.signers.filter((s) => s.verdict === "disagree").length;
  const tone =
    vote.decision === "passed"
      ? "green"
      : vote.decision === "failed"
        ? "red"
        : "black";

  return (
    <span
      className={`studio-quorum-badge studio-tone-${tone}`}
      title={`Quorum ${vote.threshold.required}-of-${vote.threshold.outOf} • agree:${agreeCount} disagree:${disagreeCount}`}
    >
      <span className="studio-quorum-badge-decision">
        {vote.decision.toUpperCase()}
      </span>
      <span className="studio-quorum-badge-detail">
        {agreeCount}/{vote.threshold.outOf} agree
      </span>
    </span>
  );
}
