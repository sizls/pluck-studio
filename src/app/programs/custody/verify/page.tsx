// ---------------------------------------------------------------------------
// Pluck / CUSTODY / verify – journalist drag-and-drop verification
// ---------------------------------------------------------------------------
//
// Phase 6 alpha. Drag a CustodyBundle JSON file onto the drop zone;
// the page runs `verifyCustodyBundle` from @sizls/pluck-custody
// in-browser (no network round-trip) and renders the
// FRE902VerifyResult inline.
//
// The same verifier code drives the in-extension verifier (Phase 6.5)
// so a journalist sees identical results whether they drop the bundle
// in the studio app or inside the extension popup.
// ---------------------------------------------------------------------------

"use client";

import { useCallback, useState, type ReactNode } from "react";

// Type-only imports stay at the top so type checking still threads through.
// `verifyCustodyBundle` reaches into `node:crypto` via the canonical-JSON
// path; we dynamic-import it lazily on file drop so the page module never
// pulls Node-only bindings into the initial client bundle (would crash
// SSR and inflate the route weight). See next.config.ts for the
// transpilePackages entry that lets the lazy import resolve.
import type {
  CustodyBundle,
  FRE902VerifyResult,
} from "@sizls/pluck-custody";

// ---------------------------------------------------------------------------
// Reason → admissibility argument map
// ---------------------------------------------------------------------------
//
// The verifier returns an array of human-readable strings. Most journalists
// (and lawyers) need the same answer twice: "what failed" and "how does
// that failure block the FRE 902(13) self-authentication path?" The
// admissibility note maps each known failure family to a single-line
// Daubert/902(13) argument so the verify page hands the journalist
// language they can quote in the story.
//
// Match is case-insensitive substring against the verifier's reason
// string. The first matching entry wins; an unmatched reason still
// renders, just without the admissibility hint.
// ---------------------------------------------------------------------------

interface AdmissibilityEntry {
  matches: ReadonlyArray<string>;
  argument: string;
}

const ADMISSIBILITY_RULES: ReadonlyArray<AdmissibilityEntry> = [
  {
    matches: ["signature", "signer", "dsse"],
    argument:
      "Signature failures break FRE 902(13) self-authentication — the signed envelope is the data-integrity proof; without a valid signer the bundle drops to FRE 901 (extrinsic authentication required).",
  },
  {
    matches: ["webauthn", "attestation", "yubikey", "passkey"],
    argument:
      "WebAuthn attestation failures fail the Daubert reliability standard: a disk-only Ed25519 key doesn't survive a forensic challenge because anyone with file-system access could have signed it.",
  },
  {
    matches: ["merkle", "chain-of-custody", "chain"],
    argument:
      "Chain-of-custody gaps invalidate the continuous-record argument under FRE 803(6) (business records) — a missing Merkle leaf is a missing custody hand-off.",
  },
  {
    matches: ["hash", "digest", "bundle-hash"],
    argument:
      "Hash mismatches mean the bundle has been altered since signing — the chain-of-custody record describes a DIFFERENT artifact than the one in front of you.",
  },
  {
    matches: ["expired", "stale", "timestamp"],
    argument:
      "Timestamp anomalies fail FRE 901(b)(9) (process or system that produces accurate result) — the captured event's chronology doesn't survive scrutiny.",
  },
  {
    matches: ["rekor", "transparency", "tlog"],
    argument:
      "Missing Rekor inclusion proof means the bundle was never anchored to a public transparency log — the third-party witness FRE 902(11) needs is absent.",
  },
  {
    matches: ["redaction", "redact"],
    argument:
      "Redaction marker mismatches break the operator's own published redaction policy — the bundle can't carry the privacy contract its README claims.",
  },
  {
    matches: ["canonical-json", "canonical"],
    argument:
      "Canonicalization failures mean the bundle's JSON shape doesn't match what was signed — any verifier running RFC 8785 will reject it.",
  },
];

function admissibilityFor(reason: string): string | null {
  const lower = reason.toLowerCase();
  for (const rule of ADMISSIBILITY_RULES) {
    if (rule.matches.some((m) => lower.includes(m))) {
      return rule.argument;
    }
  }
  return null;
}

// Exported for the contract tests in
// `__tests__/admissibility.test.ts` so the rule table can't silently
// drift away from what the page renders.
export { admissibilityFor, ADMISSIBILITY_RULES };

const SectionHeadingStyle = {
  fontFamily: "var(--studio-mono)",
  fontSize: 14,
  color: "var(--studio-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const DropZoneStyle = {
  border: "2px dashed var(--studio-fg-dim)",
  borderRadius: 6,
  padding: 32,
  textAlign: "center" as const,
  marginTop: 24,
  fontFamily: "var(--studio-mono)",
  cursor: "pointer" as const,
};

const ResultCalloutStyle = (ok: boolean): React.CSSProperties => ({
  border: `1px solid ${ok ? "rgba(0, 255, 0, 0.6)" : "rgba(255, 80, 80, 0.6)"}`,
  background: ok ? "rgba(0, 255, 0, 0.06)" : "rgba(255, 80, 80, 0.06)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
});

export default function CustodyVerifyPage(): ReactNode {
  const [result, setResult] = useState<FRE902VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const onCopyPermalink = useCallback(() => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator === "undefined" || !navigator.clipboard || !url) {
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
        setCopyState("failed");
        window.setTimeout(() => setCopyState("idle"), 2500);
      },
    );
  }, []);

  function handleFile(file: File): void {
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const bundle = JSON.parse(String(reader.result)) as CustodyBundle;
        const { verifyCustodyBundle } = await import(
          "@sizls/pluck-custody"
        );
        setResult(verifyCustodyBundle(bundle));
      } catch (err) {
        setError(`bundle JSON parse failed: ${(err as Error).message}`);
      }
    };
    reader.onerror = () => setError("file read failed");
    reader.readAsText(file);
  }

  function onDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function onPick(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  return (
    <>
      <section className="studio-hero">
        <h1 className="studio-hero-title">CUSTODY / verify</h1>
        <p className="studio-hero-tagline">
          Drag a CustodyBundle JSON onto the zone below. The verifier
          runs entirely in your browser — no network round-trip — and
          surfaces every check that failed in the result so you can
          map each failure to a legal-admissibility argument.
        </p>
      </section>

      <section>
        <div
          style={DropZoneStyle}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <p>Drop a CustodyBundle JSON here</p>
          <p style={{ fontSize: 11, color: "var(--studio-fg-dim)" }}>
            or pick a file
          </p>
          <input type="file" accept="application/json,.json" onChange={onPick} />
        </div>
      </section>

      {error && (
        <section style={ResultCalloutStyle(false)}>
          <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>Parse error</h2>
          <p>{error}</p>
        </section>
      )}

      {result && (
        <section style={ResultCalloutStyle(result.ok && result.fre902Compliant)}>
          <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
            Result
          </h2>
          <ul style={{ lineHeight: 1.7 }}>
            <li>
              <strong>ok:</strong> {result.ok ? "yes" : "NO"}
            </li>
            <li>
              <strong>FRE 902(13) compliant:</strong>{" "}
              {result.fre902Compliant ? "yes" : "NO"}
            </li>
          </ul>
          {result.reasons.length > 0 && (
            <>
              <h3 style={SectionHeadingStyle}>Reasons</h3>
              <ul style={{ lineHeight: 1.5 }}>
                {result.reasons.map((reason, i) => {
                  const note = admissibilityFor(reason);
                  return (
                    <li key={i} style={{ marginBottom: 12 }}>
                      <div>
                        <strong>{reason}</strong>
                      </div>
                      {note !== null ? (
                        <div
                          data-testid={`admissibility-note-${i}`}
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: "var(--studio-fg-dim)",
                            fontStyle: "italic" as const,
                          }}
                        >
                          Admissibility: {note}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={onCopyPermalink}
              data-testid="copy-verify-permalink"
              style={{
                fontFamily: "var(--studio-mono)",
                fontSize: 12,
                padding: "6px 12px",
                background: "var(--studio-fg-dim)",
                color: "var(--studio-bg)",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {copyState === "copied"
                ? "Permalink copied!"
                : copyState === "failed"
                  ? "Copy failed — select URL bar"
                  : "Copy verification permalink"}
            </button>
          </div>
        </section>
      )}
    </>
  );
}
