// ---------------------------------------------------------------------------
// Pluck Bureau UI – QuorumBadge
// ---------------------------------------------------------------------------

import type { QuorumVote } from "@sizls/pluck-bureau-core";
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
      className={`bureau-quorum-badge bureau-tone-${tone}`}
      title={`Quorum ${vote.threshold.required}-of-${vote.threshold.outOf} • agree:${agreeCount} disagree:${disagreeCount}`}
    >
      <span className="bureau-quorum-badge-decision">
        {vote.decision.toUpperCase()}
      </span>
      <span className="bureau-quorum-badge-detail">
        {agreeCount}/{vote.threshold.outOf} agree
      </span>
    </span>
  );
}
