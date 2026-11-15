import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pluck Studio (archived)",
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
      <body>
        <aside className="archive-notice" aria-label="Archive notice">
          <strong>Archived.</strong> Pluck Studio and its eleven Bureau
          programs are frozen at version 1.0.34 and are no longer developed.
          This site is kept as a historical record.{" "}
          <a href="https://docs.pluck.run/docs/product/frozen-programs/">
            What frozen means
          </a>
          {" · "}
          <a href="https://docs.pluck.run/">Current Pluck work</a>
        </aside>
        {children}
      </body>
    </html>
  );
}
