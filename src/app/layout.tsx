import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pluck Studio",
  description:
    "Pluck Studio — Sigstore-anchored public ledger for AI-vendor trust. Bureau programs (DRAGNET, NUCLEI, OATH, FINGERPRINT, MOLE, WHISTLE, BOUNTY, CUSTODY, SBOM-AI, ROTATE, TRIPWIRE) catch AI vendors when they lie.",
  metadataBase: new URL("https://studio.pluck.run"),
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
