// ---------------------------------------------------------------------------
// Bureau / DRAGNET — Per-run receipt page (Server Component shell)
// ---------------------------------------------------------------------------
//
// Renders chrome + a client-side <ReceiptView>. The view subscribes to
// the run via a Directive system; today the data is stub-populated, but
// when pluck-api ships /v1/runs + Supabase Realtime the @directive-run/query
// integration will re-populate the same facts off a Realtime channel —
// the page render code stays identical.
//
// The opengraph-image route at ./opengraph-image.tsx auto-renders the
// 1200×630 social card with the phrase ID + cycle status — every share
// of this URL in Slack / X / Discord auto-unfurls into self-marketing.
// ---------------------------------------------------------------------------

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ReceiptView } from "./ReceiptView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;

  // The phrase ID is short, memorable, brand-bearing — make it the title
  // so browser tabs, X cards, and bookmark lists all surface it directly.
  const title = `${id} · DRAGNET cycle`;
  const description =
    "Tamper-evident DRAGNET probe-pack receipt. Sigstore Rekor-anchored, offline-verifiable, permanent URL.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function DragnetReceiptPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { id } = await params;

  return <ReceiptView id={id} />;
}
