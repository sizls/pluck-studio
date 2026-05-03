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
 * True when `s` matches the phrase-id shape. UUIDs and other strings
 * never match. Used by the receipt route to distinguish phrase-id
 * lookups from raw UUID lookups.
 */
export function isPhraseId(s: string): boolean {
  return PHRASE_PATTERN.test(s);
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  // Browser / edge runtime
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(out);
    return out;
  }
  // Node — defer require so this module stays edge-safe; the sync require
  // is the canonical Next.js Route Handler pattern for opt-in node APIs.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodeCrypto = require("node:crypto") as {
      randomBytes(n: number): Uint8Array;
    };
    return nodeCrypto.randomBytes(n);
  } catch {
    // Non-cryptographic fallback. Phrase IDs are labels, not secrets.
    for (let i = 0; i < n; i++) {
      out[i] = Math.floor(Math.random() * 256);
    }
    return out;
  }
}

export const PHRASE_ID_VOCAB_SIZE = ADJECTIVES.length * ANIMALS.length * 10_000;
