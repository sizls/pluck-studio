// ---------------------------------------------------------------------------
// /search page — server-render unit test
// ---------------------------------------------------------------------------
//
// Locks the page render contract:
//   - Empty query: form + empty-state + sample links visible
//   - Known query: decomposition card + direct match + related grid
//   - Invalid query: error message + empty-state
//   - Scope-only match (no direct): no-direct-match info + related grid
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SearchPage from "../page.js";

async function render(q?: string): Promise<string> {
  const params = q === undefined ? {} : { q };
  const node = await SearchPage({
    searchParams: Promise.resolve(params),
  });

  return renderToStaticMarkup(node as never);
}

describe("/search page — server render", () => {
  it("renders the form + empty state + sample links when no query", async () => {
    const html = await render();
    expect(html).toContain('data-testid="search-page"');
    expect(html).toContain('data-testid="search-form"');
    expect(html).toContain('data-testid="search-input"');
    expect(html).toContain('data-testid="search-empty-state"');
    expect(html).toContain('data-testid="search-sample-link"');
  });

  it("renders decomposition + results for a known phrase ID", async () => {
    const html = await render("openai-bold-marlin-1188");
    expect(html).toContain('data-testid="search-results"');
    expect(html).toContain('data-testid="search-decomposition"');
    expect(html).toContain('data-testid="search-direct-match"');
    expect(html).toContain('data-testid="search-related-result"');
    expect(html).toContain("openai");
    // Decomposition cells render the parts
    expect(html).toContain(">bold<");
    expect(html).toContain(">marlin<");
    expect(html).toContain(">1188<");
  });

  it("renders an error message + empty state for invalid input", async () => {
    const html = await render("garbage");
    expect(html).toContain('data-testid="search-results"');
    expect(html).toContain('data-testid="search-error"');
    expect(html).toContain('data-testid="search-empty-state"');
  });

  it("renders no-direct-match info when scope is known but exact ID isn't", async () => {
    const html = await render("openai-zzzzz-zzzzz-9999");
    expect(html).toContain('data-testid="search-no-direct-match"');
    expect(html).toContain('data-testid="search-related-result"');
  });

  it("renders no-related info when scope is valid but unsupported", async () => {
    const html = await render("hackerone-quiet-otter-2210");
    expect(html).toContain('data-testid="search-decomposition"');
    expect(html).toContain('data-testid="search-no-direct-match"');
    expect(html).toContain('data-testid="search-no-related"');
  });

  it("normalizes case + whitespace in the URL query", async () => {
    const html = await render("  OPENAI-BOLD-MARLIN-1188  ");
    expect(html).toContain('data-testid="search-direct-match"');
  });

  it("the form's default value reflects the query", async () => {
    const html = await render("openai-bold-marlin-1188");
    expect(html).toMatch(/value="openai-bold-marlin-1188"/);
  });

  it("each result tile carries a receipt URL", async () => {
    const html = await render("openai-bold-marlin-1188");
    expect(html).toMatch(/href="\/bureau\/[a-z-]+\/runs\/openai-/);
  });

  it("renders the total-count summary", async () => {
    const html = await render("openai-bold-marlin-1188");
    expect(html).toContain('data-testid="search-total-count"');
  });
});
