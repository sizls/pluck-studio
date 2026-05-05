// ---------------------------------------------------------------------------
// /extract — paste-a-screenshot probe extractor
// ---------------------------------------------------------------------------
// v3-R1 Backlog #8 (R1 idea #3 deferred, now shipped). Operator drops/
// pastes a screenshot of a vendor's marketing claim; the page extracts
// testable assertions; per-row "Probe with DRAGNET" CTA pre-fills the run
// form via query params (auth-ack still required, no auto-submit).
//
// Stub-era: real vision-LLM swap is a follow-on commit (same shape as
// /vendor preview). Privacy posture: screenshot processed CLIENT-SIDE.
// Defamation guard: every claim renders "(illustrative — verify before
// probing)". See `lib/extract/stub-extractor.ts` for the contract.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { ExtractTool } from "./ExtractTool";

export const metadata = {
  title: "Screenshot probe extractor — Pluck Studio",
  description:
    "Paste a screenshot of a vendor marketing claim. Studio extracts testable assertions; one click pre-fills DRAGNET. Your screenshot stays in your browser.",
};

const heading: CSSProperties = { fontFamily: "var(--bureau-mono)", fontSize: 14, color: "var(--bureau-fg-dim)", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 32 };
const callout: CSSProperties = { marginTop: 16, padding: "12px 16px", fontFamily: "var(--bureau-mono)", fontSize: 13, color: "var(--bureau-fg-dim)", border: "1px dashed var(--bureau-fg-dim)", borderRadius: 4, background: "rgba(255,255,255,0.02)" };
const stubCallout: CSSProperties = { ...callout, marginTop: 12, borderColor: "var(--bureau-tone-yellow)", color: "var(--bureau-fg)" };

export default function ExtractPage(): ReactNode {
  return (
    <main data-testid="extract-page">
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Screenshot probe extractor</h1>
        <p className="bureau-hero-tagline">
          Drop a screenshot of a vendor's marketing claim. Studio extracts testable assertions and offers one-click pre-fill into DRAGNET. You review and click submit; nothing fires automatically.
        </p>
      </section>

      <section data-testid="extract-privacy-callout" style={callout}>
        <strong>Privacy posture.</strong> Your screenshot stays in your browser. Studio never sees it — extraction runs client-side, no server upload, no persistence. The phrase-ID schema is the proof: if Studio knew it, it would be in the URL.
      </section>

      <section data-testid="extract-stub-callout" style={stubCallout}>
        <strong>Stub-era extractor.</strong> The extractor is currently a hand-curated demo set keyed off your vendor hint (try "openai", "anthropic", "google"). Real vision-LLM integration is a future commit — same UI, same flow, same defamation guard.
      </section>

      <section>
        <h2 style={heading}>Drop a screenshot</h2>
        <ExtractTool />
      </section>

      <section>
        <h2 style={heading}>How this works</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>Paste, drop, or upload a screenshot. The image is converted to a base64 data URL in your browser — no server upload.</li>
          <li>Click <em>Extract assertions</em>. The stub returns 3-5 testable claims with mixed confidence. Every claim is tagged <code>(illustrative — verify before probing)</code> — defamation safeguard, never an unconditional truth statement.</li>
          <li>Click <em>Probe with DRAGNET</em>. The run form opens with vendor + assertion pre-filled. You still review, acknowledge authorization, and click submit — extraction never auto-fires.</li>
        </ol>
      </section>

      <section>
        <h2 style={heading}>Where this fits</h2>
        <p style={{ lineHeight: 1.7 }}>
          The activations directory at <a href="/runs">/runs</a> lists every Bureau program. This extractor is a zero-friction onboarding loop: turn any marketing screenshot into a probe in seconds. Read <a href="/what-we-dont-know">/what-we-dont-know</a> for the EXTRACT line ("we don't see your screenshot").
        </p>
      </section>
    </main>
  );
}
