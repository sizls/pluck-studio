// ---------------------------------------------------------------------------
// Bureau / OATH — Per-verify receipt page (Server Component shell)
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
  const title = `${id} · OATH verification`;
  const description =
    "Tamper-evident OATH verification receipt. DSSE-signed, Sigstore Rekor-anchored, offline-verifiable.";

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function OathReceiptPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { id } = await params;

  return <ReceiptView id={id} />;
}
