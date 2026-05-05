// ---------------------------------------------------------------------------
// phrase-sigil unit tests
// ---------------------------------------------------------------------------
//
// Lock the determinism contract:
//   - Same input → same output (data + SVG bytes)
//   - Different adjectives → different fillColor
//   - Different nouns → different shape (statistically; tested across vocab)
//   - Serial extracted exactly from the digit suffix
//   - Shape always one of the 10 published variants
//   - SVG output is parseable XML
//   - Snapshot a fixed phrase to catch any drift in the byte output
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  phraseSigilData,
  renderPhraseSigil,
  SIGIL_SHAPES,
  type SigilShape,
} from "../phrase-sigil.js";

const FIXED_PHRASE = "openai-swift-falcon-3742";

describe("phraseSigilData", () => {
  it("is deterministic — same input yields identical output", () => {
    const a = phraseSigilData(FIXED_PHRASE);
    const b = phraseSigilData(FIXED_PHRASE);
    expect(a).toEqual(b);
  });

  it("extracts the serial badge from a scoped phrase", () => {
    const data = phraseSigilData(FIXED_PHRASE);
    expect(data.serialBadge).toBe("3742");
  });

  it("extracts the serial from a bare 3-part phrase", () => {
    const data = phraseSigilData("swift-falcon-1234");
    expect(data.serialBadge).toBe("1234");
  });

  it("yields empty serial when input is unparseable", () => {
    const data = phraseSigilData("not-a-real-phrase-id-at-all");
    expect(data.serialBadge).toBe("");
  });

  it("produces a different fillColor when adjective changes", () => {
    const a = phraseSigilData("openai-swift-falcon-3742");
    const b = phraseSigilData("openai-amber-falcon-3742");
    expect(a.fillColor).not.toBe(b.fillColor);
  });

  it("produces a different shape across the 10-noun span", () => {
    // Sample across the FNV-1a hash space using the actual phrase-id
    // vocabulary of nouns. Every output shape must belong to the 10-shape
    // catalog AND coverage must be wide (≥ 6 distinct shapes in this
    // 20-sample slice — the FNV-1a hash spreads uniformly enough).
    const nouns = "falcon eagle wolf bear hawk owl raven dove tiger lion seal otter fox panda heron elk deer goat horse jaguar".split(" ");
    const seen = new Set<SigilShape>();
    for (const noun of nouns) {
      const data = phraseSigilData(`openai-swift-${noun}-3742`);
      expect(SIGIL_SHAPES).toContain(data.shape);
      seen.add(data.shape);
    }
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });

  it("emits one of the 10 catalog shapes", () => {
    const data = phraseSigilData(FIXED_PHRASE);
    expect(SIGIL_SHAPES).toContain(data.shape);
  });

  it("hue is stable in 0..359 range", () => {
    const data = phraseSigilData(FIXED_PHRASE);
    const m = /^hsl\((\d+),/.exec(data.fillColor);
    expect(m).not.toBeNull();
    if (m) {
      const hue = Number.parseInt(m[1] ?? "0", 10);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThanOrEqual(359);
    }
  });

  it("uses the supplied programAccent when valid", () => {
    const data = phraseSigilData(FIXED_PHRASE, { programAccent: "#a3201d" });
    expect(data.accentColor).toBe("#a3201d");
  });

  it("falls back to the default accent for invalid color literals", () => {
    const dirty = phraseSigilData(FIXED_PHRASE, {
      programAccent: 'red"); <script>',
    });
    expect(dirty.accentColor).toBe("#6b7280");
  });

  it("falls back to the default accent when no opts given", () => {
    const data = phraseSigilData(FIXED_PHRASE);
    expect(data.accentColor).toBe("#6b7280");
  });

  it("seed is a non-zero unsigned 32-bit number", () => {
    const data = phraseSigilData(FIXED_PHRASE);
    expect(data.seed).toBeGreaterThan(0);
    expect(data.seed).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(data.seed)).toBe(true);
  });
});

describe("renderPhraseSigil", () => {
  it("renders a 64x64 SVG by default", () => {
    const svg = renderPhraseSigil(phraseSigilData(FIXED_PHRASE));
    expect(svg).toMatch(/<svg /);
    expect(svg).toMatch(/width="64"/);
    expect(svg).toMatch(/height="64"/);
    expect(svg).toMatch(/viewBox="0 0 100 100"/);
  });

  it("scales width/height when size prop changes", () => {
    const svg = renderPhraseSigil(phraseSigilData(FIXED_PHRASE), 128);
    expect(svg).toMatch(/width="128"/);
    expect(svg).toMatch(/height="128"/);
    // viewBox must stay 100x100 regardless of size — geometry is fixed.
    expect(svg).toMatch(/viewBox="0 0 100 100"/);
  });

  it("includes the serial badge text when present", () => {
    const svg = renderPhraseSigil(phraseSigilData(FIXED_PHRASE));
    expect(svg).toMatch(/>3742</);
    expect(svg).toMatch(/font-family="ui-monospace, monospace"/);
  });

  it("omits the serial text node when serial is empty", () => {
    const svg = renderPhraseSigil(phraseSigilData("garbage"));
    expect(svg).not.toMatch(/<text /);
  });

  it("output is well-formed (balanced tags + valid envelope)", () => {
    // Vitest runs under Node without a DOM by default, so we do a
    // lightweight structural check rather than `new DOMParser()`. This
    // catches the common drift modes — unbalanced container tags or
    // the SVG envelope getting clipped.
    const svg = renderPhraseSigil(phraseSigilData(FIXED_PHRASE));
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    // Container tags (svg, defs, linearGradient, text) MUST be balanced.
    // Self-closing primitives (rect, polygon, circle, path, stop) are
    // counted by their slash-close form.
    for (const tag of ["svg", "defs", "linearGradient"]) {
      const open = (svg.match(new RegExp(`<${tag}\\b`, "g")) ?? []).length;
      const close = (svg.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
      expect(open).toBe(close);
    }
  });

  it("snapshot — locks the deterministic SVG byte output", () => {
    // If this snapshot diffs, the determinism contract for receipt URLs
    // has shifted. Bump only when intentional — every external surface
    // (OG cards, RSS embeds, share targets) caches the bytes.
    const svg = renderPhraseSigil(
      phraseSigilData("openai-swift-falcon-3742", {
        programAccent: "#a3201d",
      }),
    );
    expect(svg).toMatchSnapshot();
  });
});
