// ---------------------------------------------------------------------------
// Bureau program activation registry
// ---------------------------------------------------------------------------
//
// Single source of truth for "which Bureau programs are wired through
// the Studio activation pattern, and what's the CTA + summary for each."
// Consumed by:
//   - /runs (the cross-program hub)
//   - /bureau (the program library)
//   - any future program-pickers / search surfaces
//
// New programs land here when their `/run` route ships. Programs that
// don't fit the activation pattern (TRIPWIRE continuous interceptor,
// MOLE continuous detection) should NOT be in this registry — they get
// listed under "coming soon" with a different shape.
// ---------------------------------------------------------------------------

export interface ActiveProgram {
  /** Slug — matches the URL prefix. */
  slug: string;
  /** Program name (canonical, ALL CAPS). */
  name: string;
  /** Verb used in the action button. */
  actionVerb: string;
  /** One-sentence summary suitable for a card subtitle. */
  summary: string;
  /** What the receipt shape is in plain English. */
  outputShape: string;
  /** Predicate URI of the signed envelope. */
  predicateUri: string;
  /** Path the activation form lives at. */
  runPath: string;
  /** Path the program landing lives at. */
  landingPath: string;
}

export const ACTIVE_PROGRAMS: ReadonlyArray<ActiveProgram> = [
  {
    slug: "dragnet",
    name: "DRAGNET",
    actionVerb: "Run a probe-pack",
    summary:
      "Run a signed probe-pack against an AI-vendor target endpoint. Every contradiction lands as a public red dot.",
    outputShape:
      "classification counts (contradict / mirror / shadow / snare) + per-cycle TimelineDot color",
    predicateUri: "https://pluck.run/DragnetCycle/v1",
    runPath: "/bureau/dragnet/run",
    landingPath: "/bureau/dragnet",
  },
  {
    slug: "oath",
    name: "OATH",
    actionVerb: "Verify an oath",
    summary:
      "Fetch + verify a vendor's `/.well-known/pluck-oath.json`. Cross-checks served Origin against body's `vendor` field.",
    outputShape:
      "verdict (verified / oath-expired / did-not-commit / signature-failed / origin-mismatch / not-found / fetch-failed) + per-claim list",
    predicateUri: "https://pluck.run/PluckOath/v1",
    runPath: "/bureau/oath/run",
    landingPath: "/bureau/oath",
  },
  {
    slug: "fingerprint",
    name: "FINGERPRINT",
    actionVerb: "Scan a target",
    summary:
      "Run the 5-probe calibration set against a vendor's model. Detects silent model swaps via fingerprint hash divergence.",
    outputShape:
      "drift classification (stable / minor / major / swap) + drift score + per-probe responses + cassette `local:<sha256>`",
    predicateUri: "https://pluck.run/ModelFingerprint/v1",
    runPath: "/bureau/fingerprint/run",
    landingPath: "/bureau/fingerprint",
  },
  {
    slug: "custody",
    name: "CUSTODY",
    actionVerb: "Verify a bundle",
    summary:
      "Fetch + verify a CustodyBundle URL server-side. Emits a Sigstore-Rekor-anchored FRE 902(13) compliance verdict.",
    outputShape:
      "binary verdict (compliant / 7 named failure modes) + per-check breakdown + WebAuthn attestation summary",
    predicateUri: "https://pluck.run/CustodyBundle/v1",
    runPath: "/bureau/custody/run",
    landingPath: "/bureau/custody",
  },
];

/**
 * Programs that have a landing page but don't yet fit the activation
 * pattern (continuous interceptors, registries, etc). Listed on the
 * /runs hub under "Coming soon" so operators can see the full
 * roadmap from one screen.
 */
export interface ComingSoonProgram {
  slug: string;
  name: string;
  /** Why this isn't yet wired through the activation pattern. */
  reason: string;
  landingPath: string;
}

export const COMING_SOON_PROGRAMS: ReadonlyArray<ComingSoonProgram> = [
  {
    slug: "tripwire",
    name: "TRIPWIRE",
    reason:
      "Continuous JS-layer interceptor — needs a key-issuance flow + live attestation feed (different scaffolding from one-shot activation).",
    landingPath: "/bureau/tripwire",
  },
  {
    slug: "nuclei",
    name: "NUCLEI",
    reason:
      "Probe-pack registry — browse + fork, not activate. Surfaces under DRAGNET as the pack source.",
    landingPath: "/bureau/nuclei",
  },
  {
    slug: "mole",
    name: "MOLE",
    reason:
      "Continuous insider-leak detection — long-running monitor, not a one-shot run.",
    landingPath: "/bureau/mole",
  },
  {
    slug: "whistle",
    name: "WHISTLE",
    reason:
      "Anonymous tip-submission — capture pattern (multi-select routing partners + pasted bundle + manual redaction) needs distinct form scaffolding.",
    landingPath: "/bureau/whistle",
  },
  {
    slug: "bounty",
    name: "BOUNTY",
    reason:
      "Vendor-honesty bounty filing — submission shape similar to WHISTLE but with structured evidence + bounty-amount fields.",
    landingPath: "/bureau/bounty",
  },
  {
    slug: "sbom-ai",
    name: "SBOM-AI",
    reason:
      "AI-generated content detection over a content sample. Fits activation pattern; queued behind the existing 4.",
    landingPath: "/bureau/sbom-ai",
  },
  {
    slug: "rotate",
    name: "ROTATE",
    reason:
      "Operator key-rotation ceremony — single-shot but interactive (passkey re-auth required); fits activation pattern with care.",
    landingPath: "/bureau/rotate",
  },
];
