// ---------------------------------------------------------------------------
// vendor-preview — hand-curated per-vendor activity for /vendor/<slug>
// ---------------------------------------------------------------------------
//
// Phase-stub: pluck-api /v1/runs isn't live yet. The vendor profile page
// renders this canned activity table so visitors can see the shape —
// when /v1/runs lands, the page swaps `VENDOR_PREVIEW` for live data
// with no other code changes (the rendering layer takes the same shape).
//
// Coverage rule: only the 6 vendor-bearing programs feed this index.
// DRAGNET / OATH / FINGERPRINT / CUSTODY use vendor-prefixed phrase IDs,
// NUCLEI tags packs by `vendorScope`, and MOLE binds canaries to a
// canaryUrl host. WHISTLE (routing-partner-not-source), BOUNTY (target
// platform), ROTATE (rotation reason), TRIPWIRE (machine-id), and
// SBOM-AI (artifact kind) are correctly excluded — their phrase-ID
// schemas refuse to surface vendor identity.
//
// Receipts are hand-curated for a believable distribution: most green,
// a meaningful slice of amber and red, and a tasteful sprinkling of
// gray (insufficient-evidence). Renders publicly — no claims that
// would require legal review beyond the public-receipt baseline.
// ---------------------------------------------------------------------------

export type VendorVerdict = "green" | "amber" | "red" | "gray";

export type VendorProgramSlug =
  | "dragnet"
  | "oath"
  | "fingerprint"
  | "custody"
  | "nuclei"
  | "mole";

export interface VendorReceipt {
  readonly phraseId: string;
  readonly verdict: VendorVerdict;
  readonly capturedAt: Date;
  readonly summary: string;
}

export interface VendorProgramActivity {
  readonly programSlug: VendorProgramSlug;
  readonly receipts: ReadonlyArray<VendorReceipt>;
}

export interface VendorPreviewActivity {
  readonly slug: string;
  readonly programs: ReadonlyArray<VendorProgramActivity>;
  readonly totalReceipts: number;
  readonly verdictBreakdown: {
    readonly green: number;
    readonly amber: number;
    readonly red: number;
    readonly gray: number;
  };
}

// Anchor "now" relative to a fixed clock so the preview activity is
// deterministic across renders. When real /v1/runs data arrives, we
// drop this anchor — receipts come with real timestamps.
const PREVIEW_ANCHOR = new Date("2026-05-04T12:00:00.000Z");

function daysAgo(days: number, hour = 12): Date {
  const d = new Date(PREVIEW_ANCHOR);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, 0, 0, 0);

  return d;
}

interface RawReceipt {
  readonly phraseId: string;
  readonly verdict: VendorVerdict;
  readonly daysAgo: number;
  readonly hour?: number;
  readonly summary: string;
}

interface RawVendorActivity {
  readonly slug: string;
  readonly programs: Partial<Record<VendorProgramSlug, ReadonlyArray<RawReceipt>>>;
}

const RAW: ReadonlyArray<RawVendorActivity> = [
  {
    slug: "openai",
    programs: {
      dragnet: [
        { phraseId: "openai-swift-falcon-3742", verdict: "amber", daysAgo: 1, summary: "GPT-4o probe pack vs. official pricing claim — 1 contradiction, 6 mirrors" },
        { phraseId: "openai-bright-eagle-1024", verdict: "red", daysAgo: 3, summary: "Context-window probe — model returned a 4K cutoff against advertised 128K" },
        { phraseId: "openai-quiet-otter-8810", verdict: "green", daysAgo: 7, summary: "Refusal-canon probe pack — 0 contradictions across 12 cycles" },
        { phraseId: "openai-amber-hawk-4501", verdict: "amber", daysAgo: 12, summary: "System-prompt leak probe — 1 contradiction (model named the prompt header)" },
      ],
      oath: [
        { phraseId: "openai-pearl-stork-2210", verdict: "red", daysAgo: 4, summary: "PluckOath/v1 verified — claim 'no training on user data' expired 3 days ago" },
        { phraseId: "openai-still-raven-7711", verdict: "green", daysAgo: 18, summary: "PluckOath/v1 re-verified — Origin matches body.vendor, all claims fresh" },
      ],
      fingerprint: [
        { phraseId: "openai-rapid-falcon-5512", verdict: "amber", daysAgo: 2, summary: "5-probe calibration set — drift score 0.18, classification: minor" },
        { phraseId: "openai-coastal-kestrel-6603", verdict: "red", daysAgo: 9, summary: "5-probe calibration set — drift score 0.71, classification: swap (silent model change)" },
        { phraseId: "openai-radiant-fox-3322", verdict: "green", daysAgo: 21, summary: "5-probe calibration set — drift score 0.04, classification: stable" },
      ],
      custody: [
        { phraseId: "openai-clear-heron-9914", verdict: "green", daysAgo: 6, summary: "CustodyBundle verified — Sigstore Rekor anchor present, all 7 checks pass" },
      ],
      nuclei: [
        { phraseId: "openai-eng-bold-marlin-1188", verdict: "green", daysAgo: 14, summary: "Pack 'alignment-probe@1.0' published, trustTier verified, SBOM-AI cross-ref OK" },
      ],
      mole: [
        { phraseId: "openai-lone-owl-4400", verdict: "amber", daysAgo: 25, summary: "Canary sealed for chat.openai.com — 2 fingerprint phrases registered, awaiting probe" },
      ],
    },
  },
  {
    slug: "anthropic",
    programs: {
      dragnet: [
        { phraseId: "anthropic-running-stork-9999", verdict: "green", daysAgo: 2, summary: "Claude Opus probe pack — 0 contradictions, 11 mirrors, 1 shadow" },
        { phraseId: "anthropic-quiet-elk-1212", verdict: "green", daysAgo: 8, summary: "Constitutional-AI claim probe — 0 contradictions across 9 cycles" },
        { phraseId: "anthropic-bright-wolf-3344", verdict: "amber", daysAgo: 15, summary: "Refusal-canon probe — 1 contradiction (Sonnet refused a published-allowed query)" },
      ],
      oath: [
        { phraseId: "anthropic-pearl-eagle-5566", verdict: "green", daysAgo: 5, summary: "PluckOath/v1 verified — all 8 claims active, expiry > 90 days" },
        { phraseId: "anthropic-still-fox-7788", verdict: "green", daysAgo: 22, summary: "PluckOath/v1 verified — Origin/vendor cross-check OK" },
      ],
      fingerprint: [
        { phraseId: "anthropic-radiant-otter-1100", verdict: "green", daysAgo: 4, summary: "5-probe calibration set — drift score 0.02, classification: stable" },
        { phraseId: "anthropic-coastal-jay-9988", verdict: "green", daysAgo: 17, summary: "5-probe calibration set — drift score 0.05, classification: stable" },
      ],
      custody: [
        { phraseId: "anthropic-deep-raven-2211", verdict: "green", daysAgo: 11, summary: "CustodyBundle verified — model-card attestation present, FRE 902(13) compliant" },
      ],
      nuclei: [
        { phraseId: "anthropic-research-amber-cobra-3303", verdict: "green", daysAgo: 19, summary: "Pack 'refusal-canon@0.3' published, trustTier verified" },
      ],
    },
  },
  {
    slug: "google",
    programs: {
      dragnet: [
        { phraseId: "google-fierce-leopard-2244", verdict: "amber", daysAgo: 3, summary: "Gemini 1.5 Pro probe — 2 contradictions on context-window claim" },
        { phraseId: "google-coastal-bobcat-5577", verdict: "green", daysAgo: 11, summary: "Search-grounding probe pack — 0 contradictions, 8 mirrors" },
        { phraseId: "google-amber-stag-6688", verdict: "red", daysAgo: 19, summary: "Pricing claim probe — 3 contradictions, vendor docs disagree with model output" },
      ],
      oath: [
        { phraseId: "google-still-pelican-1199", verdict: "amber", daysAgo: 6, summary: "PluckOath/v1 verified — 1 claim within 30 days of expiry" },
      ],
      fingerprint: [
        { phraseId: "google-rapid-marlin-3300", verdict: "amber", daysAgo: 2, summary: "5-probe calibration set — drift score 0.22, classification: minor" },
        { phraseId: "google-clear-buffalo-4422", verdict: "gray", daysAgo: 13, summary: "5-probe calibration set — partial response (rate-limited at probe 3)" },
      ],
      mole: [
        { phraseId: "google-lone-sparrow-7755", verdict: "green", daysAgo: 26, summary: "Canary sealed for ai.google.dev — 3 fingerprint phrases registered" },
      ],
    },
  },
  {
    slug: "meta",
    programs: {
      dragnet: [
        { phraseId: "meta-bold-wolf-1100", verdict: "green", daysAgo: 4, summary: "Llama 3 70B probe pack — 0 contradictions, 7 mirrors" },
        { phraseId: "meta-quiet-bear-2233", verdict: "amber", daysAgo: 14, summary: "License-claim probe — 1 contradiction on commercial-use threshold" },
      ],
      fingerprint: [
        { phraseId: "meta-stable-eagle-5544", verdict: "green", daysAgo: 7, summary: "5-probe calibration set on Llama 3 — drift score 0.03, classification: stable" },
      ],
      nuclei: [
        { phraseId: "meta-ai-bright-stag-9911", verdict: "green", daysAgo: 16, summary: "Pack 'llama-canon@0.2' published, trustTier verified" },
      ],
      custody: [
        { phraseId: "meta-deep-condor-3344", verdict: "green", daysAgo: 23, summary: "CustodyBundle verified — Llama 3 model-card with full attestation chain" },
      ],
    },
  },
  {
    slug: "mistral",
    programs: {
      dragnet: [
        { phraseId: "mistral-swift-cheetah-7700", verdict: "green", daysAgo: 5, summary: "Mixtral 8x22B probe — 0 contradictions, 5 mirrors, 2 shadows" },
        { phraseId: "mistral-amber-hawk-1133", verdict: "amber", daysAgo: 17, summary: "Multilingual-claim probe — 1 contradiction (de-DE refusal)" },
      ],
      oath: [
        { phraseId: "mistral-still-raven-2244", verdict: "green", daysAgo: 8, summary: "PluckOath/v1 verified — Origin/vendor cross-check OK, 6 active claims" },
      ],
      fingerprint: [
        { phraseId: "mistral-rapid-otter-5577", verdict: "green", daysAgo: 12, summary: "5-probe calibration set — drift score 0.06, classification: stable" },
      ],
      nuclei: [
        { phraseId: "mistral-eng-bold-falcon-8800", verdict: "green", daysAgo: 20, summary: "Pack 'mistral-grounding@0.1' published, trustTier verified" },
      ],
    },
  },
  {
    slug: "cohere",
    programs: {
      dragnet: [
        { phraseId: "cohere-clear-finch-1188", verdict: "green", daysAgo: 6, summary: "Command R+ probe pack — 0 contradictions, 9 mirrors" },
        { phraseId: "cohere-bright-jay-3399", verdict: "amber", daysAgo: 18, summary: "RAG-citation probe — 1 contradiction on cited-source recall" },
      ],
      oath: [
        { phraseId: "cohere-pearl-eagle-5566", verdict: "green", daysAgo: 9, summary: "PluckOath/v1 verified — 5 active claims, all > 60 days from expiry" },
      ],
      fingerprint: [
        { phraseId: "cohere-coastal-bear-7788", verdict: "green", daysAgo: 15, summary: "5-probe calibration set — drift score 0.04, classification: stable" },
      ],
      custody: [
        { phraseId: "cohere-deep-stork-2244", verdict: "green", daysAgo: 22, summary: "CustodyBundle verified — Embed-v3 model-card attestation OK" },
      ],
    },
  },
  {
    slug: "perplexity",
    programs: {
      dragnet: [
        { phraseId: "perplexity-fierce-marlin-3300", verdict: "amber", daysAgo: 4, summary: "Sonar Large probe pack — 2 contradictions on cited-source freshness" },
        { phraseId: "perplexity-coastal-shark-5511", verdict: "red", daysAgo: 13, summary: "Search-grounding probe — 4 contradictions, citations did not match served URL" },
      ],
      oath: [
        { phraseId: "perplexity-still-falcon-1100", verdict: "amber", daysAgo: 7, summary: "PluckOath/v1 verified — 2 claims within 14 days of expiry" },
      ],
      fingerprint: [
        { phraseId: "perplexity-rapid-bobcat-9988", verdict: "amber", daysAgo: 10, summary: "5-probe calibration set — drift score 0.25, classification: minor" },
      ],
      mole: [
        { phraseId: "perplexity-lone-owl-4422", verdict: "green", daysAgo: 24, summary: "Canary sealed for perplexity.ai — 4 fingerprint phrases registered" },
      ],
    },
  },
  {
    slug: "deepseek",
    programs: {
      dragnet: [
        { phraseId: "deepseek-quiet-tiger-2200", verdict: "green", daysAgo: 5, summary: "DeepSeek-V3 probe pack — 0 contradictions, 10 mirrors" },
        { phraseId: "deepseek-bold-wolf-7711", verdict: "amber", daysAgo: 16, summary: "Reasoning-trace probe — 1 contradiction on R1 chain-of-thought claim" },
      ],
      fingerprint: [
        { phraseId: "deepseek-rapid-eagle-5544", verdict: "amber", daysAgo: 8, summary: "5-probe calibration set — drift score 0.19, classification: minor" },
      ],
      nuclei: [
        { phraseId: "deepseek-eng-amber-jay-3322", verdict: "gray", daysAgo: 19, summary: "Pack 'deepseek-reasoning@0.1' published, trustTier ingested (no SBOM-AI cross-ref)" },
      ],
    },
  },
  {
    slug: "xai",
    programs: {
      dragnet: [
        { phraseId: "xai-fierce-cheetah-1199", verdict: "red", daysAgo: 2, summary: "Grok 2 probe pack — 5 contradictions on real-time-data freshness claim" },
        { phraseId: "xai-amber-stag-4433", verdict: "amber", daysAgo: 11, summary: "Refusal-canon probe — 2 contradictions on platform-policy edge cases" },
        { phraseId: "xai-coastal-hawk-8800", verdict: "amber", daysAgo: 21, summary: "Citation probe — 1 contradiction on sourced X-post recall" },
      ],
      oath: [
        { phraseId: "xai-still-condor-3344", verdict: "gray", daysAgo: 6, summary: "PluckOath/v1 fetch — /.well-known/pluck-oath.json not found at api.x.ai" },
      ],
      fingerprint: [
        { phraseId: "xai-rapid-bobcat-5566", verdict: "amber", daysAgo: 14, summary: "5-probe calibration set — drift score 0.31, classification: minor" },
      ],
    },
  },
  {
    slug: "microsoft",
    programs: {
      dragnet: [
        { phraseId: "microsoft-clear-heron-2233", verdict: "green", daysAgo: 7, summary: "Copilot probe pack — 0 contradictions, 8 mirrors, 1 shadow" },
        { phraseId: "microsoft-amber-finch-7788", verdict: "amber", daysAgo: 18, summary: "Azure-OpenAI parity probe — 1 contradiction on regional-rollout claim" },
      ],
      oath: [
        { phraseId: "microsoft-pearl-eagle-1144", verdict: "green", daysAgo: 4, summary: "PluckOath/v1 verified — 7 active claims, all fresh" },
      ],
      fingerprint: [
        { phraseId: "microsoft-coastal-otter-5599", verdict: "green", daysAgo: 12, summary: "5-probe calibration set on Phi-4 — drift score 0.07, classification: stable" },
        { phraseId: "microsoft-rapid-jay-3322", verdict: "green", daysAgo: 25, summary: "5-probe calibration set on Copilot — drift score 0.08, classification: stable" },
      ],
      custody: [
        { phraseId: "microsoft-deep-marlin-9911", verdict: "green", daysAgo: 9, summary: "CustodyBundle verified — Azure-OpenAI deployment manifest attestation OK" },
      ],
    },
  },
];

const PROGRAM_ORDER: ReadonlyArray<VendorProgramSlug> = [
  "dragnet",
  "oath",
  "fingerprint",
  "custody",
  "nuclei",
  "mole",
];

function buildPreview(raw: RawVendorActivity): VendorPreviewActivity {
  const programs: VendorProgramActivity[] = [];
  let total = 0;
  const breakdown = { green: 0, amber: 0, red: 0, gray: 0 };

  for (const programSlug of PROGRAM_ORDER) {
    const rawReceipts = raw.programs[programSlug];

    if (!rawReceipts || rawReceipts.length === 0) {
      continue;
    }
    const receipts: VendorReceipt[] = rawReceipts.map((r) => ({
      phraseId: r.phraseId,
      verdict: r.verdict,
      capturedAt: daysAgo(r.daysAgo, r.hour ?? 12),
      summary: r.summary,
    }));

    // Sort newest first within each program section.
    receipts.sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
    programs.push({ programSlug, receipts });
    total += receipts.length;
    for (const r of receipts) {
      breakdown[r.verdict] += 1;
    }
  }

  return {
    slug: raw.slug,
    programs,
    totalReceipts: total,
    verdictBreakdown: breakdown,
  };
}

const PREVIEWS: ReadonlyMap<string, VendorPreviewActivity> = new Map(
  RAW.map((r) => [r.slug, buildPreview(r)]),
);

/**
 * Look up the preview activity for a vendor slug. Returns null when the
 * vendor isn't covered yet — callers should pair this with the
 * vendor-registry allowlist (notFound() applies first).
 */
export function getVendorPreview(slug: string): VendorPreviewActivity | null {
  return PREVIEWS.get(slug.toLowerCase()) ?? null;
}

/** Latest activity across all programs (for last-updated UI). */
export function lastUpdatedAt(activity: VendorPreviewActivity): Date | null {
  let latest: Date | null = null;

  for (const program of activity.programs) {
    for (const receipt of program.receipts) {
      if (latest === null || receipt.capturedAt > latest) {
        latest = receipt.capturedAt;
      }
    }
  }

  return latest;
}

/**
 * The frozen "now" the preview activity is anchored against. Exported
 * so the renderer can compute relative timestamps consistently with
 * the data — when /v1/runs lands and we drop the preview anchor, this
 * goes away too.
 */
export const PREVIEW_NOW = PREVIEW_ANCHOR;
