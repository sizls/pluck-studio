// ---------------------------------------------------------------------------
// Phrase IDs — memorable run identifiers
// ---------------------------------------------------------------------------
//
// Every receipt URL ever shared from Studio inherits this format. Heroku
// taught the world that `falling-tree-7842` beats `0c2d8a4e-...` every
// time a URL gets pasted into a tweet, a DM, an email subject. We adopt
// the same shape for DRAGNET runs.
//
// Format: `<adjective>-<animal>-<NNNN>`
//   - Adjective list: 80 words, neutral, content-pure (no profanity, no
//     loaded sentiment, no political/religious/protected-class terms).
//   - Animal list: 80 words, common nouns, no fictional creatures.
//   - 4-digit number: 0000-9999, included for collision avoidance.
//
// Total combinations: 80 × 80 × 10_000 = 64M. At 10k runs/day, expected
// time-to-collision is ~14 years; we add a per-run-id collision-detect
// retry on the database side anyway.
//
// The phrase is the canonical user-facing ID. The internal UUID is kept
// for cross-system joins (Rekor, Kite event log, Supabase rows). Both
// `/runs/{phrase}` and `/runs/{uuid}` resolve to the same record.
// ---------------------------------------------------------------------------

const ADJECTIVES = [
  "amber",
  "arctic",
  "azure",
  "bold",
  "brave",
  "bright",
  "calm",
  "candid",
  "clear",
  "clever",
  "coastal",
  "copper",
  "crisp",
  "dawn",
  "deep",
  "dewy",
  "distant",
  "dusty",
  "eager",
  "early",
  "earnest",
  "echoing",
  "evening",
  "fierce",
  "first",
  "flint",
  "forest",
  "fresh",
  "frozen",
  "gentle",
  "glacial",
  "golden",
  "graceful",
  "harvest",
  "hidden",
  "jade",
  "lively",
  "lone",
  "lucid",
  "lunar",
  "marble",
  "midnight",
  "morning",
  "northern",
  "open",
  "patient",
  "pearl",
  "pine",
  "polar",
  "prairie",
  "prompt",
  "quiet",
  "radiant",
  "rapid",
  "ready",
  "rolling",
  "ruby",
  "running",
  "sable",
  "salt",
  "scarlet",
  "silent",
  "silver",
  "slate",
  "smooth",
  "solar",
  "spry",
  "steady",
  "still",
  "stone",
  "summer",
  "sunny",
  "swift",
  "tall",
  "twilight",
  "valiant",
  "vivid",
  "wandering",
  "winter",
  "young",
] as const;

const ANIMALS = [
  "albatross",
  "antelope",
  "badger",
  "bear",
  "beaver",
  "bison",
  "boar",
  "bobcat",
  "buck",
  "buffalo",
  "camel",
  "caribou",
  "cheetah",
  "cobra",
  "condor",
  "cougar",
  "coyote",
  "crane",
  "deer",
  "dolphin",
  "dove",
  "dragonfly",
  "eagle",
  "egret",
  "elk",
  "falcon",
  "ferret",
  "finch",
  "fox",
  "frog",
  "gazelle",
  "goat",
  "goose",
  "hawk",
  "heron",
  "hippo",
  "hornet",
  "horse",
  "ibex",
  "ibis",
  "jaguar",
  "jay",
  "kestrel",
  "kingfisher",
  "koala",
  "leopard",
  "lion",
  "lynx",
  "mallard",
  "marlin",
  "marmot",
  "marten",
  "moose",
  "narwhal",
  "ocelot",
  "orca",
  "osprey",
  "otter",
  "owl",
  "panda",
  "pelican",
  "penguin",
  "pheasant",
  "puma",
  "quail",
  "raccoon",
  "raven",
  "robin",
  "salmon",
  "seal",
  "shark",
  "sparrow",
  "stag",
  "stingray",
  "stork",
  "tiger",
  "trout",
  "walrus",
  "whale",
  "wolf",
] as const;

const PHRASE_PATTERN = /^[a-z]+-[a-z]+-\d{4}$/;
const SCOPED_PHRASE_PATTERN = /^[a-z0-9]+-[a-z]+-[a-z]+-\d{4}$/;

/**
 * Generate a memorable phrase ID from a CSPRNG-backed source.
 *
 * @param source — three uniformly-random bytes drawn from a CSPRNG. The
 *                 caller passes them in so this function is deterministic
 *                 + side-effect-free, easier to test, and reusable from
 *                 environments without `crypto.getRandomValues`.
 *
 * Returns e.g. `"swift-falcon-3742"`.
 */
export function phraseFromBytes(
  adjectiveByte: number,
  animalByte: number,
  numberWord: number,
): string {
  const adjective = ADJECTIVES[adjectiveByte % ADJECTIVES.length];
  const animal = ANIMALS[animalByte % ANIMALS.length];
  const number = (numberWord % 10_000).toString().padStart(4, "0");

  return `${adjective}-${animal}-${number}`;
}

/**
 * Generate a phrase ID using a CSPRNG when available. Server-side this
 * uses `node:crypto.randomBytes`; client-side it uses
 * `crypto.getRandomValues`. Falls back to `Math.random` ONLY when
 * neither exists (the only realistic case being an antique non-secure
 * context — the phrase ID is not a security primitive, just a label).
 */
export function generatePhraseId(): string {
  const bytes = randomBytes(4);
  const adj = bytes[0] ?? 0;
  const ani = bytes[1] ?? 0;
  // Combine bytes 2+3 into a 16-bit number for the 0000-9999 slot.
  const num = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);

  return phraseFromBytes(adj, ani, num);
}

/**
 * Generate a vendor-scoped phrase ID: `<vendor>-<adjective>-<animal>-<NNNN>`.
 * The vendor prefix is derived from the URL's hostname (registered domain
 * label), so a probe against `https://api.openai.com/v1/...` yields
 * `openai-swift-falcon-3742`. Self-discloses the target inside the URL
 * — a Bureau practitioner can read the receipt URL alone and know who
 * was probed without opening the page.
 *
 * Falls back to `unknown-...` when the URL is unparseable or the host
 * doesn't have a sensible label (e.g. raw IP). A vendor prefix is
 * lowercased and stripped to `[a-z0-9]+`; longer than 16 chars truncates.
 */
export function generateScopedPhraseId(targetUrl: string): string {
  const phrase = generatePhraseId();
  const vendor = vendorSlugFromUrl(targetUrl);

  return `${vendor}-${phrase}`;
}

/**
 * Extract a short vendor slug from a target URL hostname. Best-effort:
 * keeps the last meaningful label before the public-suffix tail. Caller
 * gets `"unknown"` for unparseable input.
 */
export function vendorSlugFromUrl(targetUrl: string): string {
  let host: string;
  try {
    host = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    return "unknown";
  }
  if (host.length === 0) {
    return "unknown";
  }
  // Strip leading "www." / "api." / "app." / "console." / "dashboard."
  // — these are infrastructure labels, not the brand name.
  const stripped = host.replace(
    /^(www|api|app|console|dashboard|ai|chat|platform|developer|developers)\./,
    "",
  );
  const labels = stripped.split(".");
  // For a domain like `openai.com`, labels = ["openai", "com"]; we want
  // `labels[0]`. For `models.openai.com` after strip = `openai.com`.
  // For raw IPv4 (`10.0.0.1` after strip), we get a numeric first label
  // that's not a useful vendor name — fall back to "unknown".
  const first = labels[0] ?? "";

  if (first.length === 0 || /^\d+$/.test(first)) {
    return "unknown";
  }
  const slug = first.replace(/[^a-z0-9]/g, "");

  if (slug.length === 0) {
    return "unknown";
  }
  return slug.slice(0, 16);
}

/**
 * True when `s` matches the phrase-id shape (bare or vendor-scoped).
 * UUIDs and other strings never match. Used by the receipt route to
 * distinguish phrase-id lookups from raw UUID lookups.
 */
export function isPhraseId(s: string): boolean {
  return PHRASE_PATTERN.test(s) || SCOPED_PHRASE_PATTERN.test(s);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when `s` is a canonical RFC 4122 UUID. */
export function isUuid(s: string): boolean {
  return UUID_PATTERN.test(s);
}

/**
 * Extract the vendor slug from a vendor-scoped phrase ID
 * (`vendor-adj-noun-NNNN`). Returns null for bare phrase IDs (R1
 * format), UUIDs, or anything malformed. Lifted out of the OG image
 * route so the receipt view, share-card metadata, and any future
 * consumer share one source of truth.
 */
export function vendorFromPhrase(id: string): string | null {
  if (!SCOPED_PHRASE_PATTERN.test(id)) {
    return null;
  }
  const parts = id.split("-");
  if (parts.length !== 4) {
    return null;
  }
  const slug = parts[0];

  return slug && slug.length > 0 ? slug : null;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // Edge runtime, browser, and Node 20+ all expose
  // `globalThis.crypto.getRandomValues`. We deliberately avoid
  // `require("node:crypto")` so the module stays edge-safe (the OG
  // image route at /bureau/dragnet/runs/[id]/opengraph-image.tsx runs
  // under `runtime = "edge"` and webpack rejects node:crypto there).
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(out);
    return out;
  }
  // Non-cryptographic fallback. Phrase IDs are labels, not secrets.
  for (let i = 0; i < n; i++) {
    out[i] = Math.floor(Math.random() * 256);
  }
  return out;
}

export const PHRASE_ID_VOCAB_SIZE = ADJECTIVES.length * ANIMALS.length * 10_000;

// ---------------------------------------------------------------------------
// Phrase-ID decomposition
// ---------------------------------------------------------------------------
//
// Used by /search to fan out from one phrase ID to every related receipt
// across all 11 programs. The 4-part scoped form
// (`<scope>-<adj>-<noun>-<NNNN>`) is the canonical decomposable shape.
// The 3-part bare form (`<adj>-<noun>-<NNNN>`) is grandfathered: still
// parseable but yields an empty scope (search treats those as
// scope-less).
// ---------------------------------------------------------------------------

export interface ParsedPhraseId {
  /** Lowercased + trimmed input. */
  readonly normalized: string;
  /** True when input matches the canonical 4-part scoped shape. */
  readonly valid: boolean;
  /** Scope label (e.g. "openai", "hackerone", "compromised"); "" for bare. */
  readonly scope: string;
  readonly adjective: string;
  readonly noun: string;
  /** 4-digit collision-avoidance serial; "" when unparseable. */
  readonly serial: string;
  /** Reason the input is invalid; null when valid. */
  readonly error: string | null;
}

/**
 * Decompose a phrase ID into its (scope, adjective, noun, serial) parts.
 *
 * Accepts only the 4-part scoped form as `valid` — that's the
 * canonical shape every shipped Bureau program emits. The 3-part bare
 * form is parsed (callers can still display the parts) but flagged
 * invalid so search refuses to fan out on a scope-less phrase.
 *
 * Pure + side-effect-free — never reads global state, never throws.
 */
export function parsePhraseId(input: string): ParsedPhraseId {
  const normalized = (input ?? "").trim().toLowerCase();

  if (normalized.length === 0) {
    return {
      normalized,
      valid: false,
      scope: "",
      adjective: "",
      noun: "",
      serial: "",
      error: "Phrase ID is empty.",
    };
  }

  if (SCOPED_PHRASE_PATTERN.test(normalized)) {
    const parts = normalized.split("-");
    const [scope, adjective, noun, serial] = parts;

    return {
      normalized,
      valid: true,
      scope: scope ?? "",
      adjective: adjective ?? "",
      noun: noun ?? "",
      serial: serial ?? "",
      error: null,
    };
  }

  if (PHRASE_PATTERN.test(normalized)) {
    const [adjective, noun, serial] = normalized.split("-");

    return {
      normalized,
      valid: false,
      scope: "",
      adjective: adjective ?? "",
      noun: noun ?? "",
      serial: serial ?? "",
      error:
        "Bare 3-part phrase ID — search needs the scoped form (`<scope>-<adj>-<noun>-<NNNN>`).",
    };
  }

  return {
    normalized,
    valid: false,
    scope: "",
    adjective: "",
    noun: "",
    serial: "",
    error: `Phrase IDs follow \`<scope>-<adj>-<noun>-<NNNN>\` format. Got: ${normalized}`,
  };
}
