"use client";

// ---------------------------------------------------------------------------
// ExtractTool — paste-a-screenshot probe extractor (client UI)
// ---------------------------------------------------------------------------
// v3-R1 Backlog #8. Operator drops / pastes / uploads a screenshot; the
// stub extractor returns 3-5 testable assertions; per-row "Probe with
// DRAGNET" pre-fills the run form via ?vendor=&assertion= (operator must
// still review + click submit, auth-ack required).
//
// Privacy posture: screenshot processed CLIENT-SIDE (FileReader → data URL
// → pure stub). No upload, no /api/*, no persistence.
//
// Defamation guard: every claim suffixed `(illustrative — verify before
// probing)` (locked by the stub-extractor); CTA only pre-fills.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type DragEvent as ReactDragEvent, type ReactNode } from "react";

import { extractAssertionsStub, type AssertionConfidence, type ExtractedAssertion } from "../../lib/extract/stub-extractor";

const mono = "var(--bureau-mono)";
const dim = "var(--bureau-fg-dim)";
const fg = "var(--bureau-fg)";
const bg = "var(--bureau-bg)";

const dropZone: CSSProperties = { border: `1px dashed ${dim}`, borderRadius: 6, padding: 32, marginTop: 16, fontFamily: mono, fontSize: 13, color: dim, textAlign: "center", background: "rgba(255,255,255,0.02)", cursor: "pointer" };
const dropZoneActive: CSSProperties = { ...dropZone, borderStyle: "solid", borderColor: "var(--bureau-accent)", color: fg };
const preview: CSSProperties = { marginTop: 16, border: "1px solid var(--bureau-border)", borderRadius: 6, padding: 12, background: "rgba(255,255,255,0.02)", display: "flex", flexDirection: "column", gap: 12 };
const previewImg: CSSProperties = { maxWidth: "100%", maxHeight: 360, objectFit: "contain", borderRadius: 4, background: bg, alignSelf: "center" };
const btn: CSSProperties = { padding: "10px 18px", fontFamily: mono, fontSize: 13, background: fg, color: bg, border: "none", borderRadius: 4, cursor: "pointer" };
const btnSec: CSSProperties = { ...btn, background: "transparent", color: fg, border: `1px solid ${dim}` };
const hintInput: CSSProperties = { width: "100%", marginTop: 8, padding: "8px 12px", fontFamily: mono, fontSize: 13, background: bg, color: fg, border: `1px solid ${dim}`, borderRadius: 4 };
const hintLabel: CSSProperties = { display: "block", marginTop: 16, fontFamily: mono, fontSize: 12, color: dim, textTransform: "uppercase", letterSpacing: "0.06em" };
const card: CSSProperties = { border: "1px solid var(--bureau-border)", borderRadius: 6, padding: 16, background: "rgba(255,255,255,0.02)" };
const badge: CSSProperties = { display: "inline-block", padding: "2px 8px", fontFamily: mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", borderRadius: 3, marginRight: 8 };
const cta: CSSProperties = { display: "inline-block", marginTop: 12, padding: "6px 12px", fontFamily: mono, fontSize: 12, background: fg, color: bg, textDecoration: "none", borderRadius: 4 };
const errStyle: CSSProperties = { marginTop: 12, padding: "10px 14px", fontFamily: mono, fontSize: 13, color: "var(--bureau-tone-red)", border: "1px solid var(--bureau-tone-red)", borderRadius: 4 };
const dimSm: CSSProperties = { marginTop: 8, fontSize: 12, color: dim, lineHeight: 1.5 };
const sectionLabel: CSSProperties = { fontFamily: mono, fontSize: 12, color: dim, textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 8 };

function badgeStyle(c: AssertionConfidence): CSSProperties {
  const colors: Record<AssertionConfidence, string> = { high: "var(--bureau-tone-green)", medium: "var(--bureau-tone-yellow)", low: dim };
  return { ...badge, background: colors[c], color: bg };
}

function probeHref(a: ExtractedAssertion): string {
  const p = new URLSearchParams({ vendor: a.vendor, assertion: a.testableForm });
  return `/bureau/dragnet/run?${p.toString()}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => typeof r.result === "string" ? resolve(r.result) : reject(new Error("FileReader returned a non-string result."));
    r.onerror = () => reject(r.error ?? new Error("FileReader failed."));
    r.readAsDataURL(file);
  });
}

export function ExtractTool(): ReactNode {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [hint, setHint] = useState<string>("");
  const [assertions, setAssertions] = useState<ReadonlyArray<ExtractedAssertion>>([]);
  const [extracting, setExtracting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const setFromFile = useCallback(async (file: File): Promise<void> => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported (png, jpg, webp, gif).");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setImageDataUrl(dataUrl);
      setAssertions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file.");
    }
  }, []);

  // Window-level paste so the operator can paste anywhere on the page.
  useEffect(() => {
    function onPaste(e: ClipboardEvent): void {
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (item && item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            void setFromFile(f);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setFromFile]);

  function onFileInputChange(e: ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0];
    if (f) { void setFromFile(f); }
  }

  function onDrop(e: ReactDragEvent<HTMLDivElement>): void {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) { void setFromFile(f); }
  }

  async function onExtract(): Promise<void> {
    if (!imageDataUrl) { return; }
    setExtracting(true);
    setError(null);
    try {
      setAssertions(await extractAssertionsStub(imageDataUrl, hint.trim() || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  function onClear(): void {
    setImageDataUrl(null);
    setAssertions([]);
    setError(null);
    setHint("");
    if (fileInputRef.current) { fileInputRef.current.value = ""; }
  }

  const openFileChooser = () => fileInputRef.current?.click();

  return (
    <div data-testid="extract-tool">
      <div role="button" tabIndex={0} data-testid="extract-dropzone" style={dragActive ? dropZoneActive : dropZone}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onClick={openFileChooser}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openFileChooser(); } }}
      >
        Drop a screenshot here, paste from clipboard (Cmd/Ctrl-V), or click to choose a file. The image stays in your browser.
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileInputChange} style={{ display: "none" }} data-testid="extract-file-input" />

      <label style={hintLabel}>
        Vendor hint (optional)
        <input type="text" placeholder="e.g. openai, anthropic, google" value={hint} onChange={(e) => setHint(e.target.value)} style={hintInput} data-testid="extract-hint" />
      </label>

      {imageDataUrl ? (
        <div style={preview} data-testid="extract-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageDataUrl} alt="Pasted screenshot preview" style={previewImg} data-testid="extract-preview-image" />
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={onExtract} disabled={extracting} style={btn} data-testid="extract-cta">
              {extracting ? "Extracting…" : "Extract assertions"}
            </button>
            <button type="button" onClick={onClear} style={btnSec} data-testid="extract-clear">Clear</button>
          </div>
        </div>
      ) : null}

      {error ? <p data-testid="extract-error" style={errStyle}>{error}</p> : null}

      {assertions.length > 0 ? (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }} data-testid="extract-results">
          <p style={sectionLabel}>Extracted assertions ({assertions.length}) — review before probing</p>
          {assertions.map((a, idx) => (
            <article key={`${a.vendor}-${idx}`} data-testid="extracted-assertion" data-vendor={a.vendor} data-confidence={a.confidence} style={a.confidence === "low" ? { ...card, opacity: 0.75 } : card}>
              <p style={{ margin: 0 }}>
                <span style={badgeStyle(a.confidence)}>{a.confidence}</span>
                <strong>{a.vendor}</strong>
              </p>
              <p style={{ marginTop: 8, lineHeight: 1.6 }}>{a.claim}</p>
              <p style={dimSm}><strong>Testable form:</strong> {a.testableForm}</p>
              <p style={{ ...dimSm, marginTop: 4 }}><strong>Why testable:</strong> {a.rationale}</p>
              <a href={probeHref(a)} style={cta} data-testid="probe-with-dragnet-cta">Probe with DRAGNET →</a>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
