// ---------------------------------------------------------------------------
// /v1/runs — per-pipeline GET-side payload redaction
// ---------------------------------------------------------------------------
//
// PROBLEM: every program's POST validator can accept fields that participate
// in the canonical idempotency hash but MUST NOT be echoed back through
// `GET /api/v1/runs/[id]`. The two load-bearing examples today:
//
//   - WHISTLE.bundleUrl — required at submission (the routing partner needs
//     to retrieve the bundle), part of the dedupe key, but a privacy leak
//     if echoed: anyone with the phraseId could trace back to the source.
//     The phraseId is a public share credential (the "Google Docs share
//     link" model); it must NOT be a deanonymization vector.
//   - WHISTLE.manualRedactPhrase — operator-supplied scrub phrase; same
//     anonymity-by-default posture.
//   - ROTATE.operatorNote — optional ≤512-char free-form context that
//     could carry incident detail. The receipt URL is reason-scoped
//     (compromised/routine/lost) so a "compromised" rotation already
//     surfaces socially; the operatorNote could leak attacker-IOCs or
//     internal-investigation language. Strip it from GET.
//
// The POST response already redacts these (the route handlers + validators
// drop them from the echoed body). But `record.payload` in the run-store
// holds the FULL payload — needed for the canonical hash to remain stable
// — and `GET /api/v1/runs/[id]` previously serialized it verbatim. This
// module fixes that gap by redacting at the GET boundary.
//
// DESIGN: per-pipeline registry, additive. Each program's redactor lists
// the explicit fields to strip; everything else passes through. New
// programs default to PASS_THROUGH and the type system enforces
// exhaustiveness via `Record<BureauPipeline, …>`. The redactor receives
// the canonical-JSON-stable payload + returns a safe-to-publish version
// (does not mutate the input — the run-store record still holds the
// original for idempotency / audit).
//
// SECURITY POSTURE:
//   - Validator (POST): wire-layer input gate.
//   - Route handler (POST): response-shape gate.
//   - Run-store: holds the canonical payload (idempotency).
//   - THIS MODULE (GET): output-layer gate. Defense-in-depth.
// ---------------------------------------------------------------------------

import { type BureauPipeline, BUREAU_PIPELINES } from "./run-spec";

export type PayloadRedactor = (
  payload: Record<string, unknown>,
) => Record<string, unknown>;

const PASS_THROUGH: PayloadRedactor = (payload) => payload;

// WHISTLE — strip bundleUrl + manualRedactPhrase. Both are needed at POST
// time (bundleUrl participates in the canonical hash; manualRedactPhrase
// drives downstream scrub) but are anonymity hazards at GET. The phraseId
// in the URL is the share credential; the response must not include any
// trace back to the source.
const REDACT_WHISTLE: PayloadRedactor = (payload) => {
  const { bundleUrl: _bundleUrl, manualRedactPhrase: _manualRedactPhrase, ...safe } =
    payload;

  return safe;
};

// ROTATE — strip operatorNote. The receipt URL is already reason-scoped
// (compromised/routine/lost) so the *kind* of rotation surfaces socially;
// the optional free-form note could carry attacker IOCs, internal
// investigation language, or other detail that the operator did not
// intend to publish at GET-by-phraseId resolution.
const REDACT_ROTATE: PayloadRedactor = (payload) => {
  const { operatorNote: _operatorNote, ...safe } = payload;

  return safe;
};

// MOLE: canaryUrl is by-design public — the seal target — and the operator
// is publishing that "the canary lives somewhere". canaryBody / canaryContent
// are already validator-rejected on the POST wire, so there is no persisted
// field to strip on GET. PASS_THROUGH.
//
// BOUNTY: validator already rejects auth-token-shaped fields entirely at
// POST. No persisted privacy-sensitive fields to redact on GET. PASS_THROUGH.

export const PAYLOAD_REDACTORS: Record<BureauPipeline, PayloadRedactor> = {
  "bureau:dragnet": PASS_THROUGH,
  "bureau:oath": PASS_THROUGH,
  "bureau:fingerprint": PASS_THROUGH,
  "bureau:custody": PASS_THROUGH,
  "bureau:whistle": REDACT_WHISTLE,
  "bureau:bounty": PASS_THROUGH,
  "bureau:sbom-ai": PASS_THROUGH,
  "bureau:rotate": REDACT_ROTATE,
  "bureau:tripwire": PASS_THROUGH,
  "bureau:nuclei": PASS_THROUGH,
  "bureau:mole": PASS_THROUGH,
};

// Belt-and-suspenders runtime check — if BUREAU_PIPELINES grows and someone
// forgets to add an entry to PAYLOAD_REDACTORS, this throws at import time
// in dev. The `Record<BureauPipeline, …>` already enforces this at the type
// level; this catches the (rare) case where the union and the array drift.
for (const p of BUREAU_PIPELINES) {
  if (!(p in PAYLOAD_REDACTORS)) {
    throw new Error(
      `[redact] missing redactor for bureau pipeline: ${p}`,
    );
  }
}

/**
 * Redact a stored payload for safe inclusion in a public GET response.
 *
 * The input is the run-store's canonical payload (which MAY contain
 * fields that participated in the idempotency hash but MUST NOT echo
 * to a phraseId-credentialed reader). The output is a shallow copy
 * with privacy-sensitive fields stripped per the program's redactor.
 *
 * For pipelines documented but not yet implemented (extract / sense /
 * act / fleet) the run-store rejects the POST upstream; if a record
 * with such a pipeline ever appears the GET path falls back to
 * PASS_THROUGH so the user still sees the record. (The /v1/runs POST
 * route rejects future pipelines with a 400, so this is theoretical.)
 */
export function redactPayloadForGet(
  pipeline: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const redactor = (PAYLOAD_REDACTORS as Record<string, PayloadRedactor>)[pipeline];

  if (redactor === undefined) {
    return payload;
  }

  return redactor(payload);
}
