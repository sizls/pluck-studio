// ---------------------------------------------------------------------------
// PhraseSigil component tests
// ---------------------------------------------------------------------------
//
// We render the component to static HTML via React-DOM/server (no JSDOM
// dependency required — the existing repo-wide vitest setup is Node-only)
// and assert on the markup. Same approach as ReputationBadge.test.ts.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { PhraseSigil } from "../PhraseSigil.js";

describe("<PhraseSigil>", () => {
  it("renders an SVG with the data-testid hook", () => {
    const html = renderToStaticMarkup(
      <PhraseSigil phraseId="openai-swift-falcon-3742" />,
    );
    expect(html).toContain('data-testid="phrase-sigil"');
    expect(html).toContain("<svg ");
    expect(html).toContain('viewBox="0 0 100 100"');
  });

  it("scales the SVG width/height when size prop changes", () => {
    const html = renderToStaticMarkup(
      <PhraseSigil phraseId="openai-swift-falcon-3742" size={128} />,
    );
    expect(html).toContain('width="128"');
    expect(html).toContain('height="128"');
  });

  it("threads the program accent into the rendered SVG stroke", () => {
    const html = renderToStaticMarkup(
      <PhraseSigil
        phraseId="openai-swift-falcon-3742"
        programAccent="#a3201d"
      />,
    );
    expect(html).toContain('stroke="#a3201d"');
  });

  it("exposes the phraseId + chosen shape via data-* attributes", () => {
    const html = renderToStaticMarkup(
      <PhraseSigil phraseId="openai-swift-falcon-3742" />,
    );
    expect(html).toMatch(/data-phrase-id="openai-swift-falcon-3742"/);
    expect(html).toMatch(/data-shape="[a-z0-9-]+"/);
  });

  it("honors the testId override prop", () => {
    const html = renderToStaticMarkup(
      <PhraseSigil
        phraseId="openai-swift-falcon-3742"
        testId="search-result-sigil"
      />,
    );
    expect(html).toContain('data-testid="search-result-sigil"');
  });
});
