// ---------------------------------------------------------------------------
// Bureau / DRAGNET — Per-run receipt page (Server Component shell)
// ---------------------------------------------------------------------------
//
// Renders chrome + a client-side <ReceiptView>. The view subscribes to
// the run via a Directive system; today the data is stub-populated, but
// when pluck-api ships /v1/runs + Supabase Realtime the @directive-run/query
// integration will re-populate the same facts off a Realtime channel —
// the page render code stays identical.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

import { ReceiptView } from "./ReceiptView";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;

  return {
    title: `Run ${id} — DRAGNET`,
  };
}

export default async function DragnetReceiptPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { id } = await params;

  return <ReceiptView id={id} />;
}
