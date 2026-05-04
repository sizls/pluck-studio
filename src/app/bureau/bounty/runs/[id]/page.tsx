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
  const title = `${id} · BOUNTY filing`;
  const description =
    "Tamper-evident BOUNTY filing — EvidencePacket dispatched, BountySubmission anchored to Sigstore Rekor.";

  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BountyReceiptPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { id } = await params;
  return <ReceiptView id={id} />;
}
