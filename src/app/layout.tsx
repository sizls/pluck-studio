import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pluck Studio",
  description:
    "Pluck Studio — Sigstore-anchored public ledger for AI-vendor trust. Pluck programs (DRAGNET, NUCLEI, OATH, FINGERPRINT, MOLE, WHISTLE, BOUNTY, CUSTODY, SBOM-AI, ROTATE, TRIPWIRE) catch AI vendors when they lie.",
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
        {/* Skip-link target. Keyboard users tab to the link first, press
            Enter, and land at the main region. The link is rendered
            inside `StudioChrome`'s shell so it appears in tab order
            before the nav; this anchor element lives at the document
            root so it's a stable focus target regardless of which
            section's `layout.tsx` wraps the page below. */}
        <a href="#studio-main" className="studio-skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
