"use client";

// ---------------------------------------------------------------------------
// CopyShareLink — copy-to-clipboard button for the daily share URL
// ---------------------------------------------------------------------------
//
// The /today page is server-rendered overall; only this button is a
// client component. It mirrors the Bureau-canonical onCopy pattern from
// `src/app/bureau/dragnet/runs/[id]/ReceiptView.tsx`:
//
//   - reads `window.location.href` on click
//   - guards against missing clipboard API (insecure context, sandboxed
//     iframe, ancient browser) with a "failed" fallback state
//   - drives a `copyState: 'idle' | 'copied' | 'failed'` indicator that
//     auto-resets after a short timeout
//
// Operators copy this URL into Slack / X / Discord and paste — the OG
// card unfurls, no further interaction required.
// ---------------------------------------------------------------------------

import { useCallback, useState, type CSSProperties, type ReactNode } from "react";

interface CopyShareLinkProps {
  readonly style?: CSSProperties;
}

export function CopyShareLink({ style }: CopyShareLinkProps): ReactNode {
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

  const label =
    copyState === "copied"
      ? "Copied!"
      : copyState === "failed"
        ? "Copy failed — select URL bar"
        : "Copy share URL";

  return (
    <button
      type="button"
      onClick={onCopy}
      style={style}
      data-testid="today-share-link"
      data-copy-state={copyState}
      aria-live="polite"
    >
      {label}
    </button>
  );
}
