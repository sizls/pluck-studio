// ---------------------------------------------------------------------------
// /mcp — Model Context Protocol integration docs
// ---------------------------------------------------------------------------
//
// Operator-facing wiring page for AI clients (Claude Desktop, Cursor, any
// MCP-compatible host). Renders the same manifest data the JSON endpoint
// at /api/mcp/manifest.json serves, but framed for humans:
//
//   - What is MCP? (1-sentence explainer + spec link)
//   - Quick start — copy-pastable curl + mcp.config.json snippets
//   - Resources (pluck:// URIs)
//   - Tools (pluck.* names + input shapes)
//   - Auth (bearer + cookie)
//   - Manifest link (the canonical machine-readable surface)
//
// Studio does NOT implement the MCP wire protocol itself — the external
// `@sizls/pluck-mcp` server bridges /v1/runs to MCP. This page tells
// operators how to wire the two together.
//
// data-testid hooks let e2e specs assert the load-bearing sections render.
// ---------------------------------------------------------------------------

import type { CSSProperties, ReactNode } from "react";

import { buildManifest } from "../../lib/mcp/build-manifest";

export const metadata = {
  title: "MCP integration — Pluck Studio",
  description:
    "Wire Pluck Studio into Claude Desktop, Cursor, or any Model Context Protocol client. Discover resources, call tools, fetch signed receipts.",
};

const SectionHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginTop: 32,
};

const SubHeadingStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg)",
  marginTop: 20,
};

const CalloutStyle: CSSProperties = {
  marginTop: 16,
  padding: "12px 16px",
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  border: "1px dashed var(--bureau-fg-dim)",
  borderRadius: 4,
  background: "rgba(255,255,255,0.02)",
};

const PreStyle: CSSProperties = {
  marginTop: 12,
  padding: 16,
  fontFamily: "var(--bureau-mono)",
  fontSize: 12,
  lineHeight: 1.55,
  color: "var(--bureau-fg)",
  background: "rgba(0,0,0,0.35)",
  border: "1px solid var(--bureau-fg-dim)",
  borderRadius: 4,
  overflowX: "auto",
};

const RowStyle: CSSProperties = {
  borderBottom: "1px solid var(--bureau-fg-dim)",
  padding: "10px 0",
};

const UriStyle: CSSProperties = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 13,
  color: "var(--bureau-fg)",
};

const DimStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "var(--bureau-fg-dim)",
  lineHeight: 1.55,
};

const MANIFEST_URL = "https://studio.pluck.run/api/mcp/manifest.json";
const SPEC_URL = "https://modelcontextprotocol.io";
const BRIDGE_PACKAGE = "@sizls/pluck-mcp";

const CURL_SNIPPET = `curl -s ${MANIFEST_URL} | jq .`;

const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "pluck-studio": {
      "command": "npx",
      "args": ["-y", "${BRIDGE_PACKAGE}"],
      "env": {
        "PLUCK_STUDIO_URL": "https://studio.pluck.run",
        "PLUCK_STUDIO_TOKEN": "<your-bearer-token>"
      }
    }
  }
}`;

export default function McpPage(): ReactNode {
  const manifest = buildManifest({
    baseUrl: "https://studio.pluck.run",
    version: "0.1.1",
  });

  return (
    <main data-testid="mcp-page">
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">MCP integration</h1>
        <p className="bureau-hero-tagline">
          Wire Pluck Studio into Claude Desktop, Cursor, or any
          Model Context Protocol client. Discover the 11 Bureau
          programs as MCP resources, call <code>pluck.*</code> tools
          from the agent, fetch signed Sigstore-Rekor-anchored
          receipts by phrase ID.
        </p>
      </section>

      <section data-testid="mcp-what-is-section">
        <h2 style={SectionHeadingStyle}>What is MCP?</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          The{" "}
          <a href={SPEC_URL} target="_blank" rel="noopener noreferrer">
            Model Context Protocol
          </a>{" "}
          is an open standard for letting AI agents discover and
          call external tools and resources. Studio publishes a
          manifest describing its <code>/v1/runs</code> surface;
          the external{" "}
          <code>{BRIDGE_PACKAGE}</code> server reads the manifest
          and exposes the MCP wire protocol so any compatible client
          (Claude Desktop, Cursor, custom hosts) can list, fetch,
          and execute Pluck Bureau programs natively.
        </p>
        <div style={CalloutStyle}>
          Studio does <strong>not</strong> implement the MCP wire
          protocol itself — this page is the discovery surface, like
          robots.txt or openapi.json. The external{" "}
          <code>{BRIDGE_PACKAGE}</code> bridge does the protocol work.
        </div>
      </section>

      <section data-testid="mcp-quickstart">
        <h2 style={SectionHeadingStyle}>Quick start</h2>

        <h3 style={SubHeadingStyle}>1. Fetch the manifest</h3>
        <pre style={PreStyle}>
          <code>{CURL_SNIPPET}</code>
        </pre>

        <h3 style={SubHeadingStyle}>2. Add Studio to your MCP client</h3>
        <p style={DimStyle}>
          Drop this into{" "}
          <code>~/.config/claude-desktop/mcp.config.json</code> (or
          your client's equivalent). Restart the client; the
          Pluck Bureau programs surface as discoverable tools and
          resources.
        </p>
        <pre style={PreStyle}>
          <code>{MCP_CONFIG_SNIPPET}</code>
        </pre>

        <h3 style={SubHeadingStyle}>3. Authenticate</h3>
        <p style={DimStyle}>
          GET access to receipts is public-read by phrase ID — no
          token required. POSTing a run (the <code>pluck.run</code>{" "}
          tool) requires a Supabase JWT cookie OR a dev-mode Bearer
          token in <code>PLUCK_STUDIO_TOKEN</code>.
        </p>
      </section>

      <section data-testid="mcp-resources-section">
        <h2 style={SectionHeadingStyle}>
          Resources ({manifest.resources.length})
        </h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          Every Studio resource lives under the stable{" "}
          <code>pluck://</code> URI namespace. Once shipped, these
          URIs do not change.
        </p>
        <ul style={{ marginTop: 12, padding: 0, listStyle: "none" }}>
          {manifest.resources.map((r) => (
            <li
              key={r.uri}
              style={RowStyle}
              data-testid={`mcp-resource-${r.uri.replace(/[^a-z0-9]/gi, "-")}`}
            >
              <code style={UriStyle}>{r.uri}</code>
              <p style={DimStyle}>{r.description}</p>
              <p style={{ ...DimStyle, fontSize: 12 }}>
                <strong>Mime:</strong> <code>{r.mimeType}</code>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="mcp-tools-section">
        <h2 style={SectionHeadingStyle}>
          Tools ({manifest.tools.length})
        </h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          Tools agents can call directly. Each declares a JSON-Schema
          input shape so the agent can construct valid calls without
          out-of-band examples.
        </p>
        <ul style={{ marginTop: 12, padding: 0, listStyle: "none" }}>
          {manifest.tools.map((t) => (
            <li
              key={t.name}
              style={RowStyle}
              data-testid={`mcp-tool-${t.name.replace(/\./g, "-")}`}
            >
              <code style={UriStyle}>{t.name}</code>
              <p style={DimStyle}>{t.description}</p>
              <pre style={{ ...PreStyle, marginTop: 8, fontSize: 11 }}>
                <code>{JSON.stringify(t.inputSchema, null, 2)}</code>
              </pre>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="mcp-prompts-section">
        <h2 style={SectionHeadingStyle}>
          Prompts ({manifest.prompts.length})
        </h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          Pre-baked multi-step recipes the agent can invoke as a
          single shot.
        </p>
        <ul style={{ marginTop: 12, padding: 0, listStyle: "none" }}>
          {manifest.prompts.map((p) => (
            <li key={p.name} style={RowStyle}>
              <code style={UriStyle}>{p.name}</code>
              <p style={DimStyle}>{p.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="mcp-auth-section">
        <h2 style={SectionHeadingStyle}>Auth</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          <strong>Type:</strong> <code>{manifest.auth.type}</code>
          <br />
          <strong>Bearer env var:</strong>{" "}
          <code>{manifest.auth.bearerEnv}</code>
          <br />
          <strong>Cookie:</strong> <code>{manifest.auth.cookieName}</code>
        </p>
        <p style={DimStyle}>{manifest.auth.note}</p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Manifest</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          The canonical machine-readable surface lives at{" "}
          <a href="/api/mcp/manifest.json" data-testid="mcp-manifest-link">
            <code>/api/mcp/manifest.json</code>
          </a>
          . Cached for 5 minutes, public read, deterministic — same
          source-of-truth registry that drives <a href="/runs">/runs</a>{" "}
          and the OpenAPI spec at{" "}
          <a href="/openapi.json">
            <code>/openapi.json</code>
          </a>
          .
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Cross-links</h2>
        <p style={{ marginTop: 8, lineHeight: 1.6 }}>
          Run a program from the browser instead:{" "}
          <a href="/runs">/runs</a>. Read the full HTTP API:{" "}
          <a href="/openapi.json">
            <code>/openapi.json</code>
          </a>
          . Privacy posture per program:{" "}
          <a href="/what-we-dont-know">/what-we-dont-know</a>.
        </p>
      </section>
    </main>
  );
}
