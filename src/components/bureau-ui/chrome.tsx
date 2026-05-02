// ---------------------------------------------------------------------------
// Pluck Bureau UI – Studio chrome (header / nav / footer)
// ---------------------------------------------------------------------------
//
// Shared frame around every bureau page. Header carries the Pluck
// Studio wordmark + a global program nav. Footer carries the Sigstore
// + Rekor attribution that establishes the moat ("we don't make claims
// – Rekor does").
// ---------------------------------------------------------------------------

import type { BureauProgramId } from "@sizls/pluck-bureau-core";
import type { ReactNode } from "react";

export interface BureauChromeProps {
  /** Currently-active program (highlights nav entry). */
  active?: BureauProgramId | "leaderboard" | "monitors" | "home";
  /** Optional sign-in surface – caller decides what to render. */
  authSlot?: ReactNode;
  /** Page content. */
  children: ReactNode;
}

const NAV_PROGRAMS: ReadonlyArray<{ id: BureauProgramId; label: string }> = [
  { id: "dragnet", label: "DRAGNET" },
  { id: "tripwire", label: "TRIPWIRE" },
  { id: "oath", label: "OATH" },
  { id: "fingerprint", label: "FINGERPRINT" },
  { id: "nuclei", label: "NUCLEI" },
  { id: "sbom-ai", label: "SBOM-AI" },
  { id: "rotate", label: "ROTATE" },
  { id: "mole", label: "MOLE" },
  { id: "whistle", label: "WHISTLE" },
  { id: "bounty", label: "BOUNTY" },
  { id: "custody", label: "CUSTODY" },
];

export function BureauChrome({
  active,
  authSlot,
  children,
}: BureauChromeProps): ReactNode {
  return (
    <div className="bureau-chrome">
      <header className="bureau-header">
        <a className="bureau-wordmark" href="/bureau">
          <span className="bureau-wordmark-pluck">Pluck</span>{" "}
          <span className="bureau-wordmark-studio">Studio</span>{" "}
          <span className="bureau-wordmark-sub">/ Bureau</span>
        </a>
        <nav className="bureau-nav">
          <a
            href="/bureau/leaderboard"
            className={
              active === "leaderboard" ? "bureau-nav-link active" : "bureau-nav-link"
            }
          >
            Leaderboard
          </a>
          {NAV_PROGRAMS.map((p) => (
            <a
              key={p.id}
              href={`/bureau/${p.id}`}
              className={
                active === p.id ? "bureau-nav-link active" : "bureau-nav-link"
              }
            >
              {p.label}
            </a>
          ))}
        </nav>
        <div className="bureau-auth-slot">{authSlot}</div>
      </header>
      <main className="bureau-main">{children}</main>
      <footer className="bureau-footer">
        <span>
          Pluck Bureau anchors every observation to{" "}
          <a href="https://rekor.sigstore.dev" rel="noopener noreferrer">
            Sigstore Rekor
          </a>
          . Cosign-verifiable, Ed25519-signed, public-good forever.
        </span>
        <span>
          <a href="https://docs.pluck.run/studio/bureau" rel="noopener">
            Docs
          </a>
          {" · "}
          <a href="https://github.com/sizls/pluck">Source</a>
        </span>
      </footer>
    </div>
  );
}
