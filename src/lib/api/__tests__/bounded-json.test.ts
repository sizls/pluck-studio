// ---------------------------------------------------------------------------
// bounded-json — body-cap reader contract tests
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import {
  MAX_REQUEST_BODY_BYTES,
  readBoundedJson,
} from "../bounded-json.js";

function reqWith(body: string, headers: Record<string, string> = {}): Request {
  return new Request("https://studio.pluck.run/test", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("readBoundedJson", () => {
  it("returns the parsed value on a valid small body", async () => {
    const r = await readBoundedJson(reqWith(JSON.stringify({ a: 1 })));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({ a: 1 });
    }
  });

  it("rejects bodies whose Content-Length exceeds the cap with 413", async () => {
    const over = String(MAX_REQUEST_BODY_BYTES + 1);
    const r = await readBoundedJson(
      reqWith(JSON.stringify({}), { "content-length": over }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(413);
      expect(r.error).toBe("request body too large");
    }
  });

  it("rejects invalid JSON with 400", async () => {
    const r = await readBoundedJson(reqWith("{ not json"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.error).toBe("invalid JSON body");
    }
  });

  it("accepts a body when Content-Length is absent (best-effort gate)", async () => {
    // No content-length supplied — the cap can't enforce; parse proceeds.
    const r = await readBoundedJson(
      new Request("https://studio.pluck.run/test", {
        method: "POST",
        body: JSON.stringify({ ok: true }),
      }),
    );
    expect(r.ok).toBe(true);
  });

  it("honours a custom maxBytes override", async () => {
    const r = await readBoundedJson(
      reqWith(JSON.stringify({}), { "content-length": "200" }),
      128,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(413);
    }
  });
});
