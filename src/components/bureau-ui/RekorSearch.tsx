"use client";

// ---------------------------------------------------------------------------
// Pluck Bureau UI – RekorSearch
// ---------------------------------------------------------------------------
//
// Self-contained search box that takes a Rekor uuid OR a logIndex and
// deep-links to:
//   - sigstore.dev search       (logIndex)
//   - rekor.sigstore.dev API    (uuid)
//   - the bureau's own page     (cross-checks against our index)
//
// Renders inclusion-proof status if the caller wires a verifier; the
// component itself is presentation-only (network calls live in the
// app's API route).
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";
import { useState } from "react";

export interface RekorSearchProps {
  /** Optional placeholder. */
  placeholder?: string;
  /**
   * Optional handler – the SSR app wires this to fetch the actual
   * Rekor entry + verify inclusion proof. Returning false marks the
   * UI red; true marks green.
   */
  onVerify?: (input: string) => Promise<{ ok: boolean; reason?: string }>;
}

const UUID_RE = /^[0-9a-f]{64}$/i;
const LOG_INDEX_RE = /^\d+$/;

export function RekorSearch({
  placeholder = "Rekor uuid or logIndex",
  onVerify,
}: RekorSearchProps): ReactNode {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "verifying" }
    | { kind: "ok" }
    | { kind: "error"; reason: string }
  >({ kind: "idle" });

  const trimmed = value.trim();
  const isUuid = UUID_RE.test(trimmed);
  const isLogIndex = LOG_INDEX_RE.test(trimmed);
  const sigstoreSearch = isUuid
    ? `https://search.sigstore.dev/?hash=${trimmed}`
    : isLogIndex
      ? `https://search.sigstore.dev/?logIndex=${trimmed}`
      : "";
  const rekorApi = isUuid
    ? `https://rekor.sigstore.dev/api/v1/log/entries/${trimmed}`
    : "";

  async function handleVerify(): Promise<void> {
    if (!onVerify) {
      return;
    }
    setStatus({ kind: "verifying" });
    try {
      const result = await onVerify(trimmed);
      setStatus(
        result.ok
          ? { kind: "ok" }
          : { kind: "error", reason: result.reason ?? "verification failed" },
      );
    } catch (err) {
      setStatus({
        kind: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="bureau-rekor-search">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setStatus({ kind: "idle" });
        }}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        className="bureau-rekor-search-input"
        aria-label="Rekor uuid or logIndex"
      />
      {(isUuid || isLogIndex) && (
        <div className="bureau-rekor-search-links">
          <a href={sigstoreSearch} rel="noopener noreferrer" target="_blank">
            sigstore search
          </a>
          {rekorApi && (
            <a href={rekorApi} rel="noopener noreferrer" target="_blank">
              rekor api
            </a>
          )}
          {onVerify && (
            <button
              type="button"
              onClick={handleVerify}
              disabled={status.kind === "verifying"}
              className="bureau-rekor-search-verify"
            >
              {status.kind === "verifying" ? "verifying…" : "verify inclusion"}
            </button>
          )}
        </div>
      )}
      {status.kind === "ok" && (
        <span className="bureau-rekor-search-status ok">✓ inclusion verified</span>
      )}
      {status.kind === "error" && (
        <span className="bureau-rekor-search-status error">
          ✗ {status.reason}
        </span>
      )}
    </div>
  );
}
