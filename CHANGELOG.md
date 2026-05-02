# @sizls/pluck-studio

## 0.1.1

### Patch Changes

- 82e33a4: AVAP – AI Vulnerability Auction Protocol. The headline composite Bureau
  program. Composes DRAGNET + FINGERPRINT + MOLE + BOUNTY + NUCLEI + OATH
  into time-locked, threshold-witnessed disclosure auctions. The
  HackerOne-killer.

  Adds:

  - `@sizls/pluck-bureau-avap` – new package. Four signed predicate types
    on Rekor: `AVAP/v1` (auction-open), `AVAP.Bid/v1` (single bid),
    `AVAP.Unseal/v1` (k-of-n threshold-share unseal),
    `AVAP.Distribution/v1` (off-platform payout ledger). Pluck records the
    math, never holds custody.
  - New CLI namespace: `pluck bureau avap` with five actions –
    `open` / `bid` / `status` / `unseal` / `distribute`.
  - Studio landing page at `/bureau/avap` explaining the threshold
    semantics + composition graph.

  Threshold semantics – "quorum-vote-controlled time-lock":

  - Every party publishes a public-share fingerprint at auction-open.
  - To unseal, each contributing party signs the canonical
    `{auctionId, outcome, unsealedAt}` triple with their Ed25519 key.
  - Verifier requires `>= threshold.required` distinct fingerprints from
    the auction's party slate; `t-1` shares cannot unblind.
  - Documented explicitly as NOT a Verifiable Secret Sharing scheme – the
    guarantee rides on canonical-JSON + Ed25519 + quorum dedup.

  R1-hardening parity:

  - index.ts type-pure / register.ts side-effect / `./plugin` subpath
  - Distinct predicate URIs per shape (4 of them – no overloads)
  - Raw 32-byte digest signing
  - Full 64-hex SPKI fingerprints across every body
  - Bounds caps: parties ≤ 16, bids ≤ 1024, distribution recipients ≤ 64,
    paymentReceipts ≤ 256
  - Sponsor-cannot-self-claim: bidder fingerprints are checked against the
    auction's party slate via `AvapAuctionState.canClaim()`
  - Predicate-type validators registered at module load (TOFU pattern)
  - canonical-JSON, fail-closed, ISO 8601 strict, identifier regex via
    bureau-core/identifiers.ts
  - AbortSignal threading; bureau pause kill-switch respected
  - Optional cassette persistence on every signed verb

  Wiring:

  - BureauProgramId union extended with `"avap"`.
  - `programs.ts` (Studio) tile entry at status `alpha`.
  - `@sizls/pluck-cli` adds workspace dep + side-effect import of
    `@sizls/pluck-bureau-avap/plugin`.

- dcfcb76: [feat] COORDINATED – cross-platform signed observation of inauthentic
  behavior networks (CIB / coordinated-bot detection), Phase 10 alpha.

  DRAGNET probe-packs scrape suspect account clusters across X / TikTok /
  Reddit / Telegram; FINGERPRINT detects when 40+ accounts share the
  same generation-model signature (perplexity bands, token-prob
  fingerprint); TRIPWIRE on consenting endpoint catches the LLM-API
  call that generated the post; NUCLEI lets researchers (Stanford IO,
  Graphika, DFRLab) publish signed CIB probe-packs.

  Three observation classes:

  - **shared-model-fingerprint** (red-team): 40+ accounts share the
    same generation-model signature within tight tolerance. False-
    positive resistance via organic-language gate (legit news-cycle
    convergence skipped).
  - **tripwire-confirmed** (red-team): TRIPWIRE-side observation on a
    consenting endpoint catches the LLM-API call that generated a
    flagged post. Direct evidence – no inference required.
  - **cross-platform-cluster** (red-team): same account-fingerprint
    pattern observed on 2+ platforms at coordinated timestamps. Single
    dossier no platform can deny.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture: only
  account-id digests (sha256(platform || ':' || account-id || salt))
  and post-fingerprint feature vectors carried; never raw handles or
  raw post bytes. Single demo CLI subcommand:
  `pluck bureau coordinated demo` – 50 SuspectAccounts (10 organic +
  40 CIB) → 3 CoordinatedProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"coordinated"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"coordinated"` +
    tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin.
  - Studio `programs.ts`: append COORDINATED tile (status `alpha`).

- 1ae7f43: [feat] COUNTERFEIT-KILL – physical-object FINGERPRINT for pharma /
  luxury / conflict minerals (sign the molecule, not the QR code),
  Phase 10 alpha.

  FINGERPRINT-of-physical-object (microscope-level surface stochastics,
  paper fiber, pill imprint, gem inclusions) registered at factory;
  CUSTODY chains every shipping leg (factory -> distributor -> retailer
  -> consumer); SBOM-AI anchors the per-product-class supplier graph so
  unauthorized factories surface immediately; BOUNTY auto-files customs
  / FDA when divergence is detected. Object-level entropy fingerprinting
  is unforgeable without the original object – counterfeit pills,
  conflict diamonds, fake luxury bags carry their own stochastic
  fingerprints, and those fingerprints cannot match the registered class
  centroid.

  Three observation classes:

  - **fingerprint-divergence** (red-team): an object's stochastic
    fingerprint deviates >3sigma from the registered product-class
    centroid. Almost certainly counterfeit. Centroid math uses robust
    median + MAD-scaled sigma (mirroring COSMOS) so a small number of
    counterfeits cannot bias their own sigma. False-positive resistance
    via leave-one-out centroid + operator-tunable threshold (legit
    factory-side surface variation within tolerance lives inside the
    centroid distribution and never crosses 3sigma).
  - **supplier-not-in-graph** (red-team): a CUSTODY shipment leg signed
    by a supplier whose SPKI fingerprint is not in the product class's
    signed SBOM-AI supplier graph. The supplier itself is unauthorized
    – gray-market pharma diversion or third-shift fake luxury. False-
    positive resistance via fail-closed gate (shipments without a
    published manifest don't fire – the program does not retro-flag).
  - **chain-broken** (red-team): CUSTODY chain integrity gap between
    factory -> distributor -> retailer -> consumer. A required leg's
    `prevDigest` doesn't reproduce against the prior leg's `legDigest`,
    or a hop is missing entirely. False-positive resistance via first-
    leg leniency (the factory leg has no prevDigest by definition).

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture: only
  object-fingerprint digests + product-class hashes (sha256(productClass

  - ':' + classSalt)) + supplier SPKI fingerprints carried; consumer-
    side observations are hashed before attest – the Bureau attests the
    _integrity_ of the object + chain, never the cleartext of the
    consumer's identity. Single demo CLI subcommand: `pluck bureau
counterfeit-kill demo` – 1 product class with 3 baseline fingerprints
  - 1 outlier counterfeit + 1 unknown-supplier shipment + 1 broken
    chain -> 3 CounterfeitProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"counterfeit-kill"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"counterfeit-kill"`
    - tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin.
  - Studio `programs.ts`: append COUNTERFEIT-KILL tile (status `alpha`).

- 577dce0: [feat] EVIDENCE-LOCKER – court-admissible deepfake detection +
  expert-witness AI disclosure (FRE 901/902 by signature), Phase 10
  alpha.

  Defense / prosecution submits any digital exhibit through CUSTODY at
  intake; FINGERPRINT runs deepfake detection with signed result; SBOM-AI
  anchors any AI tool an expert witness used; OATH binds expert
  witnesses to disclosed-tools commitments; ROTATE handles compromised
  forensic-lab keys. FRE 901/902 already accepts cryptographic
  authentication – Pluck makes it standard.

  Three observation classes:

  - **exhibit-deepfake** (red-team): FINGERPRINT-driven deepfake
    detection on the submitted exhibit fires positive – the exhibit is
    not authentic and the proof is signed by the detector lab. False-
    positive resistance via score-threshold gate on top of detector
    binarization (legit re-encoding from a Premiere export or browser
    screenshot resave does not fire).
  - **tooling-undisclosed** (red-team): expert witness used an AI tool
    not in their signed OATH disclosed-tools commitment. The OATH
    itself is the falsification – the expert committed to a tool-set,
    used a wider tool-set, and the difference is the proof. False-
    positive resistance via membership-only gate (declared > used is
    legit, never fires).
  - **chain-broken** (red-team): CUSTODY chain integrity gap between
    intake -> submission -> courtroom. A required leg's `prevDigest`
    doesn't reproduce against the prior leg's `legDigest`, or the
    chain has fewer legs than the operator-required minimum.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture: only
  digests, party hashes (sha256(partyId + ':' + caseSalt)), and
  case-id hashes (sha256(caseId + ':' + caseSalt)) carried; never raw
  exhibit cleartext or raw party identities. Single demo CLI subcommand:
  `pluck bureau evidence-locker demo` – 3 exhibits (1 authentic + 1
  deepfake + 1 chain-broken) + 1 expert with undisclosed tool -> 3
  EvidenceProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"evidence-locker"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"evidence-locker"`
    - tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin.
  - Studio `programs.ts`: append EVIDENCE-LOCKER tile (status `alpha`).

- cb3fa96: [feat] MARKET-HONEST – algorithmic-trade attestation + market-maker
  DRAGNET (sign every fill, pump-and-dump auto-filed), Phase 10 alpha.

  DRAGNET runs probe-packs against trading-bot APIs (Renaissance,
  Jane Street public endpoints, Robinhood retail PFOF); FINGERPRINT
  detects model-swap between disclosed and deployed strategies; CUSTODY
  signs every fill for SEC submission; BOUNTY auto-files at FINRA / SEC
  when a dossier is decisive. Best-execution proofs become
  cryptographically falsifiable; pump-and-dump rings detected via
  cross-exchange signed observation.

  Three observation classes:

  - **model-swap** (red-team): the deployed strategy's order-flow
    fingerprint deviates >3sigma from the disclosed StrategyFingerprint
    centroid. Centroid math uses robust median + MAD-scaled sigma so a
    small number of swapped orders cannot bias their own sigma. False-
    positive resistance via operator-tunable threshold (legit prompt-
    driven order-flow variation lives inside the centroid distribution
    and never crosses 3sigma).
  - **best-execution-fail** (red-team): a signed Fill executed at a
    price worse than NBBO at execution time by more than the operator-
    supplied basis-point tolerance. Buys at price > ask + tolerance OR
    sells at price < bid - tolerance fire; cross-the-spread is normal,
    the program fires only on the directional violation. False-positive
    resistance via in-quote leniency (thinly-traded micro-caps with wide
    bid-ask spreads do not fire when the fill is at the inside quote).
  - **pump-and-dump** (red-team): synchronized buy-then-dump pattern
    across 3+ distinct exchanges within a tight time window (60s pump
    window + 5min dump window default). False-positive resistance via
    minimum-distinct-venues gate (single-exchange whales – legit
    institutional fills – do not fire) and required pump+dump leg pair
    (one-sided sweeps don't qualify).

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture: only
  fillId digests + venue + symbol + modelIdHash (sha256(modelId + ':' +
  classSalt)) + counterpartyIdHash (sha256(counterpartyId + ':' +
  classSalt)) carried; client-account / counterparty cleartext NEVER
  appears in a TimelineDot summary or proof payload – the Bureau attests
  the _integrity_ of the fill + strategy + ring, never the cleartext of
  the client's identity. Single demo CLI subcommand: `pluck bureau
market-honest demo` – 1 disclosed strategy + 8 signed fills (1
  baseline + 1 model-swap + 1 best-execution-fail + 3 pump + 3 dump) ->
  3 MarketHonestProofs.

  Predicate URIs (mint distinct):

  - `https://pluck.run/MarketHonest.Fill/v1`
  - `https://pluck.run/MarketHonest.BotProbe/v1`
  - `https://pluck.run/MarketHonest.Strategy/v1`
  - `https://pluck.run/MarketHonest.Proof/v1`

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"market-honest"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"market-honest"`
    - tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    counterfeit-kill).
  - Studio `programs.ts`: append MARKET-HONEST tile (status `alpha`).

- 7a70064: [feat] TRIAL-SEAL – clinical-trial data integrity + FDA submission
  custody (Theranos-proof your trial: every patient a Merkle leaf),
  Phase 10 alpha.

  Each patient observation signed at the bedside device; CUSTODY chains
  site -> CRO -> sponsor -> FDA; MOLE detects whether trial data was
  used to train a downstream LLM (HIPAA-grade contamination);
  FINGERPRINT verifies the analysis-pipeline model digest matches the
  signed Statistical Analysis Plan (SAP) manifest; ROTATE handles PI
  key compromise without retroactive trial invalidation. Eliminates
  the entire class of Theranos-shape frauds – you cannot selectively
  delete patients post-hoc when every visit is a Merkle leaf.

  Four observation classes:

  - **patient-deletion** (red-team): a previously-signed
    PatientObservation no longer in the submitted dataset. The latest
    observation for `(trialId, subjectIdHash)` was `status: "active"`
    AND the subjectIdHash is missing from the FDA submission's subject
    manifest. False-positive resistance via coded-withdrawal exemption
    – `status: "withdrew"` and `status: "completed"` code legit
    dropout / completion via protocol; the program never fires on
    protocol-coded exits.
  - **sap-divergence** (red-team): the analysis model digest in the
    submission does not match the latest signed SAP manifest digest.
    Sponsor post-hoc model swap is the textbook fraud here. False-
    positive resistance via dual-presence gate – both a signed manifest
    AND a deployed digest must exist (missing manifest is an ops issue,
    not data-integrity fraud).
  - **training-leak** (red-team): MOLE detects that trial data was
    used to train a downstream LLM (HIPAA-grade contamination). The
    leak proof carries `subjectIdHash` + a deterministic
    `leakFingerprint` (sha256 of canonical observation skeleton fields);
    the LLM output bytes themselves stay off-chain. False-positive
    resistance via tracked-observation gate – stray MOLE hits without
    a tracked observation do not fire.
  - **chain-broken** (red-team): CUSTODY chain hop missing in the
    site -> CRO -> sponsor -> FDA chain. The dossier is structurally
    incomplete; proof fires regardless of the underlying observation
    content. The structural `REQUIRED_CHAIN_HOPS` set anchors this.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture: only
  observationId digests + trialId (public) + subjectIdHash
  (sha256(trialSalt + subjectId)) + measurement digests carried; raw
  PHI / subject identity NEVER appears in a TimelineDot summary or
  proof payload – the Bureau attests the _integrity_ of the
  observation + chain + analysis model, never the cleartext of the
  patient's identity. HIPAA posture: every signed body carries hashed
  identifiers only. Single demo CLI subcommand: `pluck bureau
trial-seal demo` – 5 signed PatientObservations + 1 SAP manifest +
  partial CUSTODY chain (site + CRO; sponsor + FDA missing) +
  submission view (deletes Subject-005, deploys divergent analysis
  model) -> 3 TrialSealProofs (patient-deletion + sap-divergence +
  chain-broken).

  Predicate URIs (mint distinct):

  - `https://pluck.run/TrialSeal.PatientObservation/v1`
  - `https://pluck.run/TrialSeal.CroChain/v1`
  - `https://pluck.run/TrialSeal.SapManifest/v1`
  - `https://pluck.run/TrialSeal.Proof/v1`

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"trial-seal"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"trial-seal"`
    - tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    market-honest).
  - Studio `programs.ts`: append TRIAL-SEAL tile (status `alpha`).

- a431b21: [feat] CITIZEN-LEDGER – self-sovereign personal record chain (your
  health record, your signature, their countersignature), Phase 11
  Distributed Trust Substrate alpha.

  Citizens sign their own health, employment, legal, financial, and
  education records (the citizen IS the root); institutions co-sign
  (countersignature) what they hold; revocation flows via ROTATE; the
  WHISTLE channel surfaces institutional cover-ups; OATH binds any
  institution's self-sovereignty commitment. Inverts the data-broker
  model – the citizen is the root. Equifax-shape breaches lose value
  because there is no central honeypot.

  Three observation classes:

  - **violation-of-self-sovereignty** (red-team): an institution shares
    or sells a record without the citizen's signed consent OATH. The
    institution's `InstitutionalCounterSignature` carries an explicit
    `disclosureConsent` literal; mismatched-consent + observed disclosure
    fires. False-positive resistance via the consent matrix – legit
    anonymized statistical aggregation under a citizen-signed
    `aggregate:anonymized` consent does NOT fire; on-target external
    shares under `share:specific` consents do NOT fire (only off-target
    shares cross the gate).
  - **missing-counter-sign** (red-team): an institution claims to have a
    record on file but cannot produce the citizen-signed root attestation.
    Either the institution fabricated the record or stripped the citizen-
    signed root after intake. Detected by comparing the institutional
    counter-sign's `recordDigest` against the live `SelfSignedRecord`
    set; absent recordDigest fires.
  - **post-revoke-use** (red-team): institution accesses or uses a record
    after the citizen issued ROTATE revocation. The counter-sign's
    `observedAt` is strictly after the revocation's `revokedAt`. False-
    positive resistance via strict-after gate – counter-signs that
    preceded the revocation do NOT fire.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture: only
  `citizenIdHash` (sha256(citizenSalt + citizenId)) + `recordDigest` +
  recordKind carried; raw citizen identity / record content NEVER
  appears in a TimelineDot summary or proof payload – the Bureau attests
  the _integrity_ + _self-sovereignty_ of the record chain, never the
  cleartext of the citizen's identity OR the record content. HIPAA /
  GDPR posture: every signed body carries hashed identifiers only.
  Single demo CLI subcommand: `pluck bureau citizen-ledger demo` – 1
  citizen + 4 self-signed records (health/employment/legal/financial) +
  4 institutional counter-signs (1 violation, 1 missing-counter-sign, 1
  post-revoke-use, 1 clean) + 1 citizen-issued revocation -> 3
  CitizenLedgerProofs.

  Predicate URIs (mint distinct):

  - `https://pluck.run/CitizenLedger.SelfRecord/v1`
  - `https://pluck.run/CitizenLedger.CounterSign/v1`
  - `https://pluck.run/CitizenLedger.Revocation/v1`
  - `https://pluck.run/CitizenLedger.Proof/v1`

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"citizen-ledger"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"citizen-ledger"`
    - tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    trial-seal); workspace dep added alphabetically (between celeste
    and cli).
  - Studio `programs.ts`: append CITIZEN-LEDGER tile (status `alpha`).

- 270703f: [feat] GOSSIP – operator-to-operator signed observation peering (the
  moat: every Pluck operator co-signs, no Pluck-Inc trust required),
  Phase 11 Distributed Trust Substrate alpha.

  Operators run TRIPWIRE / DRAGNET / NUCLEI / etc. locally; GOSSIP turns
  each operator into a peer in a cross-attesting mesh – every alpha
  program's outputs co-signed by N peers before being trusted as
  MeshAttested. Sybil-resistant via stake or web-of-trust signer
  disclosure. The mesh becomes the moat: no Pluck-Inc trust required.
  Pluck graduates from "trust us" to "trust the mesh."

  Three observation classes:

  - **sybil-detected** (red-team): a peer-fingerprint cluster shares the
    same web-of-trust signer set within tight Jaccard similarity (>=
    `SYBIL_OVERLAP_THRESHOLD`), cluster size >= `SYBIL_MIN_CLUSTER_SIZE`,
    likely sock-puppet. False-positive resistance: a legit cluster of
    peers in the same org with disclosed-relationship OATH (matching
    `orgKey`) does NOT fire – the program respects org-disclosed
    relationship attestations and treats shared-signer cliques with
    matching `orgKey` as a single declared entity.
  - **co-sign-conflict** (red-team): same peer co-signs the same
    observation with opposite verdicts (`agree` + `disagree`) – the peer
    cannot be in two truth-states simultaneously.
  - **stake-slashed** (red-team): peer's stake / reputation drops below
    threshold due to verified false co-signatures. The Bureau aggregates
    cosigIds in `view.confirmedFalseCosigIds` per-peer; when
    `slashCount * SLASH_PENALTY` meets-or-exceeds `peer.stake *
SLASH_FRACTION_THRESHOLD`, the peer is slashed and a proof emits.

  In addition to the three proof classes, GOSSIP emits
  `MeshAttestedRecord` values – the _positive_ artefact – for any
  observation whose `agree`-verdict cosigs cross the k-of-n quorum gate
  (default 3-of-5). MeshAttestedRecords are publishable to Rekor as the
  public proof that the mesh ratified the observation.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. Three constraints:
  `quorumShortfall` (priority 70 -> AWAIT_COSIGN), `proofDetected`
  (priority 80 -> EMIT_PROOF), `attestationReady` (priority 100, paused
  gate -> EMIT_MESH_ATTESTATION). Four resolvers (awaitCosign / emitProof
  / emitMeshAttestation / notarizeProof) with retry policies; four
  effects (emitPeerMetric / persistCassette / pausePoll / broadcastProof).
  PII posture: peer fingerprints are deliberately public – the mesh's
  whole reason to exist is public operator identity. No PII is carried
  in any signed body; observations themselves are passed-through digests,
  never raw bodies. Single demo CLI subcommand: `pluck bureau gossip
demo` – 5 operator peers (3 sybil + 2 honest) + 3 peer observations +
  4 co-signatures (3 agree on observation1 -> mesh-attested, 1
  conflicting verdict by the same peer) -> 2 GossipProofs + 1
  MeshAttestedRecord.

  Predicate URIs (mint distinct):

  - `https://pluck.run/Gossip.Peer/v1`
  - `https://pluck.run/Gossip.Observation/v1`
  - `https://pluck.run/Gossip.CoSign/v1`
  - `https://pluck.run/Gossip.MeshAttested/v1`
  - `https://pluck.run/Gossip.Proof/v1`

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"gossip"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"gossip"` + tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    citizen-ledger); workspace dep added alphabetically (between
    fingerprint and hive).
  - Studio `programs.ts`: append GOSSIP tile (status `alpha`).

- b113ce0: [feat] POLICY-AUCTION – zero-knowledge policy-compliance markets (prove
  EU AI Act compliance in ZK, auction the audit), Phase 11 Distributed
  Trust Substrate alpha.

  Regulators publish policy as a NUCLEI probe-pack (e.g., "EU AI Act
  Art. 5"); vendors bid to attest compliance via ZK proofs without
  disclosing model weights; DRAGNET continuously verifies; OATH
  penalizes drift; CUSTODY makes audits cryptographic. ZK-SNARKs over
  model behaviour close the "trade secret vs regulator" deadlock –
  vendors prove compliance without disclosing weights, regulators get a
  cryptographic audit trail.

  Three observation classes:

  - `zk-verify-fail` (red-team): vendor's ZK proof does not validate
    against the policy probe-pack's public inputs.
  - `drift-detected` (red-team): DRAGNET observes the vendor diverging
    from its signed attestation by more than the probe-pack's
    `toleranceBand`. Drift AT-OR-BELOW the signed band does NOT fire –
    false-positive resistance respects vendor-disclosed tolerance.
  - `vendor-equivocation` (red-team): same vendor signs two ZK
    attestations on the same policyId carrying contradicting public
    inputs (different sha256 of canonical-JSON public inputs).

  ALPHA STATUS: the ZK-SNARK math is STUBBED. `verifyZkProof(proof,
publicInputs)` is a deterministic prefix check (proof bytes start with
  `sha256(canonicalStringify(publicInputs))`); real circom / snarkjs /
  halo2 integration over model behaviour is research-required and lands
  in a follow-up. The PROGRAM SHAPE – auction → bid → ZK-attestation
  → continuous-verify – is the alpha deliverable.

  New CLI:

  - `pluck bureau policy-auction demo`

  New package: `@sizls/pluck-bureau-policy-auction` (Directive-first
  module + system + plugin). Adds:

  - `types.ts`: PolicyProbePack, VendorBid, ZkComplianceAttestation,
    DriftViolation, PolicyAuctionProof. Bounds:
    MAX_PROBE_PACKS=1024, MAX_BIDS=10000, MAX_ATTESTATIONS=10000,
    MAX_DRIFTS=10000, MAX_PROOFS=1024, MAX_PROOF_BYTES_HEX_CHARS=65536.
  - `canonicalization.ts`: byte-stable canonical-JSON, raw 32-byte digest
    signing (cosign-interop), full 64-hex SPKI fingerprints, strict ISO
    8601 UTC. Five distinct predicate URIs:
    `https://pluck.run/PolicyAuction.{ProbePack,VendorBid,ZkAttestation,Drift,Proof}/v1`.
  - `zk-stub.ts`: `verifyZkProof()` deterministic prefix check +
    `synthesizeStubProof` / `synthesizeBadProof` helpers for tests +
    demo round-trip. Real verifier swaps in by replacing this file.
  - `auction.ts`: 3-class detector (zk-verify-fail / drift-detected /
    vendor-equivocation), candidate-key dedupe, dossier Merkle root,
    proof assembly + signing.
  - `module.ts`: Directive `createModule` (~250 LOC) – facts
    (probePacks / bids / attestations / drifts / proofs /
    notarizedProofs / paused / aborted), derivations
    (probePacksByPolicy / bidsByPolicy / attestationsByVendor /
    driftsByVendor / proofCandidates / pendingNotarize /
    dossierMerkleRoot), constraints (proofDetected priority 80 /
    proofReadyToNotarize priority 100 with paused gate), resolvers
    (EMIT_PROOF / NOTARIZE_PROOF), effects (emitBidMetric /
    persistCassette / pausePoll / broadcastProof).
  - `system.ts`: `createPolicyAuctionSystem` factory (~200 LOC) wired
    with logging + devtools + performance + observability plugins.
  - `plugin.ts`: `pluck bureau policy-auction demo` CLI subcommand –
    in-memory: 1 PolicyProbePack ("EU AI Act Art. 5") + 3 VendorBids
    - 3 ZkComplianceAttestations (1 valid, 1 invalid ZK, 1 drift) +
      1 DriftViolation -> 2 PolicyAuctionProofs (1 zk-verify-fail + 1
      drift-detected).
  - 30+ tests covering canonicalization (8), auction detector (10), and
    Directive constraint chain (~12).

  Coordination:

  - `@sizls/pluck-bureau-core`: adds `"policy-auction"` to
    `BureauProgramId`.
  - `@sizls/pluck-bureau-cli`: registers `policy-auction` in the
    dispatch table + tagline.
  - `@sizls/pluck-cli`: adds the workspace dep + the side-effect
    `import "@sizls/pluck-bureau-policy-auction/plugin";` at boot.
  - `pluck-studio`: appends the POLICY-AUCTION tile (status: "alpha").

  R1-hardening:

  - index.ts type-pure / register.ts side-effect / `./plugin` subpath /
    `sideEffects` allowlist.
  - Distinct predicate URIs for probe-pack / vendor-bid / zk-attestation
    / drift / proof.
  - Raw 32-byte digest signing (cosign-interop), full 64-hex SPKI
    fingerprints, strict ISO 8601 UTC.
  - Five predicate validators registered at module load (TOFU R1
    pattern).
  - Fail-closed `paused` gate on NOTARIZE_PROOF.
  - `redactBureauPayload` runs as the pre-attest gate so any
    operator-supplied context strings pass through the redactor before
    signing – vendor model weights NEVER disclosed (the ZK proofs are
    opaque blobs by design).
  - Cassette persistence stubbed for alpha.
  - Real ZK-SNARK over model behaviour stubbed; the program shape is
    the deliverable.

- 33d03f1: [feat] CHERENKOV-WITNESS – datacenter neutron flux as tamper-evident
  location fingerprint, Phase 12 Moonshot alpha.

  $400 silicon photomultiplier inside a datacenter rack measures local
  neutron + muon flux. Combined (geomag, altitude, building-mass,
  time-of-day-cosmic-ray-modulation) signature is _site fingerprint
  that cannot be cloned to a different physical location_. If your
  "EU-sovereign" cloud workload reports neutron signature matching
  Virginia, vendor lied about geography. Cryptographic proof of
  physical workload location – defeats data-residency fraud.

  Three observation classes:

  - **geography-mismatch** (red-team): observed flux signature
    deviates STRICTLY MORE THAN 3 sigma from the registered site
    fingerprint centroid (per-axis MAD-scaled std-dev). Names a flux
    signature that does NOT match the site's known centroid – the
    rack physically moved or the observation came from a different
    physical location. False-positive resistance: deviation at-or-
    below 3 sigma does NOT fire – natural neutron-flux variation
    (solar cycle, diurnal, weather) sits inside the MAD-scaled gate.
    Centroids with fewer than `MIN_FINGERPRINT_SAMPLES` samples are
    considered insufficient and DO NOT fire the detector.
  - **data-residency-fraud** (red-team): the observation's
    `claimedRegion` (e.g. `us-east-1`) does NOT match the registered
    SiteFingerprint's `expectedRegion` (e.g. `EU-sovereign`). Vendor
    signs a residency claim that physics contradicts. False-positive
    resistance: a claim whose `claimedRegion` is empty does NOT fire;
    a matching claim/expected pair does NOT fire.
  - **site-cloned** (red-team): the same `siteId` is observed at two
    distinct hardware fingerprints within `SITE_CLONE_WINDOW_MS` (60
    seconds). Names a site fingerprint being broadcast from two
    physical racks at once – impossible without a clone. False-
    positive resistance: observations from the same hardware
    fingerprint do NOT fire; observations of the same siteId from
    distinct hardware separated by more than `SITE_CLONE_WINDOW_MS`
    do NOT fire (legit hardware swap).

  Built Directive-first via `@directive-run/core` –
  facts/derivations/constraints/resolvers/effects all in `module.ts`.
  PII posture: precise location (operator's exact altitude / geomag-
  lat / hardware coordinates) is the PII. Before any body is signed,
  altitude is bucketed to 100 m and geomag-lat is bucketed to 1°
  resolution. The `siteId` appears only as a sha256 hash so the same
  site's observations cluster across captures without disclosing
  identity. No raw datacenter address ever appears in any signed
  body. Hardware fingerprints stay full 64-hex (deliberately public).
  `redactBureauPayload` runs as the pre-attest gate. ALPHA STATUS:
  real silicon photomultiplier hardware integration (Hamamatsu S13360
  array on a USB-C ADC, 24/7 sampling cadence, neutron-vs-muon
  discrimination via pulse-shape analysis, building-mass-attenuation
  calibration via co-located reference detector, per-rack temperature
  compensation) is research-required + hardware-required ($400
  silicon photomultiplier inside the rack). `readSipmFlux(deviceFinger
print)` is deterministic – given a known stub deviceFingerprint it
  returns a known-shaped FluxObservation so tests pin specific
  behaviours. Real SiPM bridge integration lands post-alpha. The
  PROGRAM SHAPE – site fingerprint registration → continuous flux
  observation → location-claim verification – is the alpha
  deliverable.

  Single demo CLI subcommand: `pluck bureau cherenkov-witness demo` –
  1 SiteFingerprint registered + 4 FluxObservations (1 baseline +
  geography-mismatch + data-residency-fraud + site-cloned) → 3
  CherenkovProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"cherenkov-witness"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"cherenkov-
witness"` + tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    graviton-ghost).
  - `@sizls/pluck-cli` package.json: workspace dep alphabetically
    between celeste and citizen-ledger.
  - Studio `programs.ts`: append CHERENKOV-WITNESS tile (status
    `alpha`).

- 2b1a647: [feat] COSMIC-DRIFT – cosmic-ray bitflip detection as supply-chain
  attestation, Phase 12 Moonshot alpha.

  Muon flux at sea level is ~1 per cm² per minute and rises with
  altitude. SRAM bitflip rates have a measurable cosmic-ray floor –
  commodity SRAM at sea level sits in the single-digits errs/MB/day
  regime, aboard an airliner at cruise (~10 km) the rate is ~300×
  higher. If observed soft-error rate (SER) is anomalously LOW for the
  claimed altitude / geomagnetic latitude, hardware is being shielded
  or virtualized – a hypervisor is intercepting reads, the SRAM the
  operator "samples" is the hypervisor's emulated buffer, not the
  physical part. Bureau signs (geographic-altitude, observed-SER,
  expected-SER-from-Regener-Pfotzer-curve, hardware-fingerprint) tuples
  and emits red-team proofs when the physics contradict the operator's
  claim. Detects firmware Trojans via _physics they can't fake_ – the
  Regener-Pfotzer cosmic-ray curve is information-theoretically
  universal; an attacker cannot make muons appear at scale, only
  suppress them.

  Three observation classes:

  - **anomalously-low-ser** (red-team): observed SER STRICTLY less than
    0.3× expected for the claimed location. Names hardware that is
    being shielded (Faraday / lead / scrubbed) or virtualized
    (hypervisor intercepting reads). False-positive resistance: an SER
    at or above 0.3× expected does NOT fire – natural Regener-Pfotzer
    flux variation sits at roughly ±20% over the 11-year solar cycle
    plus ~10–15% diurnal/seasonal noise.
  - **altitude-claim-falsified** (red-team): the implied altitude
    (back-derived from observed SER via the stub Regener-Pfotzer
    curve) differs from the claimed altitude by STRICTLY MORE THAN
    2000 m. A vendor claiming sea-level but exhibiting cruise-altitude
    flux (300× the sea-level rate) falsifies its location claim.
    False-positive resistance: a drift at or below 2000 m does NOT
    fire – natural altimeter noise stays inside the gate. Suppressed
    when the same observation also fires `anomalously-low-ser` (no
    double-attest of the same physical cause).
  - **hardware-shielded** (red-team): two consecutive observations
    from the SAME hardware fingerprint at the SAME bucketed location
    (no location change) show the second observation dropping by
    STRICTLY MORE THAN 50% relative to the first. False-positive
    resistance: a drop at or below 50% does NOT fire (natural Regener-
    Pfotzer diurnal/seasonal variation can reach this magnitude
    during solar maxima); a location change between captures
    suppresses the proof.

  Built Directive-first via `@directive-run/core` –
  facts/derivations/constraints/resolvers/effects all in `module.ts`.
  PII posture: precise location (operator's exact altitude / geomag-
  lat / hardware coordinates) is the PII. Altitude is bucketed to 100m
  and geomag-lat is bucketed to 1° resolution before any body is
  signed. Hardware fingerprints stay full 64-hex (deliberately public
  – the whole point of the proof is to name the device).
  `redactBureauPayload` runs as the pre-attest gate. ALPHA STATUS:
  real Regener-Pfotzer cosmic-ray flux model integration is research-
  required – `expectedSerForLocation(altitude_m, geomagLat)` is a
  deterministic stub (SER doubles roughly every 1500 m, latitude bonus
  at high latitudes) so tests pin specific behaviours; real curve
  calibration (1933 Regener-Pfotzer balloon dataset + post-1958 IGY /
  IGY-2 cosmic-ray monitor network + 2015–present neutron-monitor data

  - RACER corrections + per-chip SRAM cross-section calibration) lands
    post-alpha. The PROGRAM SHAPE (geographic input → expected SER →
    observed SER → tamper proof if anomalously LOW) is the alpha
    deliverable.

  Single demo CLI subcommand: `pluck bureau cosmic-drift demo` –
  4 SerObservations (1 baseline at sea level + 1 anomalously-low SER +
  1 altitude-claim-falsified + 1 sudden-shield) → 3 CosmicDriftProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"cosmic-drift"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"cosmic-drift"` +
    tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    neuro-consent).
  - `@sizls/pluck-cli` package.json: workspace dep alphabetically
    between coordinated and cosmos.
  - Studio `programs.ts`: append COSMIC-DRIFT tile (status `alpha`).

- b23dde2: [feat] GRAVITON-GHOST – gravitational-wave detector co-incidence as
  cosmic timestamp ground-truth, Phase 12 Moonshot alpha.

  LIGO publishes gravitational-wave detection timestamps to nanosecond
  precision. Cross-reference any cryptographic timestamp against the
  next LIGO event detection – if your notarized log claims t < t_LIGO
  but contains causal reference to t_LIGO content, it's forged. Cosmic
  ground-truth time. Cannot be backdated by any earthbound adversary
  including nation-states. The detector co-incidence requirement
  (LIGO-Hanford + LIGO-Livingston + Virgo observing the same waveform
  within milliseconds) makes gravitational-wave timestamps un-fakeable:
  an attacker cannot fabricate a coincident detection across three
  globally-separated observatories.

  Three observation classes:

  - **causal-precedence-violated** (red-team): the timestamp claim's
    `claimedTime` is STRICTLY before the cited LIGO event's
    `integratedTime`, BUT the claim's `contentDigest` cites the LIGO
    event content. Impossible – the claimant references content that
    did not yet exist at the claimed time. Names a forged timestamp.
    False-positive resistance: a claim whose `claimedTime` is at-or-
    after the cited LIGO event's `integratedTime` does NOT fire –
    causality is preserved.
  - **ligo-event-fabricated** (red-team): the claim cites a
    `citedLigoEventId` that does NOT appear in the LIGO event catalog
    OR the catalog's event has detector co-incidence verification
    fail (fewer than 2 detectors, or `verifyEventCoincidence` returns
    false). The claimant fabricated a non-existent gravitational-wave
    event. False-positive resistance: a claim whose `citedLigoEventId`
    is empty / undefined does NOT fire.
  - **timestamp-window-blown** (red-team): the claim provides
    `windowStart` and `windowEnd` but the window straddles a known
    LIGO event with WRONG relative ordering – i.e. `windowStart >
windowEnd` (inverted) or the window envelopes a LIGO event but
    the integrated-time falls outside [start, end]. False-positive
    resistance: a window that does NOT envelope any LIGO event does
    NOT fire; a window with start <= end that correctly envelopes
    the cited LIGO event does NOT fire.

  Built Directive-first via `@directive-run/core` –
  facts/derivations/constraints/resolvers/effects all in `module.ts`.
  PII posture: LIGO/Virgo events are PUBLIC scientific data – there is
  no PII to redact in the LigoEvent surface. The TimestampClaim
  carries content digests (already sha256-shaped) + a Rekor uuid
  (already public by definition – it's a transparency-log entry) +
  the claimed time (a wall-clock string). `redactBureauPayload` runs
  as the pre-attest gate. ALPHA STATUS: real LIGO/Virgo gravitational-
  wave catalog ingest is research-required – `fetchLigoEvent(eventId)`
  is a deterministic stub returning known events for
  "GW250101_120000" / "GW250215_034512" / "GW250318_184030" and null
  for unknown; `verifyEventCoincidence(event, multiDetectorTimes)` is
  deterministic (true when arrival-time spread <= 50 ms across >= 2
  contributing detectors). Real catalog integration (GWTC-1/2/3
  catalog mirror, GraceDB low-latency alerts, KAGRA-O4 joint
  detections, multi-detector strain frame retrieval) lands post-alpha.
  The PROGRAM SHAPE (timestamp claim → LIGO co-incidence verify →
  forgery-impossible attestation) is the alpha deliverable.

  Single demo CLI subcommand: `pluck bureau graviton-ghost demo` –
  4 TimestampClaims (1 valid + 1 causal-precedence-violation +
  1 fabricated-event + 1 window-blown) + 2 LigoEvents → 3
  GravitonGhostProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"graviton-ghost"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"graviton-ghost"` +
    tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    cosmic-drift).
  - `@sizls/pluck-cli` package.json: workspace dep alphabetically
    between gossip and hive.
  - Studio `programs.ts`: append GRAVITON-GHOST tile (status `alpha`).

- b415faa: [feat] LIDAR-WHISPER – remote keystroke + speech recovery from
  window vibrations via consumer LIDAR, Phase 12 Moonshots
  Directive-first alpha.

  Consumer LIDAR (iPhone Pro, Livox Mid-360) gives sub-mm range
  resolution at 30 Hz. With phase unwrapping you get audio-band
  vibration -> speech reconstruction from across the street, no IR
  laser required. Nobody has weaponized this yet because the math is
  annoying – Bureau can be first. Red-team: recover speech /
  keystrokes from across the street. Blue-team: detect when YOU'RE
  the target – your own LIDAR catches external high-frequency target
  sweeps consistent with surveillance LIDAR painting your windows.

  Three observation classes:

  - `speech-recovered` (red-team): signed `ReconstructionResult` with
    speech-class confidence STRICTLY above 0.6. False-positive
    resistance: ambient HVAC vibration captures (low SNR, low speech
    confidence) do NOT fire – boundary is exclusive. The signed body
    NEVER carries the recovered audio bytes – only the feature vector
    digest, SNR, and confidence.
  - `keystroke-recovered` (red-team): signed `ReconstructionResult`
    with keystroke-class confidence STRICTLY above 0.7. Higher than
    speech because the false-positive cost of "I recovered your
    password" is high. The signed body NEVER carries the recovered
    chars – only the rhythm confidence and SNR.
  - `remote-surveillance-detected` (blue-team): signed `LidarCapture`
    whose `surveillanceSweepDetected` flag is true (own-LIDAR
    detected an external high-frequency target sweep painting the
    operator's windows). False-positive resistance: a non-painted
    capture (no sweep energy) does NOT fire.

  ALPHA STATUS: real LIDAR phase-unwrap -> speech reconstruction is
  the "annoying math" the Phase 12 plan flags as research-required.
  `reconstructAudio({ frames, sampleRateHz })` is deterministic –
  given the same input it returns the same `{ featureVector, snrDb,
speechConfidence, keystrokeConfidence, ambientConfidence }` so
  tests pin specific behaviours. Real Livox Mid-360 / iPhone-Pro
  LiDAR integration + real phase-unwrap math (Itoh's 1D phase unwrap,
  branch-cut 2D unwrap, residue tracking) is research-required and
  lands in a follow-up. The PROGRAM SHAPE – capture -> reconstruction
  attestation -> red/blue-team toggle – is the alpha deliverable.

  New CLI:

  - `pluck bureau lidar-whisper demo`

  New package: `@sizls/pluck-bureau-lidar-whisper` (Directive-first
  module + system + plugin). Adds:

  - `types.ts`: LidarCapture (raw range-distance frames at 30 Hz,
    capture timestamp, location-hash, hardware fingerprint,
    target-window fingerprint, surveillanceSweepDetected flag),
    ReconstructionResult (recovered-audio feature vector + SNR + per-
    class confidences), LidarWhisperProof. Bounds: MAX_CAPTURES=10000,
    MAX_RECONSTRUCTIONS=10000, MAX_PROOFS=1024,
    MAX_FRAMES_PER_CAPTURE=65536, MAX_FEATURE_VECTOR_LEN=65536,
    SPEECH_RECOVERED_THRESHOLD=0.6, KEYSTROKE_RECOVERED_THRESHOLD=0.7.
  - `canonicalization.ts`: byte-stable canonical-JSON, raw 32-byte
    digest signing (cosign-interop), full 64-hex SPKI fingerprints,
    strict ISO 8601 UTC. Three distinct predicate URIs:
    `https://pluck.run/LidarWhisper.{Capture,Reconstruction,Proof}/v1`.
  - `lidar-stub.ts`: `reconstructAudio()` deterministic phase-unwrap
    - classifier stub, `detectKeystrokeRhythm()` rhythm probability,
      `detectSurveillanceSweep()` blue-team detector,
      `digestFeatureVector()` quantized digest. Real hardware bridge
      swaps in by replacing this file.
  - `whisper.ts`: 3-class detector (speech-recovered /
    keystroke-recovered / remote-surveillance-detected), candidate-
    key dedupe, dossier Merkle root, proof assembly + signing.
  - `module.ts`: Directive `createModule` (~250 LOC) – facts (captures
    / reconstructions / proofs / notarizedProofs / paused / aborted),
    derivations (capturesByLocation / reconstructionsByCapture /
    proofCandidates / pendingNotarize / dossierMerkleRoot),
    constraints (reconstructionPending priority 60 / proofDetected
    priority 80 / proofReadyToNotarize priority 100 with paused gate),
    resolvers (RECONSTRUCT / EMIT_PROOF / NOTARIZE_PROOF), effects
    (emitCaptureMetric / persistCassette / pausePoll / broadcastProof).
  - `system.ts`: `createLidarWhisperSystem` factory (~200 LOC) wired
    with logging + devtools + performance + observability plugins.
  - `plugin.ts`: `pluck bureau lidar-whisper demo` CLI subcommand –
    in-memory: 4 LidarCaptures (1 ambient baseline + 1 speech
    recovery + 1 keystroke recovery + 1 surveillance ping) -> 3
    LidarWhisperProofs (1 speech-recovered + 1 keystroke-recovered +
    1 remote-surveillance-detected).
  - 30+ tests covering canonicalization (~8), whisper detector + stub
    (~10), and Directive constraint chain (~12).

  Coordination:

  - `@sizls/pluck-bureau-core`: adds `"lidar-whisper"` to
    `BureauProgramId`.
  - `@sizls/pluck-bureau-cli`: registers `lidar-whisper` in the
    dispatch table + tagline.
  - `@sizls/pluck-cli`: adds the workspace dep + the side-effect
    `import "@sizls/pluck-bureau-lidar-whisper/plugin";` at boot.
  - `pluck-studio`: appends the LIDAR-WHISPER tile (status: "alpha").

  R1-hardening:

  - index.ts type-pure / register.ts side-effect / `./plugin` subpath
    / `sideEffects` allowlist.
  - Distinct predicate URIs for capture / reconstruction / proof.
  - Raw 32-byte digest signing (cosign-interop), full 64-hex SPKI
    fingerprints, strict ISO 8601 UTC.
  - Three predicate validators registered at module load (TOFU R1
    pattern).
  - Fail-closed `paused` gate on NOTARIZE_PROOF.
  - RECOVERED-SPEECH BYTES NEVER appear in any signed body – only the
    reconstruction feature vector digest + SNR + confidence values.
    RECOVERED-KEYSTROKE CONTENT NEVER appears – only rhythm
    confidence + SNR. CRITICAL: this program by definition handles
    recovered surveillance content; leaking it through the proof
    timeline would defeat the whole posture.
  - Cassette persistence stubbed for alpha.
  - Real LIDAR phase-unwrap math stubbed; the program shape is the
    deliverable.

- 156492a: [feat] NEURO-CONSENT – BCI command + visual-stimulus prompt-injection
  attestation, Phase 12 Moonshot alpha.

  P300 spellers and SSVEP BCIs are getting prompt-injected via flickering
  visual stimuli (researchers showed adversarial flicker patterns inject
  "yes" into a paralyzed user's BCI). Every motor command emitted by BCI
  is signed with a (raw-EEG-digest, stimulus-frame-digest,
  classifier-version) tuple – first neural-rights-grade audit primitive.
  Chile already passed neural-rights legislation.

  Three observation classes:

  - **adversarial-flicker-detected** (red-team): stub adversarial-flicker
    classifier returned `isAdversarial: true` with confidence STRICTLY
    above 0.7 – visual stimulus is prompt-injecting BCI. False-positive
    resistance via consent-suppression: a legit user-initiated novel
    command after explicit re-consent (the kind IS in the user's consent
    envelope) does NOT fire even when the stub classifier hits.
  - **consent-violation** (red-team): motor command emitted that's
    outside the user's signed consent envelope (e.g., user consented to
    "yes/no" responses but command is "approve-transaction"). False-
    positive resistance: a kind on the consented list does NOT fire.
  - **classifier-version-mismatch** (red-team): BCI's classifier version
    in the signed command does NOT match the latest signed neural-rights
    manifest version – drift after compromise. False-positive
    resistance: a matching version does NOT fire.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. PII posture is
  HIPAA-grade: raw EEG bytes NEVER appear in any signed body (only
  sha256 digest), raw stimulus pixels NEVER appear (only digest), raw
  user-id NEVER appears (only sha256 hash). `redactBureauPayload` runs
  as the pre-attest gate. ALPHA STATUS: real P300 / SSVEP adversarial-
  flicker classifier integration is research-required –
  `detectAdversarialStimulus()` is a deterministic stub so tests pin
  specific behaviours; real classifier integration lands post-alpha.
  The PROGRAM SHAPE (raw EEG digest + stimulus frame digest +
  classifier version → motor command attestation) is the alpha
  deliverable.

  Single demo CLI subcommand: `pluck bureau neuro-consent demo` –
  4 BciCommands (1 legit yes/no consented + 1 adversarial-flicker +
  1 out-of-envelope $-transfer + 1 stale classifier) → 3
  NeuroConsentProofs.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"neuro-consent"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append `"neuro-consent"` +
    tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    lidar-whisper).
  - `@sizls/pluck-cli` package.json: workspace dep alphabetically
    between mole and nuclei.
  - Studio `programs.ts`: append NEURO-CONSENT tile (status `alpha`).

- 5718ff0: [feat] QKD-WITNESS – BB84 quantum key distribution attestation +
  post-quantum migration ledger, Phase 12 Moonshots Directive-first
  alpha.

  QKD systems output a key + an error rate (QBER). No standard attests
  "this key came from a non-tampered BB84 channel at QBER < 11%."
  Bureau mints that statement. Also tracks fleet-wide migration from
  Ed25519 -> ML-DSA-65 with signed transition events –
  `harvest-now-decrypt-later` accountability. The world is quietly
  stockpiling classical-encrypted traffic today, hoping a future
  PQ-capable adversary will decrypt it. The Bureau makes that fact a
  signed, public timeline.

  Three observation classes:

  - `qber-too-high` (red-team): signed `QkdSession` with QBER strictly
    above the BB84 secure-key threshold of 11%. The 11% boundary is the
    canonical BB84 information-theoretic security cutoff (Shor /
    Preskill 2000). False-positive resistance: QBER == 11% is the
    boundary, STILL secure, does NOT fire – only QBER strictly > 11%
    crosses the gate.
  - `session-equivocation` (red-team): same hardware fingerprint signs
    two `QkdSession`s with conflicting key digests at the SAME
    observedAt instant. A QKD device cannot output two distinct keys
    for the same session at the same wall-clock instant – the
    contradiction names a tampered or cloned device. Distinct
    timestamps (different sessions) do NOT fire. Identical key digests
    at the same timestamp (idempotent re-observation) do NOT fire.
  - `harvest-then-decrypt` (red-team): a classical-encrypted asset was
    harvested by an adversary BEFORE the operator's `MigrationEvent`
    transition from Ed25519 -> ML-DSA-65. The operator can no longer
    claim the asset was "always post-quantum protected" – by definition
    it was classical at harvest time. False-positive resistance: a
    harvest AT or AFTER the migration does NOT fire – the asset was
    already PQ-protected when the adversary harvested it.

  ALPHA STATUS: the BB84 hardware bridge is STUBBED.
  `readQkdSession({ label, qber, hardwareLabel })` returns a
  deterministic `{ keyDigest, qber, hardwareFingerprint }` triple so
  tests are reproducible. Real BB84 hardware integration (IDQ Clavis³,
  Toshiba MU200, Qubitekk QC2) is research-required and lands in a
  follow-up. The PROGRAM SHAPE – key attestation -> QBER threshold
  check -> post-quantum migration ledger -> harvest-then-decrypt
  detection – is the alpha deliverable.

  New CLI:

  - `pluck bureau qkd-witness demo`

  New package: `@sizls/pluck-bureau-qkd-witness` (Directive-first
  module + system + plugin). Adds:

  - `types.ts`: QkdSession (key digest, QBER, hardware fingerprint,
    timestamp), MigrationEvent (signed Ed25519 -> ML-DSA-65 transition),
    HarvestNowDecryptLaterMarker (signed acknowledgment), QkdProof.
    Bounds: MAX_SESSIONS=10000, MAX_MIGRATION_EVENTS=10000,
    MAX_HARVEST_MARKERS=10000, MAX_PROOFS=1024, QBER_SECURE_THRESHOLD=0.11.
    Algorithm allowlists for from/to migration.
  - `canonicalization.ts`: byte-stable canonical-JSON, raw 32-byte
    digest signing (cosign-interop), full 64-hex SPKI fingerprints,
    strict ISO 8601 UTC. Four distinct predicate URIs:
    `https://pluck.run/QkdWitness.{Session,Migration,HarvestMarker,Proof}/v1`.
  - `qkd-stub.ts`: `readQkdSession()` deterministic BB84 bridge stub +
    `verifyQberThreshold()` boundary-inclusive 11% check. Real
    hardware bridge swaps in by replacing this file.
  - `quantum.ts`: 3-class detector (qber-too-high / session-
    equivocation / harvest-then-decrypt), candidate-key dedupe, dossier
    Merkle root, proof assembly + signing.
  - `module.ts`: Directive `createModule` (~250 LOC) – facts (sessions
    / migrations / harvestMarkers / proofs / notarizedProofs / paused /
    aborted), derivations (sessionsByHardware /
    latestMigrationByOperator / harvestMarkersByOperator /
    proofCandidates / pendingNotarize / dossierMerkleRoot), constraints
    (proofDetected priority 80 / proofReadyToNotarize priority 100 with
    paused gate), resolvers (EMIT_PROOF / NOTARIZE_PROOF), effects
    (emitSessionMetric / persistCassette / pausePoll / broadcastProof).
  - `system.ts`: `createQkdWitnessSystem` factory (~200 LOC) wired with
    logging + devtools + performance + observability plugins.
  - `plugin.ts`: `pluck bureau qkd-witness demo` CLI subcommand –
    in-memory: 3 QkdSessions (1 valid + 1 high-QBER + 1 equivocation
    pair) + 1 MigrationEvent (Ed25519 -> ML-DSA-65) + 1
    HarvestNowDecryptLaterMarker (asset harvested 10d BEFORE migration)
    -> 3 QkdProofs (1 qber-too-high + 1 session-equivocation + 1
    harvest-then-decrypt).
  - 30+ tests covering canonicalization (~8), quantum detector + stub
    (~10), and Directive constraint chain (~12).

  Coordination:

  - `@sizls/pluck-bureau-core`: adds `"qkd-witness"` to
    `BureauProgramId`.
  - `@sizls/pluck-bureau-cli`: registers `qkd-witness` in the dispatch
    table + tagline.
  - `@sizls/pluck-cli`: adds the workspace dep + the side-effect
    `import "@sizls/pluck-bureau-qkd-witness/plugin";` at boot.
  - `pluck-studio`: appends the QKD-WITNESS tile (status: "alpha").

  R1-hardening:

  - index.ts type-pure / register.ts side-effect / `./plugin` subpath /
    `sideEffects` allowlist.
  - Distinct predicate URIs for session / migration / harvest-marker /
    proof.
  - Raw 32-byte digest signing (cosign-interop), full 64-hex SPKI
    fingerprints, strict ISO 8601 UTC.
  - Four predicate validators registered at module load (TOFU R1
    pattern).
  - Fail-closed `paused` gate on NOTARIZE_PROOF.
  - QKD KEY BYTES NEVER appear in any signed body – only the key digest
    is carried; ciphertext bytes for harvest markers stay opaque (only
    the asset digest).
  - Cassette persistence stubbed for alpha.
  - Real BB84 hardware bridge stubbed; the program shape is the
    deliverable.

- 317ce2e: [feat] ELECTION-DAY-WATCH – every contested polling place under co-
  signed observation in real time, one CLI ships a court-admissible
  cassette by midnight. Phase 13 META-DOSSIER opener.

  ELECTION-DAY-WATCH is the first META-DOSSIER program – it doesn't add
  a new detection primitive; it ORCHESTRATES seven existing Bureau
  programs (COORDINATED, STINGRAY, CELESTE, DRAGNET, EVIDENCE-LOCKER,
  PRESS-PIPE, GOSSIP) into a single signed envelope per precinct per
  election day. A civilian observer walks a polling place with a $40
  RTL-SDR + phone; the program collects red dots from each substrate
  program, clusters cross-program co-fires (a STINGRAY equivocation
  that fires within 30 minutes of a CELESTE time-tamper at the same
  precinct gets HIGHER priority than each in isolation), and produces
  a single FRE-902 court-admissible cassette by midnight. The dossier
  shape is the universal meta-dossier template every other meta-
  dossier (PHARMA-MIRROR, AUTONOMY-LEDGER, SCIF-AUDIT, FRONTLINE-
  WITNESS) inherits from.

  Three observation classes:

  - **single-program-incident** (red-team): any of the 7 substrate
    programs emits a red dot for this precinct. Green observations do
    NOT fire – the substrate program already gates legit-vs-falsification
    (legit cell-tower handover, organic news convergence, vendor
    maintenance window stay inside their respective substrate gates).
  - **cross-program-incident** (red-team): 2+ DISTINCT substrate
    programs co-fire within an INCLUSIVE 30-min window for the same
    precinct. Higher-priority cassette + auto-route to DOJ. False-
    positive resistance via DISTINCT-program count – two STINGRAY dots
    10 min apart do NOT cluster (the program looks for breadth across
    substrates, not depth within one); the 30-min window is INCLUSIVE
    (exactly 30 min apart fires, 31+ min apart does NOT).
  - **dossier-finalized**: end-of-day Merkle-rolled signed envelope
    with k-of-n GOSSIP cosign quorum. Fail-closed paused gate on
    finalize so an operator can halt instantly via the bureau-wide
    kill-switch.

  Built Directive-first via `@directive-run/core` – facts/derivations/
  constraints/resolvers/effects all in `module.ts`. Constraint priorities
  70 (cosignShortfall) / 80 (incidentDetected) / 90 (crossProgramCluster)
  / 100 (dossierReadyToFinalize, paused-gated). PII posture: voter PII
  NEVER appears in any signed body or TimelineDot summary; precinctId
  rides as a stable identifier; the substrate-program citation is an
  opaque digest (not the raw STINGRAY tower observation, raw CELESTE
  GPS fix, raw COORDINATED bot mention, etc.). The Bureau attests the
  _integrity_ + _cross-program co-fire_ of the dot stream, never the
  cleartext of the upstream program's payload. `redactBureauPayload`
  strips any operator-supplied context strings BEFORE attest.

  Single demo CLI subcommand: `pluck bureau election-day-watch demo` –
  1 precinct claim ("ZZ-12, Cook County IL") + 4 substrate-program
  dots (1 STINGRAY equivocation + 1 CELESTE time-tamper + 1
  COORDINATED bot-cluster + 1 DRAGNET vendor probe-fail) all within a
  30-min window for the same precinct → 1 cross-program incident
  escalates → 1-of-1 GOSSIP cosign quorum → dossier finalizes → exits
  0 with the dossier digest printed.

  Predicate URIs (3 distinct):

  - `https://pluck.run/ElectionDayWatch.PrecinctClaim/v1`
  - `https://pluck.run/ElectionDayWatch.IncidentExhibit/v1`
  - `https://pluck.run/ElectionDayWatch.Dossier/v1`

  ALPHA STATUS: alpha accepts unified-shape PrecinctDots as opaque
  JSON inputs; full runtime composition (subscribing to actual
  COORDINATED / STINGRAY / CELESTE / DRAGNET / EVIDENCE-LOCKER /
  PRESS-PIPE / GOSSIP system instances' fact streams) wires in a
  follow-up. Production CLI surface (`init` / `walk` / `finalize` /
  `verify`) lands in a follow-up alongside Studio routes + docs page
  at docs.pluck.run/bureau/election-day-watch.

  Coordination changes:

  - `@sizls/pluck-bureau-core` `BureauProgramId` union: append
    `"election-day-watch"`.
  - `@sizls/pluck-bureau-cli` `dispatch.ts`: append
    `"election-day-watch"` + tagline.
  - `@sizls/pluck-cli`: side-effect import the new plugin (after
    cherenkov-witness); workspace dep added alphabetically (between
    dragnet and ember).
  - Studio `programs.ts`: append ELECTION-DAY-WATCH tile (status
    `alpha`).

- Updated dependencies [82e33a4]
- Updated dependencies [82e33a4]
- Updated dependencies [8d771ef]
- Updated dependencies [dcfcb76]
- Updated dependencies [1ae7f43]
- Updated dependencies [577dce0]
- Updated dependencies [cb3fa96]
- Updated dependencies [4b47db9]
- Updated dependencies [7a70064]
- Updated dependencies [a431b21]
- Updated dependencies [270703f]
- Updated dependencies [b113ce0]
- Updated dependencies [33d03f1]
- Updated dependencies [2b1a647]
- Updated dependencies [b23dde2]
- Updated dependencies [b415faa]
- Updated dependencies [156492a]
- Updated dependencies [5718ff0]
- Updated dependencies [317ce2e]
- Updated dependencies [c4bf028]
- Updated dependencies [a7723da]
- Updated dependencies [9195013]
- Updated dependencies [9a5af5f]
- Updated dependencies [0f9e604]
- Updated dependencies [93f8eba]
- Updated dependencies [96c202a]
- Updated dependencies [0282cb9]
- Updated dependencies [6d7bec7]
- Updated dependencies [587f8f4]
- Updated dependencies [0048f92]
- Updated dependencies [5dfc5e9]
- Updated dependencies [257db33]
- Updated dependencies [d4f7ba6]
- Updated dependencies [82e33a4]
- Updated dependencies [6c3d2a9]
- Updated dependencies [6c3d2a9]
  - @sizls/pluck-bureau-core@1.0.0
  - @sizls/pluck-bureau-custody@0.2.0
  - @sizls/pluck-bureau-bounty@0.2.0
  - @sizls/pluck-bureau-ui@0.2.0

## 0.1.0

### Minor Changes

- 415a07a: Phase 0 – Pluck Bureau UI components + Pluck Studio Next.js app.

  ## `@sizls/pluck-bureau-ui` (new package)

  React component library shared across every Bureau program:

  - **`<BureauChrome>`** – Studio header (wordmark, full program nav with active-state highlighting, optional auth slot) + footer (Sigstore attribution + docs/source links). Wraps every Bureau page.
  - **`<TimelineDot>`** – Strava-like single dot. Three tones (green / red / black). Tooltip carries reason + Rekor uuid + emittedAt. Click → deep-dive page.
  - **`<RekorSearch>`** – Self-contained input that detects uuid vs logIndex, deep-links to sigstore.dev + rekor.sigstore.dev API, and renders inclusion-proof verification status when caller wires `onVerify`.
  - **`<EmbedBadge>`** – Embeddable green/red/black badge for vendor pages. Vendors with clean DRAGNET timelines opt in; vendors with red badges get critics embedding the badge anyway. Asymmetric pressure.
  - **`<QuorumBadge>`** – Quorum decision (passed / failed / split) with N-of-M agree count. Color-coded.
  - **`<DossierViewer>`** – Per-target timeline view. Verifies the dossier hash before render; shows tamper-warning banner on mismatch instead of the timeline.
  - **`<VendorLeaderboard>`** – Public ranking table of vendors by bureau honesty score. Tone bucketed (green ≥0.9, yellow ≥0.6, red <0.6).

  All components render plain HTML + class hooks; theming lives in the consuming app's CSS so embedders can match their brand.

  ## `@sizls/pluck-studio` (new app, `apps/pluck-studio/`)

  Next.js 15 SSR app deployed to `studio.pluck.run` (mirrors `docs.pluck.run` deploy pattern). Routes:

  - `/` → redirects to `/bureau`
  - `/bureau` – Bureau index with hero, RekorSearch widget, 11-tile program grid (status chips: live / alpha / soon / research)
  - `/bureau/leaderboard` – Vendor leaderboard (placeholder data; populated by Phase 1 DRAGNET ingestion)
  - `/bureau/monitors` – Public quorum-node directory placeholder
  - `/bureau/monitors/[name]` – Per-monitor profile placeholder
  - `/api/bureau/[program]/ingest` – Phase 0 placeholder returning 501 (Phase 1 wires Kite Runtime)

  **Vanity rewrites:** `/<program>/...` → `/bureau/<program>/...` for all 11 program ids, so `studio.pluck.run/dragnet/openai/gpt-4o` resolves canonically. Every shared link is a Pluck Bureau ad.

  **Theming:** Dark mode by default (`#0a0a0a` background, mono-font wordmark + nav, accent green `#00d36b`). Single `globals.css` covers chrome + components.

  ## Substrate: Kite for 3rd-party service provisioning

  The plan now declares **Kite** (sibling repo) as the canonical substrate for Bureau infrastructure. `apps/pluck-studio` will consume `@sizls/kite-contracts` for the runtime handler, `@sizls/kite-adapter-vercel` for the reference deploy, and `@sizls/kite-event-log` for dossier persistence – all wired in Phase 1. Bureau-core remains Kite-free; the library layer stays embeddable anywhere.

### Patch Changes

- 956fff0: Phase 1.5 – ROTATE (alpha): signing-key compromise response. When an Ed25519 operator key is compromised, ROTATE publishes a signed `KeyRevocation/v1` to Rekor; the bureau re-witnesses every prior cassette signed by that key under a "compromised" annotation; affected vendors get auto-broadcast notifications; press kits regenerate citing the compromise window.

  ## Trust invalidation, NOT crypto-shred

  A revocation does NOT remove signed Rekor entries from the public log – that's impossible against a public Merkle tree by design. ROTATE publishes NEW signed observations that live alongside the originals. Verifiers MUST consult the compromise ledger before trusting any historical signature from a revoked fingerprint. This is documented in the package README, type JSDoc, and Studio landing page.

  ## What ships

  - **`@sizls/pluck-bureau-rotate`** – new workspace package.
    - `revokeKey({ signingKey, previousFingerprint, compromiseWindow, reason, acceptPublic })` – builds a `KeyRevocation/v1`, signs with the OLD key (proves operator owns it), publishes to Rekor. Cross-checks `previousFingerprint` against the signing key BEFORE publishing.
    - `reWitness({ revocationRekorUuid, revocation, targets, signingKey })` – given a verified revocation + a list of target Rekor uuids, classifies each `votedAt` against the compromise window (`before-revocation` / `during-window` / `after-replacement` / `trust-but-flag`) and signs a `ReWitnessReport/v1` with the NEW key.
    - `classifyCompromise({ votedAt, window, trustButFlag? })` – pure classifier with `since`-inclusive / `until`-exclusive boundary semantics.
    - `verifyRotation(rekorEntry)` – fail-closed verification with stable reason codes (`predicate-type-unknown`, `schema-version-unsupported`, `fingerprint-format-invalid`, `fingerprint-mismatch`, `window-invalid`, `reason-too-long`, `published-at-invalid`, `signature-invalid`, etc.).
    - `rebuildDisclosure({ previousFingerprint, previousDisclosureRekorUuid, newDisclosureRekorUuid, revocationRekorUuid, signingKey })` – anchors a new `Disclosure/v1` to the previous one + the revocation that triggered the rebuild, signed by the NEW key.
    - Bureau CLI plugin registers on import: `pluck bureau rotate revoke | re-witness | verify-rotation | disclosure-rebuild`.
  - **Studio route** – `apps/pluck-studio/src/app/bureau/rotate/page.tsx` – landing explaining trust-invalidation semantics + a "has this fingerprint been revoked?" search box (placeholder; Phase 2 wires Kite Event Log).
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips ROTATE status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the rotate plugin registers automatically on `pluck` startup.

  ## Hardening

  - Ed25519 only, signed over RAW PAE bytes (cosign / sigstore-go interop).
  - `schemaVersion: 1` literal – no string drift.
  - `previousFingerprint` cross-checked against the signing-key fingerprint BEFORE publishing – typos are caught at the boundary.
  - `replacementFingerprint`, when supplied, must differ from `previousFingerprint`.
  - `reason` capped at 1024 chars; per-target `note` capped at 1024 chars.
  - `re-witness` pass capped at MAX_ANNOTATIONS (10 000) per report.
  - `compromiseWindow` validated as strict ISO 8601 UTC; `until` must be strictly after `since` (or `"unbounded"`).
  - Re-witness reports MUST be signed by the NEW key – the bureau verifier refuses a report signed by the revoked fingerprint.
  - `--accept-public` mandatory when the destination is the Sigstore public-good Rekor.

  ## Tests added

  - `revoke.test.ts` – round-trip a KeyRevocation through revokeKey + verifyRotation; refuses fingerprint typo; refuses replacement == previous; refuses until <= since; predicate-type / schema / window gate matrix.
  - `re-witness.test.ts` – classifies pre/during/after correctly; honors `trustButFlag`; quarantines malformed targets via `skipped[]`; refuses empty target list; rejects oversize note.
  - `compromise-window.test.ts` – boundary cases (vote at exactly `since`, vote at exactly `until`, unbounded window); rejects non-UTC + reversed window.
  - `disclosure-rebuild.test.ts` – refuses signing-key == previousFingerprint; refuses non-hex uuids; round-trips through a mocked Rekor.
  - `plugin.test.ts` – every CLI action's missing-flag path + `--accept-public` gate.

  ## Notes

  - This program ships TOGETHER with SBOM-AI – both must be operational before NUCLEI's community probe-pack ecosystem opens.

- 956fff0: Phase 1.5 – SBOM-AI (alpha): Sigstore-anchored AI supply-chain registry. Every probe-pack, every model card, every MCP-server release publishes an in-toto attestation with predicateType `https://pluck.run/SbomEntry/v1` to Rekor. Probe-pack consumers verify provenance before running probes; vendors embed Pluck-Bureau-anchored badges on every model card.

  ## What ships

  - **`@sizls/pluck-bureau-sbom-ai`** – new workspace package.
    - `attestProbePack({ pack, signingKey, acceptPublic })` – wraps a `ProbePack` body and posts a `SbomEntry/v1` to Rekor under kind `probe-pack`. The pack's canonical `packHash` becomes `artifactDigest`.
    - `attestModelCard({ card, signingKey, acceptPublic })` – canonical-JSON-hashes a Hugging Face / OpenAI ModelCard JSON, attests under kind `model-card`.
    - `attestMcpServer({ artifactBytes, name, signingKey, acceptPublic })` – sha256 of an MCP-server release tarball's raw bytes (interoperable with `cosign sign-blob`), attests under kind `mcp-server`.
    - `verifySbomEntry(rekorEntry, expectedFingerprint?)` – fail-closed verification with stable reason codes (`predicate-type-unknown`, `schema-version-unsupported`, `kind-invalid`, `artifact-digest-invalid`, `fingerprint-mismatch`, `published-at-invalid`, `metadata-too-large`, `signature-invalid`, etc.).
    - `createSbomRegistry({ maxEntries })` – process-local hot-cache of verified entries, indexed by digest + kind, FIFO-evicted at 100 000.
    - Bureau CLI plugin registers on import: `pluck bureau sbom-ai publish | verify | lookup | index`.
  - **Studio routes** – `apps/pluck-studio/src/app/bureau/sbom-ai/{page,[sha]/page}.tsx` – landing + per-artifact placeholder. Phase 2 wires Kite Event Log lookup.
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips SBOM-AI status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the sbom-ai plugin registers automatically on `pluck` startup.

  ## Hardening

  - Ed25519 only, signed over RAW PAE bytes (cosign / sigstore-go interop).
  - `schemaVersion: 1` literal – no string drift.
  - `artifactDigest` validated as lowercase 32-byte sha256 hex on every entry, both at sign time AND verify time.
  - `authorFingerprint` = full 64-hex SPKI sha256 (not truncated).
  - `publishedAt` strict ISO 8601 UTC (`Z`-terminated).
  - `metadata` capped at 64 KiB canonical-JSON.
  - `name` allowlist – `[a-z0-9][a-z0-9._\-/]*` with no `..`.
  - Subject digest cross-checked against predicate `artifactDigest`.
  - `--accept-public` mandatory when the destination is the Sigstore public-good Rekor.

  ## Tests added

  - `attest.test.ts` – round-trip a SbomEntry through attest+notarize for all three kinds; mocked Rekor; validate-on-sign gate matrix.
  - `verify.test.ts` – good entry, bad signer, malformed predicate, schemaVersion drift, kind-invalid, name path-traversal, non-UTC publishedAt, signature tamper.
  - `registry.test.ts` – ingest, lookup-by-sha, list-by-kind, list-since, idempotent uuid replay, FIFO eviction at maxEntries.
  - `plugin.test.ts` – every CLI action's missing-flag path + `--accept-public` gate.

  ## Notes

  - Phase 1.5 ships local-only registry; Phase 2 wires the Kite Event Log so a public Studio render reflects ingested entries.
  - This program ships TOGETHER with ROTATE – both must be operational before NUCLEI's community probe-pack ecosystem opens.

- 510a4c5: Phase 1 – DRAGNET (alpha): the flagship Pluck Bureau program. A continuously-running adversarial AI-vendor honesty monitor that composes 11 of the 12 Pluck verb-modules (`attest`, `notarize`, `contradict`, `mirror`, `shadow`, `snare`, `witness`, `broadcast`, `subpoena`, `press`, `admit`).

  ## What ships

  - **`@sizls/pluck-bureau-dragnet`** – new workspace package.
    - `runDragnet(config)` daemon entrypoint and `huntOnce(config, state)` for single-iteration test / CI use.
    - `classify({ probe, result, ... })` pure classifier – picks tone (green / red / black) and reason (`contradict:`, `snare:`, `shadow:`, `mirror-drift`, `expect:must-include:`, `expect:must-not-include:`, `runner-error`, `notarize-error`, `attest-error`, `empty-response`).
    - `defaultProbeRunner` – OpenAI-compatible chat-completions runner. Pluggable via `DragnetConfig.runner` for tests + bespoke hosts.
    - Bureau CLI plugin registers on import: `pluck bureau dragnet run | verify | pack-init | pack-sign`.
  - **Studio routes** – `apps/pluck-studio/src/app/bureau/dragnet/`:
    - `page.tsx` program landing
    - `[vendor]/[model]/page.tsx` per-target timeline (placeholder dossier in alpha)
    - `[vendor]/[model]/[dotId]/page.tsx` red-dot deep-dive (Rekor uuid, cosign verify command, sigstore-search link)
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips DRAGNET status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the dragnet plugin registers automatically on `pluck` startup.

  ## Hunt loop semantics

  Per-tick (until `abortSignal.aborted`):

  1. For each probe in `probePack.probes`:
     - `runner.runProbe()` → live response
     - `recordingProvider` + `attestCassette` → DSSE-wrapped in-toto Statement v1 (Pluck `AgentRun/v1` predicate)
     - Unless `dryRun`, `notarizeAttestation` → Rekor entry (uuid + logIndex + integratedTime)
     - `classify()` against vendor oath (contradict), prior baseline (mirror), shadow signatures, snare sentinels, and probe-pack matchers
     - `appendDot()` writes a `TimelineDot` into the per-target dossier; `dossier.json` is atomically persisted to `outputDir`
  2. Counters update; `runDragnet()` returns a `DragnetRunSummary` on natural termination.

  ## Tests added

  - `classify.test.ts` – 14 tests exercising every tone + every reason path
  - `hunt.test.ts` – 17 tests covering full loop (green / red / black), dry-run, abort signal, runner failure, notarize failure, dossier persistence, prevDotId chain, mirror baseline retention, validateConfig errors
  - `plugin.test.ts` – 16 tests covering CLI dispatcher routing, missing-flag error paths, `pack-init`, `pack-sign`, and `verify` forwarding

  ## Notes

  - Programs MUST NOT inline Kite – bureau-core stays Kite-free. The hunt loop runs in-process; the Phase 1.5+ ingestion API at `apps/pluck-studio/src/app/api/bureau/dragnet/ingest/route.ts` is the Kite Runtime Handler boundary (still a 501 placeholder this release).
  - Ed25519 only. Sign raw 32-byte digest (cosign interop).

- 9b56fed: Phase 2 – TRIPWIRE (alpha): Wireshark-of-agent-traffic. In-process JS-layer interceptor that captures every outbound LLM request from the dev machine, attests + notarizes locally, and flags any cassette matching a known red-dot pattern.

  ## JS-layer scope (eBPF / NX deferred)

  Phase 2 alpha ships the **in-process JavaScript-layer interceptor**. It patches `globalThis.fetch` (undici-backed in Node 18+) and `node:http` / `node:https` `request` so every Node-process LLM client gets captured. That covers essentially every modern Node-based LLM SDK without entitlements.

  The native macOS Network Extension and Linux eBPF hooks are deferred to **Phase 2.5** – they require entitlements + libbpf bindings that aren't trivial to ship inside an npm package. The deferral is stated openly in the package README, the CLI help text, and the Studio landing page so operators don't expect more than the alpha delivers.

  ## What ships

  - **`@sizls/pluck-bureau-tripwire`** – new workspace package.
    - `runTripwire(config)` – long-running daemon coordinator. Installs both interceptors, routes captures through `matchPolicy` + `emitTripwireEvent`, persists cassettes + dossier, drains in-flight emits on `AbortSignal`.
    - `installFetchInterceptor` / `installHttpInterceptor` – idempotent wrappers around the host's outbound HTTP surface. Return an `uninstall()` handle. Both interceptors short-circuit non-LLM traffic by default; `captureAll: true` opts in to a full audit.
    - `matchPolicy(event, policy)` – pure classifier returning `{ tone, reason, isLlmTraffic }`. Default tone is `green`; rules express explicit `red` / `black` overrides.
    - `defaultPolicy()` – ships with OpenAI, Anthropic, Google, OpenRouter, and Ollama (localhost:11434) endpoint patterns.
    - `emitTripwireEvent({ capture, match, config, dossier, ... })` – wraps the (request, response) pair in a Pluck cassette → `attestCassette` → optionally `notarizeAttestation` → `appendDot` → returns the new dossier.
    - `canonicaliseEndpoint(url)` – strips `api_key=` / `access_token=` / `token=` / `secret=` / `password=` query params before they hit a `TripwireEvent`.
    - Bureau CLI plugin registers on import: `pluck bureau tripwire install | status | export | uninstall`.
  - **Studio routes** – `apps/pluck-studio/src/app/bureau/tripwire/page.tsx` (landing) + `apps/pluck-studio/src/app/bureau/tripwire/me/page.tsx` (per-machine timeline placeholder).
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips TRIPWIRE status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the tripwire plugin registers automatically on `pluck` startup.

  ## Privacy + secrecy posture

  - **Bodies are LOCAL ONLY.** Request bodies and response bodies become a Pluck cassette and stay on disk in `<outputDir>/cassettes/<envelopeHash>.json`. They are NEVER embedded in `TimelineEvent`, `TimelineDot.summary`, or `TimelineDot.reason`.
  - **No SSL termination.** TRIPWIRE is in-process – it sees the request before the http layer encrypts. We don't MITM.
  - **Notarization is opt-in.** Pass `--notarize` (CLI) or `notarize: true` (library) to publish the DSSE envelope to Rekor. Default is local-only; the dossier hash is the only thing that ever touches the bureau.

  ## Hardening

  - index.ts type-pure / register.ts side-effect / `./plugin` subpath / `sideEffects` allowlist.
  - Full 64-hex SPKI fingerprints on `operatorFingerprint` (validated at config time).
  - Strict ISO 8601 UTC validation on every persistent timestamp; `now()` injection sanity-checked at config validation.
  - Bounds caps everywhere – `MAX_WATCHED_MODELS = 1_000`, `MAX_POLICY_RULES = 1_000`, `DEFAULT_MAX_EVENTS = 100_000`, `DEFAULT_MAX_CASSETTE_BYTES = 1 MiB`.
  - Canonical-JSON for every signed body (via `@sizls/pluck-bureau-core/canonicalStringify`).
  - Strict identifier validation on `--machine` (rejects path-traversal + shell-special chars).
  - Atomic write (tmp+rename, mode 0o600) for both cassette and dossier.
  - AbortSignal threaded through daemon + interceptor uninstall; Ctrl-C drains the in-flight emit queue before tearing down.
  - Cassette persistence is path-validated – refuses any envelopeHash that isn't 1–128 hex chars.

  ## Platform

  - **Linux / macOS** – fully supported. Operator-key permission enforcement (0600) gates loose key files (R1 finding).
  - **Windows** – JS-layer interceptors work; local-key permission enforcement is POSIX-only (R1 finding). README documents this.

  ## Tests added

  - `interceptor.test.ts` – fetch wrapper captures POST + GET, redacts query secrets, uninstalls cleanly, idempotent re-install; http wrapper installs + returns a working uninstall handle.
  - `policy.test.ts` – every match path (vendor / model / endpoint), default tone, watched-model gate, validatePolicy rejects oversized lists / bad tone / empty match; `canonicaliseEndpoint` redacts `api_key=` / `access_token=`; `extractModelFromBody` finds top-level + nested model fields.
  - `emit.test.ts` – green / red dot tones, opt-in notarize, secrecy assertion (no body content in dot summary or reason), atomic cassette + dossier writes with 0o600 perms.
  - `daemon.test.ts` – full loop: stub fetch, run daemon, abort, assert summary counts; respects event cap; rejects malformed signing key / fingerprint / machineId / non-ISO `now()`.
  - `plugin.test.ts` – every CLI action's missing-flag path + identifier validation; `export` copies dossier + cassettes; `uninstall` is the documented no-op; `install` aborts cleanly with an already-aborted signal.

- 29557dd: Phase 3 – NUCLEI (alpha): signed probe-pack registry + community ecosystem. Anyone can author, sign, and publish a probe-pack to Rekor as a `NucleiPackEntry/v1` envelope; DRAGNET subscribers run them automatically (gated by SBOM-AI provenance check); leaderboards rank pack-authors by first-to-red-dot count + total verified red dots; sponsors stake bounties for the first quorum-witnessed contradiction against a vendor's signed claim.

  ## What ships

  - **`@sizls/pluck-bureau-nuclei`** – new workspace package.
    - `publishNucleiPack({ pack, metadata, sbomRekorUuid, signingKey, acceptPublic })` – signs the pack envelope under predicateType `https://pluck.run/NucleiPackEntry/v1` and posts to Rekor. Cross-references an existing SBOM-AI Rekor uuid (REQUIRED – fail-closed).
    - `signNucleiPackOffline(...)` – produce the envelope without notarizing, for CI artifact pipelines.
    - `verifyNucleiPackEntry(rekorEntry, expectedFingerprint?)` – fail-closed verification with stable reason codes (`predicate-type-unknown`, `pack-hash-invalid`, `pack-signature-invalid`, `metadata-too-large`, `vendor-scope-invalid`, `license-invalid`, `sbom-uuid-invalid`, `signature-invalid`, etc.).
    - `createNucleiRegistry({ maxEntries })` – process-local hot-cache of verified entries indexed by author / vendor / tag, FIFO-evicted at 100 000. Trust posture: when an `sbomLookup` is supplied at ingest, the registry verifies that the entry's `sbomRekorUuid` resolves to a verified SBOM-AI entry whose `artifactDigest === packHash` – match → `trustTier: "verified"`; otherwise TOFU `"ingested"`.
    - `subscribeOnce` / `runSubscribeLoop` – cron-style filter with `AbortSignal` plumbed through; emits `DragnetTarget`-shaped tuples the operator threads into a DRAGNET runner.
    - `createBountyOffer({ ... })` / `createBountyClaim({ ... })` – sign + notarize `BountyOffer/v1` and `BountyClaim/v1` predicates. `createBountyRegistry()` records claims and resolves a deterministic winner under multi-witness conditions; sponsors cannot claim their own bounty.
    - `rankLeaderboard({ firstRedDots, totalRedDots, packsPublished, lastActiveAt })` – pure ranking math; deterministic tie-break by fingerprint asc.
    - Bureau CLI plugin registers on import: `pluck bureau nuclei init | sign | publish | subscribe | lookup | bounty offer | bounty claim | leaderboard`.
  - **Studio routes** – `apps/pluck-studio/src/app/bureau/nuclei/{page,[author]/[pack]/page,leaderboard/page}.tsx` – landing + per-pack placeholder + leaderboard preview. Phase 3+ wires Kite Event Log lookup.
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips NUCLEI status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the nuclei plugin registers automatically on `pluck` startup.

  ## Predicate types

  Three distinct predicate URIs (deliberate – shapes never collide):

  - `https://pluck.run/NucleiPackEntry/v1`
  - `https://pluck.run/BountyOffer/v1`
  - `https://pluck.run/BountyClaim/v1`

  Predicate-type validators are registered at module load – `signNucleiStatement` REFUSES to sign an unvalidated body (TOFU pattern lifted from ROTATE's R1 review).

  ## Hardening

  - Ed25519 only, signed over RAW PAE bytes (cosign / sigstore-go interop).
  - `schemaVersion: 1` literal – no string drift.
  - All hashes lowercase 32-byte sha256 hex; all fingerprints full 64-hex SPKI sha256; all timestamps strict ISO 8601 UTC.
  - Bounds: tags ≤ 32 × 64 chars; metadata ≤ 64 KiB canonical-JSON; vendorScope ≤ 64 × 128 chars; description ≤ 4 KiB; license SPDX-style ≤ 64 chars; threshold outOf ≤ 1024; leaderboard ≤ 1000 displayed.
  - Subject digest cross-checked against canonical predicate digest on every verify path.
  - Inner pack body re-verified against the same Rekor publicKey that signed the envelope (defends "valid envelope, broken pack" splice).
  - Pack-author cross-check at publish – only the pack's original author can publish it to NUCLEI.
  - `--accept-public` mandatory when destination is the Sigstore public-good Rekor.
  - AbortSignal threaded through `subscribe`'s long-lived loop.
  - Optional cassette persistence via `--out <dir>` on every publish/sign verb.

  ## Tests added

  - `pack-format.test.ts` – round-trip, invalid metadata, bounds caps, predicate-validator TOFU gate.
  - `publish.test.ts` – signed pack lands under correct predicate URI, refuses author-mismatch, refuses missing license, persists to outDir.
  - `registry.test.ts` – ingest, lookup-by-author, list-by-vendor, search-by-tag, listSince, idempotent uuid, trustTier propagation from SBOM-AI.
  - `subscribe.test.ts` – filters, intervalMsOverride, abort signal, maxMatches cap.
  - `bounty.test.ts` – offer recording, claim recording, deterministic claim resolution, sponsor self-claim refusal, expired claims, idempotent recordClaim.
  - `leaderboard.test.ts` – rank correctness, fingerprint tie-break, only verified entries count, MAX_LEADERBOARD_ENTRIES cap.
  - `plugin.test.ts` – every CLI action's missing-flag path + `--accept-public` gate + identifier whitelist.

  ## Notes

  - Phase 3 ships local-only registry; Kite Event Log integration explicitly **deferred** to Phase 3+.
  - This program ships AFTER SBOM-AI + ROTATE – the SBOM-AI cross-reference gate is what closes the "first poisoned community pack kills the project" failure mode the plan flagged.
  - Leaderboard hydration is alpha – pulls from `--input counts.json` until Studio's Kite Event Log lookup wires.

- 05cdad7: Phase 4 – FINGERPRINT (alpha): active model-swap detection + MCP tool-surface enumeration. The operator runs a deterministic five-probe calibration set against a target; the daemon hashes each response, optionally enumerates an MCP server's tool surface, and signs a `ModelFingerprint/v1` cassette. Comparing two cassettes produces a signed `FingerprintDelta/v1` whose classification surfaces silent vendor model swaps as fingerprint discontinuities.

  ## What ships

  - **`@sizls/pluck-bureau-fingerprint`** – new workspace package.
    - `CALIBRATION_PROBES` – frozen five-probe set: `model-self-id` / `tokenizer-probe` / `refusal-policy` / `arithmetic` / `format-control`. Each body is bounded canonical-JSON; ids are stable across releases.
    - `scanModelFingerprint({ vendor, model, signingKey, responder, mcpEndpoint?, notarize?, acceptPublic?, outDir? })` – runs the probe-set, hashes responses, optionally enumerates MCP tools, signs + (optionally) notarizes a `ModelFingerprint/v1`. Responder is transport-agnostic: caller wires OpenAI, Anthropic, OpenRouter, Ollama in 10 lines.
    - `computeFingerprintDelta({ from, to, fromUuid, toUuid })` – pure diff: `stable` (hash unchanged) | `minor` (1-2 probes drifted) | `major` (3+ probes) | `swap` (hash differs AND >50% drifted).
    - `publishFingerprintDelta({ delta, signingKey, notarize?, acceptPublic? })` – signs a `FingerprintDelta/v1` envelope.
    - `enumerateMCPToolSurface(endpoint)` – POSTs `tools/list` to an MCP server, reduces the response to a sorted, bounded `MCPToolSurface` (sha256 of canonical input-schema + sha256 of description, never verbatim prose).
    - `reduceToolSurfaceFromMCPResponse(endpoint, body)` – pure version exposed for tests.
    - Bureau CLI plugin registers on import: `pluck bureau fingerprint scan | baseline | delta | mcp-enum`.
  - **Studio routes** – `/bureau/fingerprint` (landing), `/bureau/fingerprint/[vendor]/[model]` (history viewer placeholder).
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips FINGERPRINT status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the fingerprint plugin registers automatically on `pluck` startup.

  ## Hardening

  - Ed25519 only – signing key validated at boundary.
  - TOFU validator pattern: `signFingerprintStatement` REFUSES to sign without a registered validator for the predicate type. Registered at module load.
  - Predicate URIs deliberately distinct: `https://pluck.run/ModelFingerprint/v1` and `https://pluck.run/FingerprintDelta/v1`.
  - Bounds: ≤ 32 probes per scan, probe body canonical-JSON ≤ 4 KiB, probe description ≤ 1024 chars, response excerpt ≤ 4 KiB (truncated, hashed), fingerprint canonical body ≤ 96 KiB, MCP tool list ≤ 1024 entries, tool name regex matches MCP spec.
  - MCP tool surface stores sha256 of canonical input-schema + sha256 of description ONLY – never verbatim prose. Defeats the "vendor buries attacker-controlled prose into the cassette body" attack.
  - `surfaceHash` cross-checked against canonical re-derivation at validate time – prevents a malicious cassette from claiming a different surface than its tools array implies.
  - AbortSignal threaded through scan loops + MCP fetch + delta publish.
  - Strict CLI flag validation: vendor / model regex, 64-hex Rekor uuid format, baseline name allowlist.
  - `--accept-public` mandatory when notarizing to the Sigstore public-good Rekor.
  - Fingerprint hash is sha256 over canonical(probeId:responseHash) joined – order-independent, so two scans with identical probe responses produce identical hashes regardless of probe order.
  - Drift classification favors `swap` over `major` when fingerprint hashes differ AND ≥ 50% of probes drifted – the boundary the operator surface highlights.

  ## Tests added

  - `probe-set.test.ts` (12 tests) – frozen set, deterministic ids + bodies, validator caps (empty array refusal, > MAX_PROBES, duplicate id, body cap, expectedResponseHash format).
  - `scan.test.ts` (11 tests) – round-trip with mocked responder, predicate URI lock, deterministic fingerprint hash, response truncation, validator caps (vendor traversal, > 32 probes, duplicate probeId), tool-surface acceptance, sorted-tools requirement, bad endpoint, computeFingerprintHash order-independence.
  - `delta.test.ts` (10 tests) – every drift class boundary (`stable`, `minor`, `major`, `swap`), added/removed probe classification, sorted probeDeltas, fromUuid/toUuid mismatch refusal, bad classification refusal, signed-envelope round-trip with predicate URI lock.
  - `mcp-tool-enum.test.ts` (8 tests) – JSON-RPC reduction, surfaceHash anchor, dedupe on duplicate name, malformed-name filter, non-array refusal, > MAX_TOOL_ENTRIES refusal, top-level tools acceptance, equivalent-input determinism.
  - `plugin.test.ts` (15 tests) – every CLI action's missing-flag path + format gate.

  56 tests total – all green.

  ## Notes

  - FINGERPRINT cassettes are signed by the OPERATOR, not the vendor. They record what the operator observed, not what the vendor claims. That asymmetry is the point: an operator with an unbroken fingerprint history has a Rekor-anchored receipt that the model promised to stay stable AND a receipt that says it didn't.
  - Phase 4+ will read fingerprint cassettes back out of Kite Event Log to power the per-target studio history.

- 05cdad7: Phase 4 – OATH (alpha): universal vendor-claim ingestion layer for Pluck Bureau. The "robots.txt for AI honesty" – a vendor signs a `PluckOath/v1` attestation listing their public commitments and exposes it at `https://<vendor>/.well-known/pluck-oath.json`. Every other Bureau program contradict-checks against the oath at evaluation time; vendors with no oath get a visible "did not commit" badge.

  ## What ships

  - **`@sizls/pluck-bureau-oath`** – new workspace package.
    - `publishOath({ oath, signingKey, notarize?, acceptPublic?, outDir? })` – builds, signs, optionally notarizes a `PluckOath/v1`. Default channel is `/.well-known`, not Rekor; notarization is opt-in for the public audit trail.
    - `fetchOath(vendor, opts)` – HTTPS-only by default, 256 KiB cap, 10s timeout, no redirects, content-type must be `application/json` (or `application/...+json`). Returns a typed result with stable reason codes (`scheme-not-allowed`, `redirect-refused`, `response-too-large`, `content-type-invalid`, `envelope-decode-failed`, `envelope-shape-invalid`).
    - `verifyOath(envelope, publicKeyPem, { expectedOrigin? })` – fail-closed verification: envelope shape → predicate type → schema version → vendor regex → publishedAt / expiresAt ISO 8601 UTC + ≤ 1-year cap → claim caps + dedupe → subject digest match → SPKI fingerprint match → DSSE signature.
    - `contradictAgainstOath({ oath, body, evaluator })` – sealed-claim semantics: post-`expiresAt` claims do NOT trigger contradict (vendors must republish; ignoring expiry creates stale-data false-positives).
    - `buildOathBadge({ vendor, state })` – pure function over the latest contradict result; emits SVG (≤ 4 KiB), HTML embed snippet, and JSON. Bounded canvas, control-byte stripping, attacker-controlled vendor escaped in attribute + text contexts.
    - Bureau CLI plugin registers on import: `pluck bureau oath publish | fetch | verify | contradict | badge`.
  - **Studio routes** – `/bureau/oath` (landing), `/bureau/oath/manage` (vendor management placeholder), `/bureau/oath/[vendor]` (public viewer).
  - **Program tile** – `apps/pluck-studio/src/app/bureau/_data/programs.ts` flips OATH status `"soon"` → `"alpha"`.
  - **Host CLI wiring** – `packages/cli/src/cli.ts` adds a side-effect import so the oath plugin registers automatically on `pluck` startup.

  ## Hardening

  - Ed25519 only – signing key validated at boundary; non-Ed25519 PEM rejected.
  - `schemaVersion: 1` literal – no string drift.
  - TOFU validator pattern from ROTATE: `signOathStatement` REFUSES to sign without a registered validator for the predicate type. Registered at module load.
  - Predicate URI deliberately distinct: `https://pluck.run/PluckOath/v1`.
  - Bounds: ≤ 64 claims, claim description ≤ 1024 chars, predicate body canonical-JSON ≤ 8 KiB, oath canonical body ≤ 96 KiB, vendor ≤ 253 chars (RFC 1035), oath response ≤ 256 KiB, fetch timeout ≤ 60s.
  - Vendor cross-check: `expectedOrigin` option enforces that the served Origin matches the body's `vendor` field – defeats serving someone else's signed oath from a hostile mirror.
  - Predicate kinds bounded (no free-form `kind`): `training-excludes` / `model-id-stable` / `tool-surface-bounded` / `refusal-policy` / `data-retention` / `custom`.
  - ExpiresAt ≤ 1 year past publishedAt – vendors must republish to extend coverage.
  - Sealed-claim rule: `contradictAgainstOath` returns `oath-expired` past `expiresAt` and skips the evaluator entirely.
  - Badge output bounded: SVG ≤ 4 KiB, HTML ≤ 1 KiB, detail tooltip ≤ 256 chars; control bytes stripped from vendor + detail; falls back to fixed-size SVG when a vendor name would overflow the canvas.
  - `--accept-public` mandatory when notarizing to the Sigstore public-good Rekor.

  ## Tests added

  - `publish.test.ts` (16 tests) – round-trip, predicate URI lock, subject digest re-derivation, expiresAt validation (≤ publishedAt, > 1 year, malformed ISO), bounds (claims, description, predicate body), duplicate id refusal, vendor traversal refusal.
  - `wellknown.test.ts` (15 tests) – bare hostname → HTTPS, path stripping, http refusal without `--allow-http`, ftp scheme refusal, bad URL, content-type gate, redirect refusal, size cap (300 KiB body → `response-too-large`), envelope-shape gate, envelope-decode gate, timeout, non-2xx, +json content type acceptance.
  - `verify.test.ts` (11 tests) – happy path, null-key skip-signature mode, expectedOrigin cross-check, malformed envelope, decode failure, predicate-type drift, schema drift, subject-digest mismatch, fingerprint mismatch, signature flip, non-Ed25519 key.
  - `contradict.test.ts` (8 tests) – empty claims, all-pass, first-contradicting-claim wins, oath-expired short-circuit, unknown verdict not-contradicting, evaluatedAt boundary at publishedAt, oath-expired at expiresAt boundary, ISO 8601 evaluatedAt format.
  - `badge.test.ts` (10 tests) – green/red/unknown/missing palette, HTML embed structure, attribute-context escaping, control-byte stripping, oversized vendor fallback, evaluatedAt propagation, unknown state downgrade.
  - `plugin.test.ts` (14 tests) – every CLI action's missing-arg path + format gate.

  74 tests total – all green.

  ## Notes

  - OATH is plumbing, not a destination. The studio surface ships an alpha viewer; the full vendor-management UI lands once Kite Event Log persistence wires in Phase 4+.

- a7399e7: Phase 5 – BOUNTY (alpha): autonomous HackerOne / Bugcrowd filer. Wraps DRAGNET red dots + FINGERPRINT deltas + MOLE memorization verdicts into subpoena-quality EvidencePacket/v1 bodies, then dispatches to the platform via auth tokens read from env vars (never logged, never embedded in the body).

  ## What ships

  - **`@sizls/pluck-bureau-bounty`** – new workspace package.
    - `buildEvidencePacket({ sourceRekorUuid, subpoenaRekorUuid, subject, reason, summary, moleVerdict?, fingerprintDelta? })` – pure function. Composes a subpoena-quality body with cosign verify command + markdown body suitable for direct platform submission. The packet body NEVER carries the operator's signing key.
    - `h1Adapter.submit({ programHandle, authToken, packet })` – POSTs HackerOne `/v1/reports`. Sliding-window rate limit 600/hour. Auth as Bearer; token never logged.
    - `bugcrowdAdapter.submit(...)` – POSTs Bugcrowd `/submissions`. Sliding-window rate limit 300/hour. Auth as Token; token never logged.
    - `autoFile({ target, evidence, readEnv? })` – orchestrator: validates target, reads auth token from env, builds packet, dispatches to adapter, returns EvidencePacket + adapterResult + (when accepted) a deterministic BountySubmission record.
    - Bureau CLI plugin registers on import: `pluck bureau bounty file | track | claim`. `claim` cross-references NUCLEI's BountyClaim/v1.
  - **Studio route** – `/bureau/bounty` landing page (charter + auth posture + rate limits).
  - **Program tile** – `bounty` flips `"soon"` → `"alpha"`.
  - **Host CLI wiring** – side-effect import.

  ## Hardening

  - Adapters MUST NOT include the operator's signing key in any body sent to HackerOne / Bugcrowd. Tests assert no `-----BEGIN PRIVATE` or `private[-_]?key` substring in captured request bodies.
  - Auth tokens read from env at call time, never logged. Adapter error strings strip Bearer/Token strings before returning.
  - Rate-limited per platform: HackerOne 600/hour, Bugcrowd 300/hour. Sliding-window per process. Submissions over the limit are refused locally with status 429 BEFORE a request is sent.
  - Strict regex on every CLI input: 64-hex Rekor uuids, `[a-z0-9][a-z0-9._-]*` for vendor / model / programHandle, `^[A-Z][A-Z0-9_]*$` for env var names.
  - `--accept-public` mandatory on `bounty file` (filing posts a body to a public third-party platform).
  - Markdown body capped at 64 KiB.
  - Predicate URIs: `https://pluck.run/EvidencePacket/v1` + `https://pluck.run/BountySubmission/v1`.
  - AbortSignal + timeout threaded through fetch.
  - index.ts type-pure; register.ts the only side-effect entry.

  ## Tests added

  - `evidence-builder.test.ts` (10 tests) – input validation, packet composition, cross-reference inclusion, deterministic hash, oversized-markdown refusal, no-private-key assertion.
  - `h1-adapter.test.ts` (9 tests) – empty-handle/token refusal, success path with mocked fetch, no-signing-key-in-body assertion, Bearer-redacted error string, 600/hour rate limit, 4xx propagation, fetch-throw handling.
  - `bugcrowd-adapter.test.ts` (8 tests) – same surface as HackerOne adapter at 300/hour.
  - `auto-file.test.ts` (6 tests) – target validation, missing-env handling, adapter dispatch, deterministic submissionId, Bugcrowd dispatch.
  - `plugin.test.ts` (16 tests) – every CLI action's missing-flag path + format gate + accept-public gate.

  49 tests total – all green.

- a7399e7: Phase 5 – MOLE (alpha): adversarial training-data extraction proofs. Operator commits a sealed CanaryDocument/v1 BEFORE probing a vendor; runs probes from a signed mole probe-pack; scores each response with deterministic n-gram + edit-distance + verbatim-phrase memorization heuristics; emits MemorizationVerdict/v1 + a journalist-ready citation bundle anchored to public Rekor entries.

  ## What ships

  - **`@sizls/pluck-bureau-mole`** – new workspace package.
    - `sealCanary({ canaryHash, canaryId, fingerprintPhrases, signingKey })` – builds + signs a sealed `CanaryDocument`. Signs the raw 32-byte digest (cosign / sigstore-\* compatible). Validates every field (regex, ISO 8601 UTC, fingerprint-phrase bounds).
    - `verifyCanary(canary, publicKeyPem)` – strict-base64 + length-checked signature verification.
    - `scoreMemorization({ canary, probe, response, ... })` – pure deterministic scorer combining 5-gram overlap (0.45) + closest-phrase normalized edit distance (0.30) + verbatim phrase ratio (0.25). Two runs with the same input produce byte-identical verdict bodies.
    - `buildMoleProbePack({ packId, canaryId, canaryRekorUuid, probes }, signingKey)` – extends the bureau-core `signProbePack` surface with mole-specific anchor fields.
    - `buildCitationBundle({ canary, verdict, verdictRekorUuid, reproduciblePrompt })` – assembles a journalist-ready citation including markdown body + cosign verify command + optional vendor Disclosure/v1 cross-reference. Refuses retroactive bundles (verdict.evaluatedAt < canary.sealedAt).
    - Bureau CLI plugin registers on import: `pluck bureau mole init | run | cite`.
  - **Studio route** – `/bureau/mole` landing page (charter + sealing semantics + CLI).
  - **Program tile** – `mole` flips `"soon"` → `"alpha"`.
  - **Host CLI wiring** – side-effect import added so the mole plugin registers at `pluck` startup.

  ## Hardening

  - Ed25519 only – signing key validated at boundary.
  - Strict regex + bounds: 64-hex SPKI fingerprints, ISO 8601 UTC, ≤ 32 fingerprint phrases each 8–256 chars, ≤ 8 KiB metadata canonical-JSON, ≤ 64 KiB response excerpts (utf8-boundary-safe truncation).
  - Sealing semantics: `scoreMemorization` REFUSES verdicts whose `evaluatedAt` precedes `canary.sealedAt`. `buildCitationBundle` enforces the same rule.
  - Predicate URIs locked: `https://pluck.run/CanaryDocument/v1` + `https://pluck.run/MemorizationVerdict/v1`.
  - AbortSignal threading on CLI actions.
  - index.ts type-pure; register.ts the only side-effect entry.
  - Memorization scoring is deterministic – no LLM-graded fuzz, no random sampling. Court-citable evidence requires reproducibility.

  ## Tests added

  - `canary.test.ts` (11 tests) – sealing + signature round-trip, predicate URI lock, fingerprint-phrase bounds, RSA refusal, ISO 8601 strictness, > 8 KiB metadata refusal, mismatched-key verification refusal, signature-flip detection.
  - `memorization.test.ts` (12 tests) – n-gram + edit-distance helpers, ZERO + 100% memorization baselines, deterministic verdict, sealing-semantics retroactive refusal, evaluator fingerprint regex, vendor traversal refusal, deterministic verdict digest.
  - `probe-pack-mole.test.ts` (8 tests) – round-trip + core verifier integration, empty-probes refusal, duplicate-id refusal, bound enforcement, target-mole requirement.
  - `citation-builder.test.ts` (8 tests) – bundle composition, mismatched-id refusal, retroactive-bundle refusal, bad rekor-URL refusal, vendor-claim cross-reference, deterministic assembledAt under now() override.
  - `plugin.test.ts` (15 tests) – every CLI action's missing-flag path + format gate.

  54 tests total – all green.

- a7399e7: Phase 5 – WHISTLE (alpha): anonymous AI-whistleblower pipeline. Ephemeral Ed25519 keys (single-use, in-memory by default) + defense-in-depth redactor (TRIPWIRE secret-scrub + k-anonymity floor + stylometric refusal) + tag-based routing to ProPublica / Bellingcat / 404Media / EFF Press. SecureDrop for the AI era.

  ## What ships

  - **`@sizls/pluck-bureau-whistle`** – new workspace package.
    - `generateAnonKey()` – fresh Ed25519 keypair NOT bound to any operator identity. In-memory only by default. Each call returns a new key.
    - `signWithAnonKey({ digest, anonKey })` – signs the raw 32-byte digest. Refuses to reuse a fingerprint within the same process (single-use enforcement).
    - `persistAnonKey({ dir, anonKey, accepted })` – opt-in disk persistence behind an explicit `accepted: true` gate. Refuses sensitive directories (~/.ssh etc.), refuses to overwrite existing material, mode 0600.
    - `redactWhistlePayload({ payload, policy })` – defense-in-depth: secret-pattern scrub (mirrors tripwire), manual phrase redactions, k-anonymity heuristic, rare-trigram stylometric density refusal. Returns `{ redactedBytes, manualReplacements, secretReplacements, kAnonymity, stylometric, refusalReasons }`.
    - `submitWhistle({ payload, category, policy, routing, anonKey })` – orchestrates redact → hash → route → seal → sign. Returns sealed body + signature + redaction audit. Refuses redaction-rejected payloads unless `allowRefused=true`.
    - `resolveRouting({ category, requested })` + `DEFAULT_ROUTING_TARGETS` – built-in routing for the four canonical AI-accountability outlets.
    - Bureau CLI plugin registers on import: `pluck bureau whistle submit | verify | route`.
  - **Studio route** – `/bureau/whistle` landing page (charter + the big anonymity caveat block).
  - **Program tile** – `whistle` flips `"soon"` → `"alpha"`.
  - **Host CLI wiring** – side-effect import.

  ## Hardening

  - Ed25519 only.
  - Anon keys are SINGLE-USE per process. Signing with the same fingerprint twice throws.
  - Anon keys NEVER persist by default. CLI `--persist-key` requires `--accept-persist-warning` AND `--persist-path <dir>`.
  - Redactor at LEAST as aggressive as `pluck-bureau-tripwire`'s `redact.ts`: same secret-key regex, same inline scrubs (sk-_, sk-ant-_, Bearer, api_key=, access_token=). PLUS k-anonymity floor + rare-trigram density refusal.
  - Strict ISO 8601 UTC, full 64-hex fingerprints, strict base64 signatures, raw 32-byte digest signing.
  - Routing webhook URLs strict scheme/host validation. ≤ 16 routing targets, ≤ 64 manual redactions.
  - Predicate URI: `https://pluck.run/WhistleSubmission/v1`.
  - AbortSignal threading on CLI actions.
  - index.ts type-pure; register.ts the only side-effect entry.

  ## Caveats

  - **Anonymity is best-effort, not absolute.** Read the README. Tor + zero-log ingestion live separately; WHISTLE only seals the body.
  - The package warns operators in the help text + README about Computer Fraud and Abuse Act / Computer Misuse Act exposure when filing in `policy-violation` / `safety-incident` categories with vendor-internal evidence.

  ## Tests added

  - `anon-key.test.ts` (12 tests) – fresh-key-per-call, no-disk-by-default, single-use refusal, fingerprint↔private-key cross-check, accepted=true requirement, mode 0600 persistence, sensitive-directory refusal.
  - `redact.test.ts` (14 tests) – secret-key regex, inline scrubs, JSON walk, rare-trigram density, policy validators, layered refusal, JSON shape preservation.
  - `routing.test.ts` (10 tests) – default targets frozen, validateRoutingTarget regex+webhook, resolve intersection, multi-target dispatch, empty-acceptance error, additional-target append.
  - `submit.test.ts` (8 tests) – round-trip signature verifies via crypto.verify, deterministic submissionId, refused-redaction default refusal, `allowRefused` override, single-use enforcement, validate field gates.
  - `plugin.test.ts` (16 tests) – every CLI action's missing-flag path + format gate + persist-key gate.

  60 tests total – all green.

- 31b7baa: Phase 6 – CUSTODY (alpha): browser-extension AI conversation chain-of-custody. Court-admissible captures with WebAuthn-bound operator identity. Library + verifier ship now; the full Chrome / Firefox MV3 extension build pipeline lands Phase 6.5.

  ## What ships

  - **`@sizls/pluck-bureau-custody`** – new workspace package.
    - `CaptureSpec` – full-page DOM snapshot sha256 + every fetch req/resp + browser fingerprint + system clock + WebAuthn-signed operator identity. Versioned via `schemaVersion: 1` + `captureSpecVersion: 1`.
    - `OperatorIdentityBinding` – `webauthn` or `disk` kind. WebAuthn-bound is mandatory for FRE 902(13) compliance per the Phase 6 R1 privacy review.
    - `ChainOfCustodyEvent` – append-only, signed-anchored chain. `kind` is one of `capture | handoff | publication | verification`. Each event's `prevEventHash` ties it to the prior event so reordering / dropping breaks verification.
    - `CustodyBundle` – full bundle. Capture spec + chain (capped at 256 events) + chainRootHash + optional rekorUuid. Predicate URI: `https://pluck.run/CustodyBundle/v1`.
    - `verifyCustodyBundle()` – the journalist 60-second path. Returns `FRE902VerifyResult { ok, fre902Compliant, reasons[] }` listing every check that failed so an operator can map each failure to a legal-admissibility argument.
    - `exportSubpoena()` – wraps the bounty package's `EvidencePacket/v1` builder; full chain crosses 4 packages (custody → subpoena → bounty → studio).
    - Bureau CLI plugin registers on import: `pluck bureau custody capture | build | verify | export`.
  - **Studio routes** – `/bureau/custody` (charter + WebAuthn + FRE 902 / Daubert reliability rationale), `/bureau/custody/verify` (drag-and-drop journalist verification, runs in-browser), `/bureau/custody/[uuid]` (per-bundle public viewer placeholder).
  - **Program tile** – `custody` flips `"soon"` → `"alpha"`.
  - **Host CLI wiring** – side-effect import of `@sizls/pluck-bureau-custody/plugin`.

  ## Hardening

  - WebAuthn-bound operator identity is mandatory for FRE 902(13) compliance. Disk-only keys still verify cryptographically but `verifyCustodyBundle` flips `fre902Compliant: false` with a Daubert-reliability reason in `reasons[]` ("operator identity not bound to WebAuthn – disk-only keys do not survive Daubert reliability standard for FRE 902(13) self-authenticating machine-generated records").
  - DOM snapshot canonical-byte cap: 4 MiB. Larger captures rejected with explicit error.
  - Chain length cap: 256 events. Beyond that operators must split into multiple bundles, each anchoring to the prior bundle's `chainRootHash`.
  - Per-event `details` cap: 32 KiB canonical bytes.
  - Browser fingerprint: `pluginsHash` is sha256 of canonical sorted plugin list (stable across sessions, reveals only the plugin set).
  - `systemClock`: `endedAt` MUST NOT precede `startedAt`.
  - Predicate URIs distinct per shape (`CustodyBundle/v1` + `ChainOfCustodyEvent/v1`).
  - Strict regex on every CLI input: 64-hex Rekor uuids, `[a-z0-9][a-z0-9._-]*` for vendor / model.
  - Subpoena export wraps the bounty package's `EvidencePacket/v1` so a verified custody bundle can be filed via the same surface DRAGNET red dots already use.
  - `index.ts` type-pure; `register.ts` the only side-effect entry.

  ## Tests added

  - `capture-spec.test.ts` (~22 tests) – round-trip, version locking, bounds caps (4 MiB, 1024 fetch events), fingerprint / clock / identity binding validators, deterministic spec hash.
  - `chain-of-custody.test.ts` (~12 tests) – build / sign genesis + linked events, signature verify, tamper detection, chain-root determinism, oversized details rejection.
  - `builder.test.ts` (~8 tests) – bundle structure, non-capture genesis rejection, chain length cap, rekorUuid handling, subpoena cross-reference (no operator key in body).
  - `verify.test.ts` (~10 tests) – clean WebAuthn bundle, disk-bound FRE 902 fail, broken signature, tampered details, dropped event, reordered chain, mismatched chainRootHash, fingerprint mismatch, deterministic bundle hash.
  - `plugin.test.ts` (~14 tests) – every CLI action's exit code path (capture / build / verify / export – all 0/1/2 paths).

  ~66 tests total.

- Updated dependencies [415a07a]
- Updated dependencies [415a07a]
- Updated dependencies [415a07a]
- Updated dependencies [31b7baa]
- Updated dependencies [3f61586]
  - @sizls/pluck-bureau-core@0.1.0
  - @sizls/pluck-bureau-ui@0.1.0
  - @sizls/pluck-bureau-custody@0.1.0
