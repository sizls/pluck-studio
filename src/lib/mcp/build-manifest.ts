// ---------------------------------------------------------------------------
// MCP manifest builder — pure function over the program registry
// ---------------------------------------------------------------------------
//
// Studio is the operator-facing surface for the Pluck Bureau. AI agents
// (Claude Desktop, Cursor, custom MCP clients) discover Studio through
// a Model Context Protocol manifest — a JSON document describing the
// resources, tools, and prompts the external `@sizls/pluck-mcp` server
// will expose against /v1/runs.
//
// This builder is pure: same registry input → same manifest output.
// No `Math.random`, no `Date.now`, no clock dependence — every resource
// URI and tool input-schema is derived from the static program registry
// and the BUREAU_PIPELINES enum. That determinism is what lets the
// /api/mcp/manifest.json route serve a cacheable response without ever
// drifting from the runtime taxonomy.
//
// Auto-generation invariant — like the OpenAPI generator:
//   - Resources for each ACTIVE_PROGRAMS entry (`pluck://program/<slug>`).
//   - Tool input schemas reference the same `bureau:*` pipeline values
//     as `BUREAU_PIPELINES`. Adding a new program is a one-line registry
//     change; the manifest auto-includes it.
//
// Related contracts:
//   - `pluck://` URI namespace is stable. Once a resource ships, its
//     URI shape is locked (renaming would break every external MCP
//     client that bound to it).
//   - DSSE-signed receipts use `application/vnd.in-toto+dsse+json` per
//     the in-toto/DSSE specification — that's the canonical mimeType
//     for any `pluck://run/...` resource.
//
// Studio does NOT implement the MCP protocol itself. The manifest is
// purely informational discovery, like robots.txt or openapi.json. The
// external `@sizls/pluck-mcp` server reads /v1/runs and exposes the
// MCP wire protocol; this manifest tells operators how to wire the two
// together.
// ---------------------------------------------------------------------------

import { ACTIVE_PROGRAMS } from "../programs/registry";
import { BUREAU_PIPELINES } from "../v1/run-spec";

/** Manifest-shape root — see https://modelcontextprotocol.io. */
export interface McpManifest {
  readonly $schema: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly homepage: string;
  readonly openapi: string;
  readonly resources: ReadonlyArray<McpResource>;
  readonly tools: ReadonlyArray<McpTool>;
  readonly prompts: ReadonlyArray<McpPrompt>;
  readonly auth: McpAuth;
}

export interface McpResource {
  readonly uri: string;
  readonly name: string;
  readonly description: string;
  readonly mimeType: string;
}

export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface McpPrompt {
  readonly name: string;
  readonly description: string;
}

export interface McpAuth {
  readonly type: string;
  readonly bearerEnv: string;
  readonly cookieName: string;
  readonly note: string;
}

export interface BuildManifestOpts {
  readonly baseUrl: string;
  readonly version: string;
}

const MCP_SCHEMA_URL = "https://modelcontextprotocol.io/schemas/manifest/v0.1.json";

/** Canonical mimeType for in-toto DSSE-signed envelopes (the receipt shape). */
const DSSE_MIME = "application/vnd.in-toto+dsse+json";
const JSON_MIME = "application/json";

/**
 * Build the MCP manifest for Studio. Pure function — same input always
 * produces byte-identical output (lets the route cache + the snapshot
 * test lock the shape).
 */
export function buildManifest(opts: BuildManifestOpts): McpManifest {
  const { baseUrl, version } = opts;

  const programResources: McpResource[] = ACTIVE_PROGRAMS.map((p) => ({
    uri: `pluck://program/${p.slug}`,
    name: `${p.name} program metadata + recent receipts`,
    description: `Per-program landing context for ${p.name}: predicate URI ${p.predicateUri}, recent run receipts, vendor scope. Output shape — ${p.outputShape}.`,
    mimeType: JSON_MIME,
  }));

  const resources: McpResource[] = [
    {
      uri: "pluck://run/{id}",
      name: "A single signed run receipt",
      description:
        "DSSE-signed in-toto envelope for one Bureau program run. The {id} is the phrase ID (e.g. `openai-swift-falcon-3742`) returned by /v1/runs POST. Anchor on Sigstore Rekor; verify offline with cosign verify-blob against /.well-known/pluck-keys.json.",
      mimeType: DSSE_MIME,
    },
    {
      uri: "pluck://runs/recent",
      name: "Recent runs across all programs",
      description:
        "Cursor-paginated list of recent runs across all 11 Bureau programs. Mirrors GET /api/v1/runs. Filters: pipeline, since (ISO timestamp), status. Payloads are GET-redacted per program.",
      mimeType: JSON_MIME,
    },
    {
      uri: "pluck://vendor/{slug}",
      name: "Per-vendor honesty profile",
      description:
        "Vendor Honesty Index profile across the 6 vendor-bearing programs (DRAGNET, OATH, FINGERPRINT, CUSTODY, NUCLEI, MOLE). The {slug} matches the vendor allowlist (openai, anthropic, google, meta, mistral, cohere, perplexity, deepseek, xai, microsoft).",
      mimeType: JSON_MIME,
    },
    ...programResources,
    {
      uri: "pluck://today",
      name: "Today's daily roll-up",
      description:
        "Per-program 24-hour verdict density tile set used by /today. One entry per program with a signed Sigstore-Rekor-anchored summary count.",
      mimeType: JSON_MIME,
    },
  ];

  const bureauPipelineEnum = [...BUREAU_PIPELINES];

  const tools: McpTool[] = [
    {
      name: "pluck.search",
      description:
        "Search by phrase ID — decompose the slug into vendor + adjective + noun + serial, fan out across all 11 programs and return every receipt that shares any component.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          phraseId: {
            type: "string",
            description: "Full or partial phrase ID (e.g. `openai-swift-falcon-3742`).",
            minLength: 1,
            maxLength: 128,
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 100,
            default: 20,
          },
        },
        required: ["phraseId"],
      },
    },
    {
      name: "pluck.diff",
      description:
        "Compare two receipts of the same vendor side-by-side. Returns the semantic diff (verdict transitions, per-claim deltas) used by /diff/<base>?since=<target>.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          basePhraseId: {
            type: "string",
            description: "Phrase ID of the newer receipt (the base).",
            minLength: 1,
            maxLength: 128,
          },
          sincePhraseId: {
            type: "string",
            description: "Phrase ID of the older receipt to diff against.",
            minLength: 1,
            maxLength: 128,
          },
        },
        required: ["basePhraseId", "sincePhraseId"],
      },
    },
    {
      name: "pluck.run",
      description:
        "Execute a Bureau program through /v1/runs. Returns the runId / phrase ID and the receipt URL. Mirrors POST /api/v1/runs — same idempotency, auth, and per-pipeline payload contract.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          pipeline: {
            type: "string",
            description: "Bureau pipeline slug. Adding a new program auto-extends this enum.",
            enum: bureauPipelineEnum,
          },
          payload: {
            type: "object",
            description:
              "Per-pipeline payload — see docs/V1_API.md → 'Per-pipeline payload reference' for the 11 program-specific shapes.",
            additionalProperties: true,
          },
          idempotencyKey: {
            type: "string",
            description: "Caller-supplied idempotency key. Same key + same canonicalised payload returns the same runId.",
            minLength: 1,
            maxLength: 128,
          },
        },
        required: ["pipeline", "payload"],
      },
    },
  ];

  const prompts: McpPrompt[] = [
    {
      name: "pluck.investigate-vendor",
      description:
        "Run a multi-program investigation against a vendor: DRAGNET probe-pack run, FINGERPRINT calibration scan, OATH /.well-known verification. Returns three signed receipts plus a synthesized verdict.",
    },
    {
      name: "pluck.verify-claim",
      description:
        "Extract a testable claim from a screenshot or quoted text, run a DRAGNET probe against the named vendor, return a signed receipt with the contradiction count and verdict tier.",
    },
  ];

  const auth: McpAuth = {
    type: "bearer-or-cookie",
    bearerEnv: "PLUCK_STUDIO_TOKEN",
    cookieName: "sb-test-auth-token (dev) / sb-{project}-auth-token (prod)",
    note: "GET /v1/runs/{id} is public-read by phrase ID — no auth required for resource fetches. POST /v1/runs (the pluck.run tool) requires a Supabase JWT cookie OR a dev-mode Bearer token.",
  };

  return {
    $schema: MCP_SCHEMA_URL,
    name: "pluck-studio",
    version,
    description:
      "Pluck Studio — operator-facing surface for the Pluck Bureau. 11 alpha programs (DRAGNET, OATH, FINGERPRINT, CUSTODY, WHISTLE, BOUNTY, SBOM-AI, ROTATE, TRIPWIRE, NUCLEI, MOLE) wired through a unified /v1/runs activation pattern, each emitting Sigstore-Rekor-anchored DSSE-signed receipts.",
    homepage: baseUrl,
    openapi: `${baseUrl}/openapi.json`,
    resources,
    tools,
    prompts,
    auth,
  };
}
