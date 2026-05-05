// ---------------------------------------------------------------------------
// /vendor/[slug]/feed.xml — Atom 1.0 contract test
// ---------------------------------------------------------------------------
//
// Locks the Subscription Feed contract:
//   - 200 OK + application/atom+xml; charset=utf-8 for every curated slug
//   - 404 for unknown slugs (vetted-allowlist gate identical to the page)
//   - Atom 1.0 root + at least one <entry> per known vendor
//   - Cache-Control: public, max-age=300 (matches typical RSS poll cadence)
//   - X-Content-Type-Options: nosniff
//   - "(illustrative)" suffix appears on every entry's <summary>
//   - Every <id> is a fully-qualified `/bureau/<program>/runs/<phraseId>` URL
//   - PRIVACY: redacted fields (e.g. WHISTLE bundleUrl, ROTATE operatorNote)
//     never appear in the body. Spot-check by name.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import { listVendorSlugs } from "../../../../../lib/programs/vendor-registry";
import { GET } from "../route.js";

interface Ctx {
  params: Promise<{ slug: string }>;
}

function ctx(slug: string): Ctx {
  return { params: Promise.resolve({ slug }) };
}

function req(slug: string): Request {
  return new Request(`https://studio.pluck.run/vendor/${slug}/feed.xml`, {
    method: "GET",
  });
}

async function getBody(slug: string): Promise<{ status: number; body: string; headers: Headers }> {
  // notFound() throws a NEXT_NOT_FOUND error in the Next.js runtime;
  // catch it so we can map to a 404 assertion shape that doesn't depend
  // on the framework's internal control-flow throw.
  try {
    const res = await GET(req(slug), ctx(slug));

    return {
      status: res.status,
      body: await res.text(),
      headers: res.headers,
    };
  } catch (err) {
    const digest = (err as { digest?: string } | null)?.digest ?? "";

    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404") || digest === "NEXT_NOT_FOUND") {
      return { status: 404, body: "", headers: new Headers() };
    }
    throw err;
  }
}

describe("GET /vendor/[slug]/feed.xml", () => {
  it("returns 200 with application/atom+xml for a known vendor", async () => {
    const { status, headers } = await getBody("openai");
    expect(status).toBe(200);
    expect(headers.get("content-type")).toBe(
      "application/atom+xml; charset=utf-8",
    );
  });

  it("sets Cache-Control: public, max-age=300", async () => {
    const { headers } = await getBody("openai");
    expect(headers.get("cache-control")).toBe("public, max-age=300");
  });

  it("sets X-Content-Type-Options: nosniff", async () => {
    const { headers } = await getBody("openai");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("body is well-formed Atom 1.0", async () => {
    const { body } = await getBody("openai");
    expect(body).toMatch(/^<\?xml version="1\.0" encoding="utf-8"\?>/);
    expect(body).toContain('<feed xmlns="http://www.w3.org/2005/Atom">');
    expect(body).toContain("</feed>");
    // Required Atom feed elements.
    expect(body).toMatch(/<id>https:\/\/studio\.pluck\.run\/vendor\/openai\/feed\.xml<\/id>/);
    expect(body).toMatch(/<title>Pluck Studio — OpenAI activity<\/title>/);
    expect(body).toMatch(/<subtitle>Per-vendor receipts/);
    expect(body).toContain('<link rel="self" href="https://studio.pluck.run/vendor/openai/feed.xml" />');
    expect(body).toContain('<link rel="alternate" type="text/html" href="https://studio.pluck.run/vendor/openai" />');
    expect(body).toMatch(/<updated>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(body).toContain("<author><name>Pluck Studio</name></author>");
  });

  it("emits at least one <entry> for every curated vendor", async () => {
    for (const slug of listVendorSlugs()) {
      const { status, body } = await getBody(slug);
      expect(status, `vendor ${slug} should return 200`).toBe(200);
      expect(body, `vendor ${slug} should contain <entry>`).toContain(
        "<entry>",
      );
      expect(body, `vendor ${slug} should contain </entry>`).toContain(
        "</entry>",
      );
    }
  });

  it("every entry's <id> points at a /bureau/<program>/runs/<phraseId> URL", async () => {
    const { body } = await getBody("openai");
    const idMatches = body.match(/<id>([^<]+)<\/id>/g) ?? [];
    // First <id> is the feed self-id; subsequent are entry ids.
    expect(idMatches.length).toBeGreaterThan(1);

    const entryIds = idMatches.slice(1);
    expect(entryIds.length).toBeGreaterThan(0);
    for (const raw of entryIds) {
      const url = raw.replace(/^<id>/, "").replace(/<\/id>$/, "");
      expect(url).toMatch(
        /^https:\/\/studio\.pluck\.run\/bureau\/(dragnet|oath|fingerprint|custody|nuclei|mole)\/runs\/openai-[a-z0-9-]+$/,
      );
    }
  });

  it("every <entry>'s <summary> ends with the (illustrative) suffix", async () => {
    const { body } = await getBody("anthropic");
    const summaries = body.match(/<summary>([\s\S]*?)<\/summary>/g) ?? [];
    expect(summaries.length).toBeGreaterThan(0);
    for (const raw of summaries) {
      expect(raw).toMatch(/\(illustrative\)<\/summary>$/);
    }
  });

  it("every <entry> has the required Atom child elements", async () => {
    const { body } = await getBody("google");
    const entries = body.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e).toMatch(/<id>https:\/\/studio\.pluck\.run\/bureau\//);
      expect(e).toMatch(/<title>[A-Z]+ — /); // "DRAGNET — ", "OATH — " etc.
      expect(e).toMatch(/<link href="https:\/\/studio\.pluck\.run\/bureau\//);
      expect(e).toMatch(/<updated>\d{4}-\d{2}-\d{2}T/);
      expect(e).toMatch(/<published>\d{4}-\d{2}-\d{2}T/);
      expect(e).toContain("<author><name>Pluck Studio</name></author>");
      expect(e).toMatch(/<summary>[\s\S]*<\/summary>/);
    }
  });

  it("returns 404 for an unknown slug (vetted-allowlist gate)", async () => {
    const { status } = await getBody("not-a-real-vendor");
    expect(status).toBe(404);
  });

  it("returns 404 for a slug containing path traversal characters", async () => {
    const { status } = await getBody("../../../etc/passwd");
    expect(status).toBe(404);
  });

  it("PRIVACY: never echoes a redacted bundleUrl in the body", async () => {
    // The preview data shape doesn't carry bundleUrl, but the redactor
    // is wired at the feed boundary defense-in-depth. Spot-check that
    // no http:// URL leaks beyond the canonical receipt URLs we control.
    const { body } = await getBody("openai");
    // No `bundleUrl` field token in the XML.
    expect(body).not.toContain("bundleUrl");
    // No `operatorNote` field token in the XML (ROTATE redaction).
    expect(body).not.toContain("operatorNote");
    // No `manualRedactPhrase` field token in the XML (WHISTLE redaction).
    expect(body).not.toContain("manualRedactPhrase");
    // Every URL in the response is either a studio.pluck.run canonical
    // URL or the Atom XML namespace (http://www.w3.org/2005/Atom).
    const urls = body.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(
        /^(https:\/\/studio\.pluck\.run|http:\/\/www\.w3\.org\/2005\/Atom)/,
      );
    }
  });

  it("XML escapes are applied to text content (defense-in-depth)", async () => {
    // Sanity check: control characters that would break the XML parser
    // are not present anywhere in the body. We can't easily inject a
    // hostile value (preview data is hand-curated), but if any future
    // upstream change drifts a `<` or `&` through, the body will still
    // be parseable XML.
    const { body } = await getBody("openai");
    // No raw `&` outside an entity reference.
    expect(body).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
  });
});
