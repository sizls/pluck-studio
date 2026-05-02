// ---------------------------------------------------------------------------
// Bureau / CUSTODY / verify – journalist drag-and-drop verification
// ---------------------------------------------------------------------------
//
// Phase 6 alpha. Drag a CustodyBundle JSON file onto the drop zone;
// the page runs `verifyCustodyBundle` from @sizls/pluck-bureau-custody
// in-browser (no network round-trip) and renders the
// FRE902VerifyResult inline.
//
// The same verifier code drives the in-extension verifier (Phase 6.5)
// so a journalist sees identical results whether they drop the bundle
// in the studio app or inside the extension popup.
// ---------------------------------------------------------------------------

"use client";

import { useState, type ReactNode } from "react";

// Type-only imports stay at the top so type checking still threads through.
// `verifyCustodyBundle` reaches into `node:crypto` via the canonical-JSON
// path; we dynamic-import it lazily on file drop so the page module never
// pulls Node-only bindings into the initial client bundle (would crash
// SSR and inflate the route weight). See next.config.ts for the
// transpilePackages entry that lets the lazy import resolve.
import type {
  CustodyBundle,
  FRE902VerifyResult,
} from "@sizls/pluck-bureau-custody";

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const DropZoneStyle = {
  border: "2px dashed var(--bureau-fg-dim)",
  borderRadius: 6,
  padding: 32,
  textAlign: "center" as const,
  marginTop: 24,
  fontFamily: "var(--bureau-mono)",
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

  function handleFile(file: File): void {
    setError(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const bundle = JSON.parse(String(reader.result)) as CustodyBundle;
        const { verifyCustodyBundle } = await import(
          "@sizls/pluck-bureau-custody"
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
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">CUSTODY / verify</h1>
        <p className="bureau-hero-tagline">
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
          <p style={{ fontSize: 11, color: "var(--bureau-fg-dim)" }}>
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
                {result.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}
    </>
  );
}
