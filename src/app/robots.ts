// ---------------------------------------------------------------------------
// robots.txt — crawler policy
// ---------------------------------------------------------------------------
//
// Next.js App Router convention: this file becomes /robots.txt at
// build time. Allows the public surfaces (Bureau pages, /runs,
// /vendor, /monitors, /what-we-dont-know, /privacy) and disallows
// the API surface + the auth flow.
// ---------------------------------------------------------------------------

import type { MetadataRoute } from "next";

const BASE_URL = "https://studio.pluck.run";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/sign-in"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
