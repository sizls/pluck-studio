// ---------------------------------------------------------------------------
// /watch/[id] — Watch detail page (receipt URL)
// ---------------------------------------------------------------------------

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { redactWatchForGet } from "../../../lib/v1/redact";
import {
  getWatch,
  listObservations,
} from "../../../lib/watch/store";
import { WatchDetailView } from "./WatchDetailView";

// Every observation/state push happens outside the request cycle; serve
// fresh on every navigation rather than the Next-default RSC snapshot.
export const dynamic = "force-dynamic";
// Watch store uses node:crypto; lock the runtime so a future config flip
// to edge can't silently break this page.
export const runtime = "nodejs";

interface PageProps {
  readonly params: Promise<{ id: string }>;
}

export async function generateMetadata(
  { params }: PageProps,
): Promise<{ title: string; description?: string }> {
  const { id } = await params;
  const watch = getWatch(id);
  if (watch === null) {
    return { title: "Watch not found — Pluck Studio" };
  }

  return {
    title: `${watch.name} — Watch · Pluck Studio`,
    description: watch.intent.slice(0, 160),
  };
}

export default async function WatchDetailPage(
  { params }: PageProps,
): Promise<ReactNode> {
  const { id } = await params;
  const watch = getWatch(id);
  if (watch === null) {
    notFound();
  }
  const { observations, totalCount } = listObservations(id, 50);

  // The watch detail page is a public-by-phraseId receipt surface. Serve
  // the redacted view so the initial SSR state matches what the SSE route
  // sends on every transition (operator address lists never appear on the
  // wire). The owner can still see / edit their channels via PATCH which
  // is auth-gated and returns the same redacted shape.
  return (
    <WatchDetailView
      watch={redactWatchForGet(watch)}
      initialObservations={observations}
      observationCount={totalCount}
    />
  );
}
