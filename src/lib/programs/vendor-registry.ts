// ---------------------------------------------------------------------------
// vendor-registry — curated allowlist of vendor profiles
// ---------------------------------------------------------------------------
//
// Vetted-allowlist gate for /vendor/<slug>. Only the slugs listed here
// render a public profile page; every other slug returns notFound().
// This is the R3-deferred "vetted allowlist" item, pulled forward as
// part of the Vendor Honesty Index keystone — public per-vendor URLs
// must NEVER render arbitrary attacker-supplied slugs.
//
// New vendors land here when there's enough cross-program activity to
// justify a permanent profile. The 1-line description is rendered as
// the SEO meta description on the per-vendor page; keep it factual and
// non-pejorative regardless of how the vendor performs in receipts.
// ---------------------------------------------------------------------------

export interface VendorEntry {
  /** URL slug — lowercased, [a-z0-9-]+. */
  readonly slug: string;
  /** Display name (canonical brand presentation). */
  readonly displayName: string;
  /** SEO-grade single-line description. */
  readonly description: string;
}

export const VENDOR_REGISTRY: ReadonlyArray<VendorEntry> = [
  {
    slug: "openai",
    displayName: "OpenAI",
    description:
      "OpenAI publishes ChatGPT, GPT-4, GPT-4o, and the o-series reasoning models behind the api.openai.com endpoints.",
  },
  {
    slug: "anthropic",
    displayName: "Anthropic",
    description:
      "Anthropic publishes Claude (Opus, Sonnet, Haiku) under the constitutional-AI alignment program at api.anthropic.com.",
  },
  {
    slug: "google",
    displayName: "Google AI",
    description:
      "Google AI publishes the Gemini family (Pro, Flash, Ultra) and Vertex AI managed-model surface across generativelanguage.googleapis.com.",
  },
  {
    slug: "meta",
    displayName: "Meta AI",
    description:
      "Meta AI publishes the Llama family of open-weight foundation models (Llama 2, Llama 3, Llama 4) under the Llama Community License.",
  },
  {
    slug: "mistral",
    displayName: "Mistral AI",
    description:
      "Mistral AI publishes Mistral and Mixtral open-weight models alongside the hosted la Plateforme API.",
  },
  {
    slug: "cohere",
    displayName: "Cohere",
    description:
      "Cohere publishes the Command and Embed models for retrieval-augmented enterprise applications via api.cohere.com.",
  },
  {
    slug: "perplexity",
    displayName: "Perplexity",
    description:
      "Perplexity publishes a search-grounded answer engine and the Sonar model family at api.perplexity.ai.",
  },
  {
    slug: "deepseek",
    displayName: "DeepSeek",
    description:
      "DeepSeek publishes open-weight reasoning and code models (DeepSeek-V3, DeepSeek-R1) via api.deepseek.com.",
  },
  {
    slug: "xai",
    displayName: "xAI",
    description:
      "xAI publishes Grok, the model family integrated with X (formerly Twitter) and exposed at api.x.ai.",
  },
  {
    slug: "microsoft",
    displayName: "Microsoft",
    description:
      "Microsoft publishes Copilot, Azure OpenAI deployments, and the Phi small-model family at azure.microsoft.com.",
  },
];

/**
 * Quick lookup for a vendor entry by slug. Returns null for any slug
 * not in the curated allowlist. Vendor profile routes MUST treat null
 * as `notFound()` — never render an unvetted slug.
 */
export function lookupVendor(slug: string): VendorEntry | null {
  const normalized = slug.toLowerCase();
  const match = VENDOR_REGISTRY.find((v) => v.slug === normalized);

  return match ?? null;
}

/** Slugs only, useful for `generateStaticParams` and tests. */
export function listVendorSlugs(): ReadonlyArray<string> {
  return VENDOR_REGISTRY.map((v) => v.slug);
}
