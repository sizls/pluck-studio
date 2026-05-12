// ---------------------------------------------------------------------------
// /watch/[id] — Watch detail page (receipt URL)
// ---------------------------------------------------------------------------

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  getWatch,
  listObservations,
} from "../../../lib/watch/store";
import { WatchDetailView } from "./WatchDetailView";

// Every observation/state push happens outside the request cycle; serve
// fresh on every navigation rather than the Next-default RSC snapshot.
export const dynamic = "force-dynamic";

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

  return (
    <WatchDetailView
      watch={watch}
      initialObservations={observations}
      observationCount={totalCount}
    />
  );
}
