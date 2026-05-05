// ---------------------------------------------------------------------------
// /v1/runs — RunSpec + RunRecord types
// ---------------------------------------------------------------------------
//
// The /v1/runs API is the canonical surface for kicking off ANY pipeline
// run inside Pluck Studio. Today it consolidates the 11 per-program Bureau
// activation stubs at /api/bureau/<slug>/run; tomorrow it unifies the
// non-Bureau shelves (extract, sense, act, fleet) under the same shape.
//
// Why one endpoint instead of N:
//   - One auth, rate-limit, idempotency story.
//   - One receipt-URL primitive (the runId, in phrase-id format).
//   - One backend swap (stub → Supabase + DSSE + Rekor) when /v1/runs
//     goes GA — no per-program migration tax.
//   - One RunSpec contract that an AI agent (Priya's archetype) writes
//     against, regardless of which shelf it's hitting.
//
// The 11 bureau slugs map 1:1 to the legacy `/api/bureau/<slug>/run`
// routes. Their `payload` shape is the existing per-program request body
// — see `docs/V1_API.md` for the per-pipeline payload reference.
//
// `extract`, `sense`, `act`, `fleet` are documented as future surface;
// the route validator rejects them today with a 400 + "documented but
// not yet implemented" error so callers get a clean signal.
// ---------------------------------------------------------------------------

export const BUREAU_PIPELINES = [
  "bureau:dragnet",
  "bureau:oath",
  "bureau:fingerprint",
  "bureau:custody",
  "bureau:whistle",
  "bureau:bounty",
  "bureau:sbom-ai",
  "bureau:rotate",
  "bureau:tripwire",
  "bureau:nuclei",
  "bureau:mole",
] as const;

export const FUTURE_PIPELINES = ["extract", "sense", "act", "fleet"] as const;

export const ALL_PIPELINES = [
  ...BUREAU_PIPELINES,
  ...FUTURE_PIPELINES,
] as const;

export type BureauPipeline = (typeof BUREAU_PIPELINES)[number];
export type FuturePipeline = (typeof FUTURE_PIPELINES)[number];
export type RunSpecPipeline = BureauPipeline | FuturePipeline;

const BUREAU_SET: ReadonlySet<string> = new Set(BUREAU_PIPELINES);
const FUTURE_SET: ReadonlySet<string> = new Set(FUTURE_PIPELINES);

export function isBureauPipeline(s: string): s is BureauPipeline {
  return BUREAU_SET.has(s);
}

export function isFuturePipeline(s: string): s is FuturePipeline {
  return FUTURE_SET.has(s);
}

export function isKnownPipeline(s: string): s is RunSpecPipeline {
  return BUREAU_SET.has(s) || FUTURE_SET.has(s);
}

/** Strip the `bureau:` prefix from a bureau pipeline (`bureau:dragnet` → `dragnet`). */
export function bureauSlugOf(p: BureauPipeline): string {
  return p.slice("bureau:".length);
}

export interface RunSpec {
  pipeline: RunSpecPipeline;
  /**
   * Per-pipeline payload. For `bureau:<program>`, this matches the
   * existing per-program request body shape.
   */
  payload: Record<string, unknown>;
  /**
   * Idempotency key — caller-supplied. Same key + same canonicalised
   * (pipeline, payload) returns the same runId. C5 fix from R1 review.
   * Optional: when omitted, every POST creates a fresh run.
   */
  idempotencyKey?: string;
}

export type RunStatus =
  | "pending"
  | "running"
  | "anchored"
  | "failed"
  | "cancelled";
export type VerdictColor = "green" | "amber" | "red" | "gray";

export interface RunRecord {
  /** Same as the canonical phraseId — the receipt URL primitive. */
  runId: string;
  pipeline: RunSpecPipeline;
  status: RunStatus;
  /** Per-pipeline verdict tag once landed; null while pending/running. */
  verdict: string | null;
  verdictColor: VerdictColor;
  /** Echoed for audit. */
  payload: Record<string, unknown>;
  /** Pipeline-specific response shape — null until the run has data. */
  response: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  /** Path to the receipt page, e.g. `/bureau/dragnet/runs/<runId>`. */
  receiptUrl: string;
}

const ALLOWED_TOP_LEVEL: ReadonlySet<string> = new Set([
  "pipeline",
  "payload",
  "idempotencyKey",
]);

/**
 * Validate the shape of an inbound RunSpec. Returns null on success or a
 * human-readable error string. Caller decides the HTTP code (400 for
 * shape errors, 404 for unknown pipelines on the read side).
 */
export function validateRunSpec(value: unknown): {
  ok: true;
  spec: RunSpec;
} | {
  ok: false;
  error: string;
} {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const obj = value as Record<string, unknown>;

  // Reject unknown top-level keys so future fields (e.g. `priority`) added
  // to RunSpec don't get silently absorbed by clients that haven't migrated.
  // Keeps the contract tight from day one.
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      return { ok: false, error: `unexpected top-level key: ${key}` };
    }
  }
  const pipeline = obj.pipeline;

  if (typeof pipeline !== "string" || pipeline.length === 0) {
    return { ok: false, error: "`pipeline` is required." };
  }
  if (!isKnownPipeline(pipeline)) {
    return {
      ok: false,
      error: `Unknown pipeline \`${pipeline}\`. Known: ${ALL_PIPELINES.join(", ")}.`,
    };
  }
  const payload = obj.payload;
  if (
    payload === null ||
    payload === undefined ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return { ok: false, error: "`payload` must be a JSON object." };
  }
  let idempotencyKey: string | undefined;
  if (obj.idempotencyKey !== undefined) {
    if (typeof obj.idempotencyKey !== "string") {
      return { ok: false, error: "`idempotencyKey` must be a string." };
    }
    if (obj.idempotencyKey.length === 0 || obj.idempotencyKey.length > 256) {
      return {
        ok: false,
        error: "`idempotencyKey` must be 1..256 characters.",
      };
    }
    idempotencyKey = obj.idempotencyKey;
  }

  return {
    ok: true,
    spec: {
      pipeline,
      payload: payload as Record<string, unknown>,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    },
  };
}
