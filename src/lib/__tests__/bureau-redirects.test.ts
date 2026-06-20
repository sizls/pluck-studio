// ---------------------------------------------------------------------------
// next.config.ts /bureau/* → /programs/* permanent-redirect contract
// ---------------------------------------------------------------------------
//
// The previous Studio route lived at `/bureau/*` and `/api/bureau/*`.
// Press coverage, Slack messages, email threads, and bookmarks
// accumulated under those paths. The rename to `/programs/*` ships a
// permanent (308) redirect for every old URL so:
//
//   - Pasted links keep working.
//   - Search engines learn the canonical destination.
//   - Machine clients POSTing to the old API receive 308 with a Location
//     header and a re-issuable request body.
//
// The tests below pin the three redirect rules so a future
// next.config.ts edit cannot silently delete them.
// ---------------------------------------------------------------------------

import { describe, expect, it } from "vitest";

import nextConfig from "../../../next.config.js";

describe("next.config.ts /bureau redirects", () => {
  it("exposes an async redirects() function", () => {
    expect(typeof nextConfig.redirects).toBe("function");
  });

  it("redirects /bureau (no trailing path) → /programs", async () => {
    const redirects = await nextConfig.redirects?.();
    const rule = redirects?.find((r) => r.source === "/bureau");
    expect(rule).toBeDefined();
    expect(rule?.destination).toBe("/programs");
    expect(rule?.permanent).toBe(true);
  });

  it("redirects /bureau/:path* → /programs/:path* (wildcard)", async () => {
    const redirects = await nextConfig.redirects?.();
    const rule = redirects?.find((r) => r.source === "/bureau/:path*");
    expect(rule).toBeDefined();
    expect(rule?.destination).toBe("/programs/:path*");
    expect(rule?.permanent).toBe(true);
  });

  it("redirects /api/bureau/:path* → /api/programs/:path* (JSON API)", async () => {
    const redirects = await nextConfig.redirects?.();
    const rule = redirects?.find((r) => r.source === "/api/bureau/:path*");
    expect(rule).toBeDefined();
    expect(rule?.destination).toBe("/api/programs/:path*");
    expect(rule?.permanent).toBe(true);
  });

  it("every redirect is permanent (308) — old URLs should never serve a 302", async () => {
    const redirects = await nextConfig.redirects?.();
    expect(redirects).toBeDefined();
    for (const rule of redirects ?? []) {
      if (rule.source.startsWith("/bureau") || rule.source.startsWith("/api/bureau")) {
        expect(
          rule.permanent,
          `redirect ${rule.source} must be permanent`,
        ).toBe(true);
      }
    }
  });
});
