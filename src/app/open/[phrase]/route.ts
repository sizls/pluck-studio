// ---------------------------------------------------------------------------
// GET /open/<phrase> — Phrase-ID Speed-Dial
// ---------------------------------------------------------------------------
//
// URL-bar shortcut: paste any phrase ID, get redirected to whichever
// program owns the receipt. PhraseIds become a global namespace —
// `studio.pluck.run/open/openai-bold-marlin-1188` resolves to the
// canonical receipt page no matter which Bureau program the run came
// from.
//
// Pure server-side redirect. No client JS, no auth gate (phrase IDs
// are already the share credential — same Google-Docs-share-link model
// the receipt pages use). Cache-Control: private, no-store — these
// short URLs always live-resolve so a freshly-created run ID lights up
// the moment the operator pastes it.
//
// Resolution lives in `src/lib/speed-dial.ts` so /o/<phrase> can
// re-use the exact same logic without drift.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { resolvePhraseSpeedDial } from "../../../lib/speed-dial.js";

interface RouteContext {
  params: Promise<{ phrase: string }>;
}

const REDIRECT_HEADERS = {
  // Live-resolve every time. A freshly-created run ID must light up the
  // instant it's pasted — and CDN-caching a 302 to one operator's
  // receipt URL would leak it to anyone else hitting the same speed-dial.
  "Cache-Control": "private, no-store",
  // Short URLs intended for hand-paste; refuse search-engine indexing
  // so /open/<phrase> doesn't accidentally become a permanent record of
  // arbitrary phrase variants.
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export async function GET(
  _req: Request,
  context: RouteContext,
): Promise<Response> {
  const { phrase } = await context.params;
  const resolution = resolvePhraseSpeedDial(phrase);

  return NextResponse.redirect(
    new URL(resolution.target, _req.url),
    { status: 302, headers: REDIRECT_HEADERS },
  );
}
