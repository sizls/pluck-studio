// ---------------------------------------------------------------------------
// /vendor/[slug]/feed.xml — placeholder for the Subscription Feed game-changer
// ---------------------------------------------------------------------------
//
// The Vendor Honesty Index ships now; the per-vendor RSS feed is the
// next game-changer in the roadmap. We surface the link in the vendor
// profile page so the URL is bookmarkable on day one — but until the
// feed-emitter lands, requests return a 404 so RSS readers don't poll
// an empty feed indefinitely.
// ---------------------------------------------------------------------------
//
// When the Subscription Feed program ships, replace this handler with
// the live emitter — same path, same content-type, no consumer churn.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export function GET(): NextResponse {
  return new NextResponse("vendor RSS feed not yet implemented", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
