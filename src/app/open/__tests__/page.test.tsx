// ---------------------------------------------------------------------------
// /open index page — server-render unit test
// ---------------------------------------------------------------------------
//
// Locks the explanation page contract:
//   - data-testid hooks for E2E
//   - sample links pointing at /open/<phrase>
//   - cross-link to /search
//   - explains the /o short-form alias
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import OpenIndexPage from "../page.js";

function render(): string {
  const node = OpenIndexPage();

  return renderToStaticMarkup(node as never);
}

describe("/open index page — server render", () => {
  it("renders the explainer with all data-testid hooks", () => {
    const html = render();
    expect(html).toContain('data-testid="open-index"');
    expect(html).toContain('data-testid="open-search-cross-link"');
  });

  it("renders sample /open/<phrase> links operators can click straight through", () => {
    const html = render();
    expect(html).toContain('data-testid="open-sample-link"');
    // Sample links are absolute paths into the speed-dial namespace.
    expect(html).toMatch(/href="\/open\/[a-z0-9-]+"/);
  });

  it("documents the /o short-form alias", () => {
    const html = render();
    expect(html).toContain("/o/swift-falcon-3742");
  });

  it("cross-links to /search for the related-by-scope path", () => {
    const html = render();
    expect(html).toContain('href="/search"');
  });

  it("explains the URL-bar paste behavior", () => {
    const html = render();
    expect(html.toLowerCase()).toContain("paste");
    expect(html).toContain("/open/");
  });
});
