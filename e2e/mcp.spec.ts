// ---------------------------------------------------------------------------
// e2e/mcp.spec.ts — MCP integration scaffold
// ---------------------------------------------------------------------------
//
// Locks the public discovery surface that external MCP clients
// (Claude Desktop, Cursor, custom hosts via @sizls/pluck-mcp) bind
// against:
//
//   1. GET /api/mcp/manifest.json → 200 + valid JSON with the
//      load-bearing fields (specReference, name, version, description,
//      resources, tools, prompts, auth) and NO `$schema` (intentional —
//      MCP doesn't ship a static manifest schema).
//   2. GET /mcp → operator-facing wiring docs render with the
//      load-bearing sections (quickstart, resources, tools, auth,
//      manifest link, preview callout).
//   3. /runs → /mcp cross-link round-trip — reachable from the
//      activations hub the way every other cross-cutting surface is.
// ---------------------------------------------------------------------------

import { expect, test } from "@playwright/test";

test.describe("MCP integration scaffold", () => {
  test("GET /api/mcp/manifest.json returns 200 with valid JSON", async ({
    request,
  }) => {
    const res = await request.get("/api/mcp/manifest.json", {
      headers: {
        // Same-site CSRF gate is identical to /openapi.json + /v1/runs.
        "sec-fetch-site": "same-origin",
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^application\/json/);
    expect(res.headers()["cache-control"]).toBe("public, max-age=300");

    const body = await res.json();
    expect(body.specReference).toBe("https://modelcontextprotocol.io");
    expect(body.$schema).toBeUndefined();
    expect(body.description).toMatch(/Studio MCP discovery document/);
    expect(body.name).toBe("pluck-studio");
    expect(typeof body.version).toBe("string");
    expect(Array.isArray(body.resources)).toBe(true);
    expect(Array.isArray(body.tools)).toBe(true);
    expect(Array.isArray(body.prompts)).toBe(true);
    expect(typeof body.auth).toBe("object");

    const toolNames = body.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("pluck.search");
    expect(toolNames).toContain("pluck.diff");
    expect(toolNames).toContain("pluck.run");
  });

  test("/mcp page surfaces the preview callout for the unpublished bridge", async ({
    page,
  }) => {
    await page.goto("/mcp");
    const callout = page.getByTestId("mcp-preview-callout");
    await expect(callout).toBeVisible();
    await expect(callout).toContainText("@sizls/pluck-mcp");
    await expect(callout).toContainText(/not yet published/i);

    // The working alternative — direct curl loop — must be visible
    // alongside, so operators have something to run today.
    await expect(page.getByTestId("mcp-curl-loop")).toBeVisible();
  });

  test("/mcp page renders with quickstart + resources + tools + auth visible", async ({
    page,
  }) => {
    await page.goto("/mcp");

    await expect(page.getByTestId("mcp-page")).toBeVisible();
    await expect(page.getByTestId("mcp-quickstart")).toBeVisible();
    await expect(page.getByTestId("mcp-resources-section")).toBeVisible();
    await expect(page.getByTestId("mcp-tools-section")).toBeVisible();
    await expect(page.getByTestId("mcp-auth-section")).toBeVisible();
    await expect(page.getByTestId("mcp-manifest-link")).toBeVisible();
  });

  test("/mcp surfaces all three pluck.* tools by name", async ({ page }) => {
    await page.goto("/mcp");
    const tools = page.getByTestId("mcp-tools-section");
    await expect(tools).toContainText("pluck.search");
    await expect(tools).toContainText("pluck.diff");
    await expect(tools).toContainText("pluck.run");
  });

  test("/runs → /mcp cross-link round-trip", async ({ page }) => {
    // The /runs hub cross-links every cross-cutting surface; /mcp
    // joins that list. Operators MUST be able to reach the wiring
    // page from one click off the activations directory.
    await page.goto("/runs");
    await page.getByTestId("mcp-cross-link").getByRole("link").first().click();
    await page.waitForURL(/\/mcp$/);
    await expect(page.getByTestId("mcp-page")).toBeVisible();
  });
});
