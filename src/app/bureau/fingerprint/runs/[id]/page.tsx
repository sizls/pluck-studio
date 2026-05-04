// ---------------------------------------------------------------------------
// Bureau / FINGERPRINT — Per-scan receipt page (Server Component shell)
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
  const title = `${id} · FINGERPRINT scan`;
  const description =
    "Tamper-evident FINGERPRINT model-fingerprint scan. Drift classification (stable/minor/major/swap) signed and Sigstore-Rekor-anchored.";

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function FingerprintReceiptPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { id } = await params;

  return <ReceiptView id={id} />;
}
