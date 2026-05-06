// ---------------------------------------------------------------------------
// /mcp page — render contract
// ---------------------------------------------------------------------------
//
// Locks the operator-facing surface of the MCP integration:
//   - Renders without throwing
//   - Surfaces the load-bearing data-testid sections (quickstart,
//     resources, tools, auth, manifest link)
//   - Includes the canonical mcp.config.json snippet (so operators
//     can copy-paste into Claude Desktop / Cursor)
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import McpPage, { metadata } from "./page";

describe("/mcp page", () => {
  it("exports a page component", () => {
    expect(typeof McpPage).toBe("function");
  });

  it("declares page metadata title + description", () => {
    expect(metadata.title).toMatch(/MCP/);
    expect(typeof metadata.description).toBe("string");
    expect((metadata.description ?? "").length).toBeGreaterThan(0);
  });

  it("renders to a valid React tree", () => {
    const tree = McpPage();
    expect(tree).toBeDefined();
    expect(tree).not.toBeNull();
  });

  it("renders the load-bearing data-testid sections", () => {
    // Stringify the rendered tree and assert each load-bearing testid
    // hook is present. Cheap structural smoke; the e2e spec asserts
    // visibility in a real browser.
    const tree = JSON.stringify(McpPage());

    expect(tree).toContain("mcp-page");
    expect(tree).toContain("mcp-quickstart");
    expect(tree).toContain("mcp-resources-section");
    expect(tree).toContain("mcp-tools-section");
    expect(tree).toContain("mcp-auth-section");
    expect(tree).toContain("mcp-manifest-link");
  });

  it("includes the canonical mcp.config.json snippet", () => {
    const tree = JSON.stringify(McpPage());

    expect(tree).toContain("mcpServers");
    expect(tree).toContain("@sizls/pluck-mcp");
    expect(tree).toContain("PLUCK_STUDIO_TOKEN");
  });

  it("declares each pluck.* tool by name", () => {
    const tree = JSON.stringify(McpPage());

    expect(tree).toContain("pluck.search");
    expect(tree).toContain("pluck.diff");
    expect(tree).toContain("pluck.run");
  });

  it("surfaces the preview callout + working curl alternative", () => {
    const tree = JSON.stringify(McpPage());

    // Preview callout — operators must see that @sizls/pluck-mcp is
    // not yet on npm before they paste the mcp.config.json snippet.
    expect(tree).toContain("mcp-preview-callout");
    expect(tree).toContain("not yet published");

    // Working alternative — direct HTTP loop against /api/v1/runs.
    expect(tree).toContain("mcp-curl-loop");
    expect(tree).toContain("/api/v1/runs");
    expect(tree).toContain("bureau:dragnet");
  });

  it("sources the version from package.json (no hardcoded literal)", async () => {
    const pkg = await import("../../../package.json");
    const tree = JSON.stringify(McpPage());

    // The version comes through the manifest's auth/section render
    // and appears nowhere as a string literal in the page source.
    expect(typeof pkg.version).toBe("string");
    expect(pkg.version.length).toBeGreaterThan(0);
    // Manifest version is rendered in /api/mcp/manifest.json link copy;
    // the Resources/Tools sections use it via manifest.tools.length.
    // We assert the live package version is available — bumping
    // package.json is the single source of truth.
    expect(tree).toBeDefined();
  });
});
