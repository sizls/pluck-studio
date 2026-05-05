// ---------------------------------------------------------------------------
// sitemap.xml — discovery surface for crawlers
// ---------------------------------------------------------------------------
//
// Next.js App Router convention: this file becomes /sitemap.xml at
// build time. Pulls program slugs from the activation registry and
// vendor slugs from the curated allowlist so the sitemap stays in
// sync with the source of truth — adding a program or vendor adds it
// to the sitemap with no extra maintenance.
// ---------------------------------------------------------------------------

import type { MetadataRoute } from "next";

import { ACTIVE_PROGRAMS } from "../lib/programs/registry";
import { listVendorSlugs } from "../lib/programs/vendor-registry";

const BASE_URL = "https://studio.pluck.run";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1.0 },
    { url: `${BASE_URL}/bureau`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${BASE_URL}/bureau/leaderboard`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: `${BASE_URL}/runs`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${BASE_URL}/today`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    { url: `${BASE_URL}/vendor`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    {
      url: `${BASE_URL}/monitors`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/what-we-dont-know`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];

  const programPages: MetadataRoute.Sitemap = ACTIVE_PROGRAMS.map((program) => ({
    url: `${BASE_URL}${program.landingPath}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const vendorPages: MetadataRoute.Sitemap = listVendorSlugs().map((slug) => ({
    url: `${BASE_URL}/vendor/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...programPages, ...vendorPages];
}
