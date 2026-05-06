// ---------------------------------------------------------------------------
// /diff/[id] page — server-render unit test
// ---------------------------------------------------------------------------
// Locks every UI state: instructions / ok / invalid / not-found /
// different-vendors. Plus reuse of PhraseSigil + receipt URLs.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DiffPage from "../page.js";

const BASE = "openai-bold-marlin-1188";
const TARGET = "openai-quiet-otter-2210";
const OATH = "openai-swift-falcon-3742";
const ANTHROPIC = "anthropic-bold-marlin-1188";

async function render(id: string, since?: string): Promise<string> {
  const node = await DiffPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(since === undefined ? {} : { since }),
  });

  return renderToStaticMarkup(node as never);
}

describe("/diff/[id] page — server render", () => {
  it("renders instructions when ?since= is missing", async () => {
    const html = await render(BASE);
    expect(html).toContain('data-testid="diff-page"');
    expect(html).toContain('data-testid="diff-instructions"');
    expect(html).toContain('data-testid="diff-sample-link"');
    expect(html).toContain(BASE);
  });

  it("renders OK state with both receipt cards + Changes panel + sigil row", async () => {
    const html = await render(BASE, TARGET);
    expect(html).toContain('data-testid="diff-ok-state"');
    expect(html).toContain('data-testid="diff-base-receipt"');
    expect(html).toContain('data-testid="diff-target-receipt"');
    expect(html).toContain('data-testid="diff-changes-panel"');
    expect(html).toContain('data-testid="diff-time-delta"');
    expect(html).toContain('data-testid="diff-sigil-row"');
    // green→amber across the two openai DRAGNET slots
    expect(html).toContain('data-testid="diff-verdict-changed"');
  });

  it("flags summary changed + cross-program when programs differ", async () => {
    const html = await render(BASE, OATH);
    expect(html).toContain('data-testid="diff-ok-state"');
    expect(html).toContain('data-testid="diff-summary-changed"');
    expect(html).toContain('data-testid="diff-cross-program"');
  });

  it("renders different-vendors state with both receipts + recovery sample", async () => {
    const html = await render(BASE, ANTHROPIC);
    expect(html).toContain('data-testid="diff-different-vendors-state"');
    expect(html).toContain('data-testid="diff-different-vendors-error"');
    expect(html).toContain('data-testid="diff-base-receipt"');
    expect(html).toContain('data-testid="diff-target-receipt"');
    expect(html).toContain('data-testid="diff-sample-link"');
    expect(html).toContain("openai");
    expect(html).toContain("anthropic");
  });

  it("renders invalid-phrase state for garbage input on either side", async () => {
    const baseInvalid = await render("garbage", TARGET);
    expect(baseInvalid).toContain('data-testid="diff-invalid-state"');
    expect(baseInvalid).toContain('data-testid="diff-invalid-error"');

    const targetInvalid = await render(BASE, "garbage");
    expect(targetInvalid).toContain('data-testid="diff-invalid-state"');
  });

  it("renders not-found state when receipt isn't in the store", async () => {
    const html = await render("openai-zzzzz-zzzzz-9999", BASE);
    expect(html).toContain('data-testid="diff-not-found-state"');
    expect(html).toContain('data-testid="diff-not-found-error"');
    expect(html).toContain("openai-zzzzz-zzzzz-9999");
  });

  it("each receipt card carries phraseId + receipt URL", async () => {
    const html = await render(BASE, TARGET);
    expect(html).toContain(`/bureau/dragnet/runs/${BASE}`);
    expect(html).toContain(`/bureau/dragnet/runs/${TARGET}`);
  });

  it("renders PhraseSigil SVGs for both phrase IDs in OK state", async () => {
    const html = await render(BASE, TARGET);
    // 2 cards + sigil row → ≥3 SVGs
    expect((html.match(/<svg/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("normalizes URL-encoded path params", async () => {
    const html = await render(encodeURIComponent(BASE), TARGET);
    expect(html).toContain('data-testid="diff-ok-state"');
  });
});
