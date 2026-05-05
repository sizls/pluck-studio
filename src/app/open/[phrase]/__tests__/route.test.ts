// ---------------------------------------------------------------------------
// /open/[phrase] route — Phrase-ID Speed-Dial unit tests
// ---------------------------------------------------------------------------
//
// Locks the redirect contract for both /open/<phrase> and the /o/<phrase>
// short-form alias (which re-exports the GET handler). Identical
// expectations across both surfaces — by design, since the alias is a
// thin re-export.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it } from "vitest";

import { GET as openGet } from "../route.js";
import { GET as oGet } from "../../../o/[phrase]/route.js";
import { __resetForTests, createRun } from "../../../../lib/v1/run-store.js";
import type { RunSpec } from "../../../../lib/v1/run-spec.js";
import { sampleSearchablePhraseIds } from "../../../../lib/search/phrase-stitch.js";

const dragnetSpec: RunSpec = {
  pipeline: "bureau:dragnet",
  payload: {
    targetUrl: "https://api.openai.com/v1/chat/completions",
    probePackId: "canon-honesty",
    cadence: "once",
    authorizationAcknowledged: true,
  },
};

beforeEach(() => {
  __resetForTests();
});

interface InvokeArgs {
  readonly phrase: string;
}

async function invoke(
  handler: typeof openGet,
  { phrase }: InvokeArgs,
): Promise<Response> {
  const url = `https://studio.pluck.run/open/${encodeURIComponent(phrase)}`;
  const req = new Request(url);

  return handler(req, { params: Promise.resolve({ phrase }) });
}

function locationOf(res: Response): string {
  const loc = res.headers.get("location");
  if (loc === null) {
    throw new Error("expected a Location header on a redirect response");
  }

  return loc;
}

describe.each([
  ["/open/<phrase>", openGet],
  ["/o/<phrase>", oGet],
] as const)("%s — speed-dial redirect", (label, handler) => {
  it("redirects 302 to the receipt URL when the phrase ID lives in the v1 store", async () => {
    const { record } = createRun(dragnetSpec);

    const res = await invoke(handler, { phrase: record.runId });

    expect(res.status).toBe(302);
    expect(locationOf(res).endsWith(record.receiptUrl)).toBe(true);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("redirects to /search when the phrase ID is valid but unknown", async () => {
    const phrase = "openai-bold-marlin-9999";

    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    expect(locationOf(res)).toContain(
      `/search?q=${encodeURIComponent(phrase)}`,
    );
  });

  it("redirects invalid phrase format to /search?q=<input> for graceful fallback", async () => {
    const phrase = "this-is-not-a-phrase-id";

    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    expect(locationOf(res)).toContain("/search?q=");
    expect(locationOf(res)).toContain(encodeURIComponent(phrase));
  });

  it("safely redirects path-traversal-ish input without crashing", async () => {
    const phrase = "../../../etc/passwd";

    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    // Must land on /search — never bounce out of the app, never crash.
    expect(locationOf(res)).toContain("/search?q=");
  });

  it("caps phrase length at 128 chars and falls back to /search", async () => {
    const phrase = "a".repeat(500);

    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    expect(locationOf(res)).toContain("/search?q=");
    // Truncated to the 128-char cap.
    const target = new URL(locationOf(res));
    const q = target.searchParams.get("q") ?? "";
    expect(q.length).toBeLessThanOrEqual(128);
  });

  it("128-char phrase passes through to parsePhraseId (boundary)", async () => {
    // Exactly at the cap — should NOT trip the over-length truncation.
    const phrase = "a".repeat(128);
    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    // Falls through to /search (parsePhraseId rejects single-token input)
    // but the q param is the FULL 128-char phrase, not truncated.
    const target = new URL(locationOf(res));
    const q = target.searchParams.get("q") ?? "";
    expect(q.length).toBe(128);
    expect(q).toBe(phrase);
  });

  it("129-char phrase trips the cap (boundary)", async () => {
    // One past the cap — must truncate to 128.
    const phrase = "a".repeat(129);
    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    const target = new URL(locationOf(res));
    const q = target.searchParams.get("q") ?? "";
    expect(q.length).toBeLessThanOrEqual(128);
    expect(q.length).toBeLessThan(phrase.length);
  });

  it("handles an empty phrase param without throwing", async () => {
    const res = await invoke(handler, { phrase: "" });

    expect(res.status).toBe(302);
    expect(locationOf(res)).toContain("/search");
  });

  it("resolves a known sample phrase ID to a receipt URL", async () => {
    const samples = sampleSearchablePhraseIds();
    expect(samples.length).toBeGreaterThan(0);

    const phrase = samples[0];
    if (phrase === undefined) {
      throw new Error("expected at least one sample phrase id");
    }

    const res = await invoke(handler, { phrase });

    expect(res.status).toBe(302);
    // Sample IDs round-trip through searchPhraseId — directMatch
    // resolves to the program's receipt URL, not /search.
    expect(locationOf(res)).not.toContain("/search?q=");
    expect(locationOf(res)).toContain("/bureau/");
  });

  it(`(${label}) emits cache-busting headers — no CDN caching of redirects`, async () => {
    const res = await invoke(handler, { phrase: "garbage" });

    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("/open and /o handlers are the exact same function reference", () => {
  it("re-exports the same GET — no behavioral drift possible", () => {
    expect(oGet).toBe(openGet);
  });
});
