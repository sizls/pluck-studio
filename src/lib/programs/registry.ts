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
  /**
   * Hex accent color used wherever the program is rendered as a label
   * or section heading (e.g. the Vendor Honesty Index profile page).
   * Matches the program's existing brand color on its landing page.
   */
  accent: string;
  /**
   * `true` when the program's phrase-ID schema surfaces a vendor
   * identity — these are the programs that feed the Vendor Honesty
   * Index. DRAGNET / OATH / FINGERPRINT / CUSTODY / NUCLEI / MOLE.
   * `false` when the program deliberately refuses to carry vendor
   * identity (WHISTLE routing-partner-not-source, BOUNTY platform,
   * SBOM-AI artifact-kind, ROTATE rotation-reason, TRIPWIRE machine-id).
   */
  vendorBearing: boolean;
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
    accent: "#a3201d",
    vendorBearing: true,
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
    accent: "#a78a1f",
    vendorBearing: true,
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
    accent: "#a3208a",
    vendorBearing: true,
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
    accent: "#1f7a3a",
    vendorBearing: true,
  },
  {
    slug: "whistle",
    name: "WHISTLE",
    actionVerb: "Submit a tip",
    summary:
      "Anonymous AI whistleblower submission. Layered redaction + ephemeral signing key + routing to a newsroom partner (ProPublica / Bellingcat / 404 Media / EFF Press).",
    outputShape:
      "binary verdict (accepted / 5 named failure modes) + per-layer redaction summary + per-partner delivery status",
    predicateUri: "https://pluck.run/WhistleSubmission/v1",
    runPath: "/bureau/whistle/run",
    landingPath: "/bureau/whistle",
    accent: "#a3201d",
    vendorBearing: false,
  },
  {
    slug: "bounty",
    name: "BOUNTY",
    actionVerb: "File a bounty",
    summary:
      "Autonomous HackerOne / Bugcrowd filer. Wraps a DRAGNET red dot, FINGERPRINT delta, or MOLE verdict into an EvidencePacket and dispatches to the platform; auth tokens stay local.",
    outputShape:
      "verdict (filed / rate-limited / platform-rejected / source-not-found / source-malformed / dispatch-failed) + platform submission ID + bounty amount when claimed",
    predicateUri: "https://pluck.run/BountySubmission/v1",
    runPath: "/bureau/bounty/run",
    landingPath: "/bureau/bounty",
    accent: "#1f7a3a",
    vendorBearing: false,
  },
  {
    slug: "sbom-ai",
    name: "SBOM-AI",
    actionVerb: "Publish provenance",
    summary:
      "Sigstore-anchored AI supply-chain registry. Publish an in-toto attestation for a probe-pack, model card, or MCP-server tarball — consumers verify provenance before running anything.",
    outputShape:
      "binary verdict (published / 5 named failure modes) + canonical sha256 digest + per-kind predicate URI",
    predicateUri: "https://pluck.run/SbomAi/ProbePack/v1",
    runPath: "/bureau/sbom-ai/run",
    landingPath: "/bureau/sbom-ai",
    accent: "#3a7aa3",
    vendorBearing: false,
  },
  {
    slug: "rotate",
    name: "ROTATE",
    actionVerb: "Rotate a key",
    summary:
      "Signing-key compromise response. Publishes KeyRevocation/v1 signed by the old key + ReWitnessReport/v1 signed by the new key annotating prior cassettes. Trust invalidation, NOT crypto-shred.",
    outputShape:
      "verdict (rotated / old-key-already-revoked / 4 named failure modes) + count of re-witnessed prior cassettes",
    predicateUri: "https://pluck.run/KeyRevocation/v1",
    runPath: "/bureau/rotate/run",
    landingPath: "/bureau/rotate",
    accent: "#a78a1f",
    vendorBearing: false,
  },
  {
    slug: "tripwire",
    name: "TRIPWIRE",
    actionVerb: "Configure a tripwire",
    summary:
      "JS-layer interceptor for outbound LLM traffic. Studio issues a signed TripwirePolicy/v1 + install snippet + ingestion endpoint per dev machine; intercepted bodies stay local unless notarize is on.",
    outputShape:
      "configuration verdict (configured / machine-already-active / 3 named failure modes) + signed policy + install snippet",
    predicateUri: "https://pluck.run/TripwirePolicy/v1",
    runPath: "/bureau/tripwire/run",
    landingPath: "/bureau/tripwire",
    accent: "#a3201d",
    vendorBearing: false,
  },
  {
    slug: "nuclei",
    name: "NUCLEI",
    actionVerb: "Publish to registry",
    summary:
      "Signed probe-pack registry — authors publish NucleiPackEntry/v1 wrappers around SBOM-AI-attested packs. Trust model is TOFU: every entry MUST cross-reference an SBOM-AI Rekor uuid or consumers refuse to honor it.",
    outputShape:
      "verdict (published / 5 named failure modes) + trustTier (verified vs ingested) + canonical pack-entry URL",
    predicateUri: "https://pluck.run/NucleiPackEntry/v1",
    runPath: "/bureau/nuclei/run",
    landingPath: "/bureau/nuclei",
    accent: "#9b59b6",
    vendorBearing: true,
  },
  {
    slug: "mole",
    name: "MOLE",
    actionVerb: "Seal a canary",
    summary:
      "Adversarial training-data extraction. Operator seals a canary BEFORE probing — Rekor timestamp predates any probe-run, so vendors can't claim 'we trained on it AFTER the seal.' Canary body stays with the operator.",
    outputShape:
      "binary verdict (sealed / 4 named failure modes) + sha256 + fingerprint phrases (canary body NEVER published)",
    predicateUri: "https://pluck.run/CanaryDocument/v1",
    runPath: "/bureau/mole/run",
    landingPath: "/bureau/mole",
    accent: "#b8941f",
    vendorBearing: true,
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

export const COMING_SOON_PROGRAMS: ReadonlyArray<ComingSoonProgram> = [];

/**
 * The active programs whose receipts surface a vendor identity.
 * These flow into the Vendor Honesty Index. Order matches the order of
 * `ACTIVE_PROGRAMS` so the per-vendor profile sections render in a
 * stable, registry-driven sequence — adding a new vendor-bearing
 * program is a one-line registry change.
 */
export const VENDOR_BEARING_PROGRAMS: ReadonlyArray<ActiveProgram> =
  ACTIVE_PROGRAMS.filter((p) => p.vendorBearing);

// ---------------------------------------------------------------------------
// Phrase-ID prefix conventions
// ---------------------------------------------------------------------------
//
// Documented invariant — for cross-program consistency. Each program
// generates a phrase-ID for its receipt URL; the human-readable prefix
// of that phrase-ID encodes provenance/context. The choice of prefix
// is load-bearing for privacy and UX:
//
//   - Use vendor/source when transparency aids the receipt's purpose
//     (DRAGNET probe-pack runs, OATH vendor checks, etc).
//   - Use a routing partner (NOT the source) when source-attribution
//     would compromise anonymity (WHISTLE submissions).
//   - Use an artifact kind when the source identity is variable but
//     the artifact category is stable (SBOM-AI: probe-pack, model-card,
//     mcp-server).
//   - Use a private machine identifier (NOT the canary content) when
//     the body must stay local (MOLE).
//
// Not wired into rendering — this is a design contract. Adding a new
// program means adding an entry here AND in ACTIVE_PROGRAMS, locked
// in by the registry test suite.

export interface PhraseIdPrefixConvention {
  /** Where the prefix slug comes from (one short noun). */
  readonly prefixSource: string;
  /** One-line privacy / UX explainer. */
  readonly rationale: string;
}

export const PHRASE_ID_PREFIX_CONVENTIONS: Readonly<
  Record<string, PhraseIdPrefixConvention>
> = {
  dragnet: {
    prefixSource: "vendor",
    rationale:
      "Probe-pack target vendor (e.g. 'openai') — receipt URL self-discloses which AI vendor was probed.",
  },
  oath: {
    prefixSource: "vendor",
    rationale:
      "Vendor whose oath was verified — surfaces accountability target directly in the URL.",
  },
  fingerprint: {
    prefixSource: "vendor",
    rationale:
      "Vendor whose model was fingerprinted — drift attribution must be unambiguous from the URL.",
  },
  custody: {
    prefixSource: "vendor (or 'unknown' if generic bundle)",
    rationale:
      "Source of the CustodyBundle — falls back to 'unknown' for generic third-party bundles where source attribution is unavailable.",
  },
  whistle: {
    prefixSource: "routing partner (NOT source)",
    rationale:
      "Newsroom partner (ProPublica / Bellingcat / 404 Media / EFF Press) — source identity must NEVER appear in a public URL; the routing partner does.",
  },
  bounty: {
    prefixSource: "target platform",
    rationale:
      "HackerOne or Bugcrowd — phrase-ID encodes the platform the bounty was filed against, not the vulnerability source.",
  },
  "sbom-ai": {
    prefixSource: "artifact kind",
    rationale:
      "Artifact kind ('probe-pack' / 'model-card' / 'mcp-server') — author identity is variable; the artifact category is the load-bearing dimension.",
  },
  rotate: {
    prefixSource: "reason",
    rationale:
      "Rotation reason ('compromised' / 'routine' / 'lost') — the reason is what re-witness consumers need; the actual key fingerprint stays in the body.",
  },
  tripwire: {
    prefixSource: "machine ID slug",
    rationale:
      "Per-dev-machine ID slug — phrase-ID lets ops staff ack/route TRIPWIRE receipts back to the correct workstation without leaking the operator's identity.",
  },
  nuclei: {
    prefixSource: "author handle",
    rationale:
      "Registry author handle (e.g. 'alice', 'openai-eng') — registry entries belong to authors; receipt URL self-discloses provenance. Note: until pluck-api binds NUCLEI authors to authenticated user IDs, handles can be impersonated; see route.ts comment.",
  },
  mole: {
    prefixSource: "canary ID (NOT canary content)",
    rationale:
      "Operator-chosen canary identifier — the canary BODY never enters any public surface; only the operator's local ID does.",
  },
};

// ---------------------------------------------------------------------------
// Program privacy posture — what Studio refuses to know
// ---------------------------------------------------------------------------
//
// The negative-knowledge table. Each program declares (a) what Studio
// explicitly does NOT see / store / log about an operator's operation,
// and (b) the necessary trust-tradeoff — what it does know. This is the
// inversion of standard surveillance-tool framing: the page at
// /what-we-dont-know renders this verbatim and the phrase-ID schema
// is the proof. If Studio knew it, it'd be in the URL.
//
// Adding a new program means adding an entry here AND in ACTIVE_PROGRAMS;
// the registry test suite locks the invariant. Be specific — vague
// claims undermine the page's purpose.
// ---------------------------------------------------------------------------

export interface ProgramPrivacyPosture {
  /** Things Studio explicitly refuses to know / store. Privacy-load-bearing. */
  readonly knowsNot: ReadonlyArray<string>;
  /** Things Studio knowingly stores (the necessary trust-tradeoff). */
  readonly knows: ReadonlyArray<string>;
}

export const PROGRAM_PRIVACY_POSTURE: Readonly<
  Record<string, ProgramPrivacyPosture>
> = {
  dragnet: {
    knowsNot: [
      "operator-internal context beyond the probe-pack ID",
      "any data flowing through the probe besides the public claims being checked",
      "operator's ToS arrangement with the vendor — only the activation-time acknowledgement",
    ],
    knows: [
      "probe-pack ID + version (vendor disclosure is the point)",
      "vendor target hostname (anchored in the phrase-ID)",
      "per-cycle classification counts (contradict / mirror / shadow / snare)",
    ],
  },
  oath: {
    knowsNot: [
      "any vendor-internal data beyond the public /.well-known/pluck-oath.json document",
      "operator identity beyond the Pluck account binding",
      "any prior verification history not anchored to Rekor",
    ],
    knows: [
      "vendor hostname (the URL fetched)",
      "served Origin vs body's vendor field cross-check",
      "verdict + per-claim list",
    ],
  },
  fingerprint: {
    knowsNot: [
      "operator-internal context beyond probe-pack ID",
      "the vendor's model weights or any private metadata",
      "the calibration-set responses beyond their hashes once cassetted",
    ],
    knows: [
      "vendor whose model was probed (anchored in the phrase-ID)",
      "5-probe calibration-set responses (cassette local:<sha256>)",
      "drift classification + drift score",
    ],
  },
  custody: {
    knowsNot: [
      "the bundle's source operator identity when source attribution is unavailable",
      "any private chain-of-custody metadata beyond what the bundle itself signs",
      "WebAuthn private credentials — only the public attestation summary",
    ],
    knows: [
      "CustodyBundle URL fetched server-side",
      "verdict + per-check breakdown",
      "WebAuthn attestation summary (public)",
    ],
  },
  whistle: {
    knowsNot: [
      "the source identity — phrase-ID encodes the routing partner only",
      "the submission body once redaction layers run",
      "any IP / cookie / fingerprint of the submitter",
    ],
    knows: [
      "routing partner (ProPublica / Bellingcat / 404 Media / EFF Press)",
      "sha256 of pre-redaction submission",
      "ephemeral signing key fingerprint",
    ],
  },
  bounty: {
    knowsNot: [
      "the operator's HackerOne / Bugcrowd auth token — token-LOCAL posture, never sent to Studio",
      "private vulnerability details — only the EvidencePacket structure",
      "the operator's bounty payout banking details",
    ],
    knows: [
      "target platform (HackerOne / Bugcrowd)",
      "submission status",
      "filed-by handle",
    ],
  },
  "sbom-ai": {
    knowsNot: [
      "the artifact's private source code or internal build steps",
      "author identity beyond the published handle on the attestation",
      "any private supply-chain metadata not embedded in the in-toto attestation",
    ],
    knows: [
      "artifact kind (probe-pack / model-card / mcp-server)",
      "canonical sha256 digest of the artifact",
      "per-kind predicate URI",
    ],
  },
  rotate: {
    knowsNot: [
      "the full key fingerprint — only rotation reason in URL",
      "key material at any time — operator holds private keys",
      "the original cassettes' bodies — only their hashes are re-witnessed",
    ],
    knows: [
      "rotation reason (compromised / routine / lost)",
      "old key public hash",
      "new key public hash",
      "count of re-witnessed cassettes",
    ],
  },
  tripwire: {
    knowsNot: [
      "intercepted bodies by default — local cassette unless notarize is on",
      "the operator's identity — only their machine ID slug",
      "any machine the operator didn't enroll",
    ],
    knows: [
      "machine ID slug",
      "policy ID + version",
      "ingestion endpoint",
    ],
  },
  nuclei: {
    knowsNot: [
      "the operator's real-world identity beyond the operator-asserted handle",
      "the underlying probe-pack contents (those live on the SBOM-AI side)",
      "any private trust-graph between authors and consumers",
    ],
    knows: [
      "registry author handle (operator-asserted; NOT yet bound to authenticated identity — see route.ts SECURITY block; binds at NUCLEI v1.0 GA)",
      "SBOM-AI Rekor uuid cross-reference (TOFU enforcement)",
      "trustTier (verified vs ingested) + canonical pack-entry URL",
    ],
  },
  mole: {
    knowsNot: [
      "the canary body — only sha256 + length",
      "the operator's local fingerprint vocabulary beyond the published phrases",
      "any probe results — sealing comes BEFORE probing, by design",
    ],
    knows: [
      "sha256 of the canary body (anchored)",
      "operator-chosen fingerprint phrases",
      "canary URL the operator declared",
    ],
  },
};
