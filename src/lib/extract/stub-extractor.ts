// ---------------------------------------------------------------------------
// extract/stub-extractor — hand-curated assertion extraction stub
// ---------------------------------------------------------------------------
//
// v3-R1 Backlog #8 — paste-a-screenshot probe extractor. Real vision-LLM
// integration is a follow-on commit (needs API key + vendor decision +
// prompt engineering). The stub returns hand-curated demo claims keyed
// off the operator's vendor hint. Same pattern as Studio's /vendor preview
// data — the eventual real-LLM swap is a one-file change.
//
// DEFAMATION GUARD — every claim suffixes ILLUSTRATIVE_SUFFIX so an
// operator (or third party reading over their shoulder) can never mistake
// an extractor output for a verified fact. The "Probe with DRAGNET" CTA
// only PRE-FILLS the run form; auth-ack + manual submit still required.
//
// PRIVACY POSTURE — pure function, no IO, no fetch. Caller (the page)
// processes the screenshot client-side via FileReader and passes the data
// URL in. The page surfaces this verbatim.
// ---------------------------------------------------------------------------

export type AssertionConfidence = "high" | "medium" | "low";

export interface ExtractedAssertion {
  readonly vendor: string;
  readonly claim: string;
  readonly testableForm: string;
  readonly confidence: AssertionConfidence;
  readonly rationale: string;
}

/**
 * Suffix appended to every extracted claim. Defamation surface mitigation:
 * every visible claim text reads "...(illustrative — verify before probing)".
 * Locked by `stub-extractor.test.ts` — every stub claim must end with this
 * suffix or the test suite fails the build.
 */
export const ILLUSTRATIVE_SUFFIX = "(illustrative — verify before probing)";

const sx = (t: string) => `${t} ${ILLUSTRATIVE_SUFFIX}`;

const OPENAI: ReadonlyArray<ExtractedAssertion> = [
  { vendor: "openai", confidence: "high",
    claim: sx("GPT-4 has a 128K-token context window."),
    testableForm: "GPT-4 should accept a 128K-token prompt without truncation when queried at /v1/chat/completions.",
    rationale: "Concrete numeric capability claim — DRAGNET canon-context-window covers this shape." },
  { vendor: "openai", confidence: "medium",
    claim: sx("GPT-4's training cutoff is January 2025."),
    testableForm: "GPT-4 should refuse or hedge on world events from February 2025 onward.",
    rationale: "Date-bounded claim — testable but timing is fuzzy; medium confidence." },
  { vendor: "openai", confidence: "high",
    claim: sx("OpenAI never trains on customer API data by default."),
    testableForm: "OpenAI's stated training-data policy should match the served /policies endpoint and the published ToS.",
    rationale: "Policy claim with public counterpart — canon-honesty covers vendor-policy mirroring." },
  { vendor: "openai", confidence: "low",
    claim: sx("ChatGPT Plus includes priority access during peak hours."),
    testableForm: "Plus-tier API responses should outperform free-tier on a calibrated latency probe at peak.",
    rationale: "Subjective performance claim — hard to probe without longitudinal data." },
];

const ANTHROPIC: ReadonlyArray<ExtractedAssertion> = [
  { vendor: "anthropic", confidence: "high",
    claim: sx("Claude has a 1M-token context window."),
    testableForm: "Claude should accept a 1M-token prompt without truncation when queried at /v1/messages.",
    rationale: "Concrete numeric capability claim — fingerprint-grade probe applies directly." },
  { vendor: "anthropic", confidence: "medium",
    claim: sx("Claude is trained with constitutional AI."),
    testableForm: "Claude's behavioral profile on canon-constitutional should mirror the published Constitutional AI paper's claims.",
    rationale: "Method claim — partially testable via behavioral probes." },
  { vendor: "anthropic", confidence: "high",
    claim: sx("Claude refuses to write malware."),
    testableForm: "Claude should refuse a direct malware-authoring request on the canon-honesty refusal probe.",
    rationale: "Refusal-policy claim — DRAGNET refusal-consistency probes cover this." },
];

const GOOGLE: ReadonlyArray<ExtractedAssertion> = [
  { vendor: "google", confidence: "medium",
    claim: sx("Gemini Ultra outperforms GPT-4 on MMLU."),
    testableForm: "Gemini Ultra's MMLU score on a re-run public benchmark should exceed GPT-4's published score.",
    rationale: "Comparative benchmark claim — re-runnable but eval methodology drifts." },
  { vendor: "google", confidence: "high",
    claim: sx("Gemini supports 1M-token context across all tiers."),
    testableForm: "Gemini's free-tier and Pro-tier endpoints should both accept a 1M-token prompt.",
    rationale: "Capability availability claim — testable per-tier with a single probe." },
  { vendor: "google", confidence: "high",
    claim: sx("Gemini does not retain user prompts after processing."),
    testableForm: "Gemini's data-retention policy should match the served /privacy endpoint and the published ToS.",
    rationale: "Policy claim — direct mirror probe applies." },
];

const GENERIC: ReadonlyArray<ExtractedAssertion> = [
  { vendor: "unknown", confidence: "medium",
    claim: sx("The model has a 200K-token context window."),
    testableForm: "Vendor's API should accept a 200K-token prompt without truncation.",
    rationale: "Generic capability claim — applies to any context-window probe pack." },
  { vendor: "unknown", confidence: "high",
    claim: sx("Customer data is never used to train the model."),
    testableForm: "Vendor's stated training-data policy should match its served /policies endpoint and ToS.",
    rationale: "Standard vendor-policy claim — canon-honesty covers this shape." },
  { vendor: "unknown", confidence: "medium",
    claim: sx("Responses are SOC 2 Type II compliant."),
    testableForm: "Vendor's SOC 2 attestation URL should resolve and match the certifying-auditor claim.",
    rationale: "Compliance claim — verifiable via OATH-style well-known endpoint check." },
];

const SAMPLES: ReadonlyArray<{
  match: ReadonlyArray<string>;
  sample: ReadonlyArray<ExtractedAssertion>;
}> = [
  { match: ["openai", "chatgpt", "gpt"], sample: OPENAI },
  { match: ["anthropic", "claude"], sample: ANTHROPIC },
  { match: ["google", "gemini", "bard", "deepmind"], sample: GOOGLE },
];

function pickSample(hint?: string): ReadonlyArray<ExtractedAssertion> {
  if (!hint) {
    return GENERIC;
  }
  const lower = hint.toLowerCase();
  for (const e of SAMPLES) {
    if (e.match.some((m) => lower.includes(m))) {
      return e.sample;
    }
  }

  return GENERIC;
}

/**
 * Contract:
 *   - Input: base64 data URL + optional vendor hint. Both pure inputs.
 *   - Output: 3-5 ExtractedAssertion records, every claim suffixed
 *     ILLUSTRATIVE_SUFFIX, mixed confidence levels.
 *
 * The data URL is intentionally unused in the stub — keeping it in the
 * signature makes the eventual real-LLM swap a one-file change. The
 * `data:` validation is a tiny defense against callers passing raw text.
 */
export async function extractAssertionsStub(
  imageDataUrl: string,
  hint?: string,
): Promise<ReadonlyArray<ExtractedAssertion>> {
  if (!imageDataUrl.startsWith("data:")) {
    throw new Error("extractAssertionsStub: imageDataUrl must be a data: URL.");
  }

  return pickSample(hint);
}
