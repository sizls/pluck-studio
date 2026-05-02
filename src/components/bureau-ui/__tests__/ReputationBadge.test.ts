// ---------------------------------------------------------------------------
// ReputationBadge SVG renderer tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { renderReputationBadgeSvg } from "../ReputationBadge.js";

describe("renderReputationBadgeSvg", () => {
  it("renders a 320x40 SVG with the vendor + score", () => {
    const svg = renderReputationBadgeSvg({ vendor: "openai", score: 87 });
    expect(svg).toMatch(/<svg/);
    expect(svg).toMatch(/width="320"/);
    expect(svg).toMatch(/height="40"/);
    expect(svg).toMatch(/openai/);
    expect(svg).toMatch(/87/);
  });

  it("includes model when provided", () => {
    const svg = renderReputationBadgeSvg({
      vendor: "openai",
      model: "gpt-4o",
      score: 50,
    });
    expect(svg).toMatch(/openai \/ gpt-4o/);
  });

  it("uses green fill when score >= 80", () => {
    const svg = renderReputationBadgeSvg({ vendor: "openai", score: 90 });
    expect(svg).toMatch(/#1f7a3a/);
  });

  it("uses yellow fill when 60 <= score < 80", () => {
    const svg = renderReputationBadgeSvg({ vendor: "openai", score: 70 });
    expect(svg).toMatch(/#a78a1f/);
  });

  it("uses red fill when score < 60", () => {
    const svg = renderReputationBadgeSvg({ vendor: "openai", score: 30 });
    expect(svg).toMatch(/#a3201d/);
  });

  it("clamps score > 100 to 100", () => {
    const svg = renderReputationBadgeSvg({ vendor: "openai", score: 999 });
    expect(svg).toMatch(/100/);
  });

  it("clamps score < 0 to 0", () => {
    const svg = renderReputationBadgeSvg({ vendor: "openai", score: -50 });
    expect(svg).toMatch(/>0</);
  });

  it("escapes XML-significant characters in vendor", () => {
    const svg = renderReputationBadgeSvg({ vendor: '<x>&"y', score: 50 });
    expect(svg).not.toMatch(/<x>/);
    expect(svg).toMatch(/&lt;|&amp;/);
  });

  it("strips C0 control characters from inputs", () => {
    const dangerous = "open\x00\x01\x07\x1bai";
    const svg = renderReputationBadgeSvg({ vendor: dangerous, score: 50 });
    // eslint-disable-next-line no-control-regex
    expect(svg).not.toMatch(/[\x00-\x1f\x7f-\x9f]/);
    expect(svg).toMatch(/openai/);
  });

  it("output is bounded — under 4 KiB for normal inputs", () => {
    const svg = renderReputationBadgeSvg({
      vendor: "openai",
      model: "gpt-4o",
      score: 87.5,
    });
    expect(Buffer.byteLength(svg, "utf8")).toBeLessThan(4 * 1024);
  });
});
