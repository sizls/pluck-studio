// ---------------------------------------------------------------------------
// Pluck UI – Studio chrome (header / nav / footer)
// ---------------------------------------------------------------------------
//
// Shared frame around every public Studio surface (program pages
// AND the cross-cutting surfaces: /runs, /vendor, /monitors,
// /what-we-dont-know, /privacy). Header carries the wordmark, a
// top-level cross-cutting nav, and a Programs disclosure that hides
// the 11 program links behind a single tap target on mobile. Footer
// is a 4-column cross-link surface that exposes every public
// destination so no page is more than one click from any other.
// ---------------------------------------------------------------------------

import type { BureauProgramId } from "@sizls/pluck-bureau-core";
import type { ReactNode } from "react";

/**
 * Cross-cutting surfaces — top-level nav entries that aren't tied to a
 * single program. Keep this list lean: every entry costs a slot
 * in the header at desktop and a row at mobile.
 */
export type CrossCuttingSurface =
  | "runs"
  | "vendor"
  | "monitors"
  | "watch"
  | "what-we-dont-know"
  | "privacy";

export type StudioChromeActive =
  | BureauProgramId
  | "leaderboard"
  | "home"
  | CrossCuttingSurface;

export interface StudioChromeProps {
  /** Currently-active surface (highlights the matching nav entry). */
  active?: StudioChromeActive;
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

const CROSS_CUTTING_LINKS: ReadonlyArray<{
  id: CrossCuttingSurface;
  label: string;
  href: string;
}> = [
  { id: "runs", label: "Runs", href: "/runs" },
  { id: "vendor", label: "Vendors", href: "/vendor" },
  { id: "watch", label: "Watch", href: "/watch" },
  { id: "monitors", label: "Monitors", href: "/monitors" },
  {
    id: "what-we-dont-know",
    label: "What we don't know",
    href: "/what-we-dont-know",
  },
  { id: "privacy", label: "Privacy", href: "/privacy" },
];

function navClass(isActive: boolean): string {
  return isActive ? "bureau-nav-link active" : "bureau-nav-link";
}

export function StudioChrome({
  active,
  authSlot,
  children,
}: StudioChromeProps): ReactNode {
  const programIsActive = NAV_PROGRAMS.some((p) => p.id === active);

  return (
    <div className="bureau-chrome">
      <header className="bureau-header">
        <a className="bureau-wordmark" href="/programs">
          <span className="bureau-wordmark-pluck">Pluck</span>{" "}
          <span className="bureau-wordmark-studio">Studio</span>{" "}
          <span className="bureau-wordmark-sub">/ Pluck</span>
        </a>
        <nav className="bureau-nav" aria-label="Primary">
          <a
            href="/programs/leaderboard"
            className={navClass(active === "leaderboard")}
          >
            Leaderboard
          </a>
          {CROSS_CUTTING_LINKS.map((link) => (
            <a
              key={link.id}
              href={link.href}
              className={navClass(active === link.id)}
            >
              {link.label}
            </a>
          ))}
          <details
            className={
              programIsActive
                ? "bureau-nav-programs active"
                : "bureau-nav-programs"
            }
          >
            <summary className="bureau-nav-programs-summary">
              Programs ▾
            </summary>
            <div className="bureau-nav-programs-list">
              {NAV_PROGRAMS.map((p) => (
                <a
                  key={p.id}
                  href={`/programs/${p.id}`}
                  className={navClass(active === p.id)}
                >
                  {p.label}
                </a>
              ))}
            </div>
          </details>
        </nav>
        <div className="bureau-auth-slot">{authSlot}</div>
      </header>
      <main className="bureau-main">{children}</main>
      <footer className="bureau-footer">
        <div className="bureau-footer-grid">
          <div className="bureau-footer-col">
            <h3 className="bureau-footer-heading">Pluck</h3>
            <ul className="bureau-footer-list">
              <li>
                <a href="/programs">Programs</a>
              </li>
              <li>
                <a href="/programs/leaderboard">Leaderboard</a>
              </li>
            </ul>
          </div>
          <div className="bureau-footer-col">
            <h3 className="bureau-footer-heading">Studio</h3>
            <ul className="bureau-footer-list">
              <li>
                <a href="/runs">Runs</a>
              </li>
              <li>
                <a href="/vendor">Vendors</a>
              </li>
              <li>
                <a href="/watch">Watch</a>
              </li>
              <li>
                <a href="/monitors">Monitors</a>
              </li>
            </ul>
          </div>
          <div className="bureau-footer-col">
            <h3 className="bureau-footer-heading">About</h3>
            <ul className="bureau-footer-list">
              <li>
                <a href="/privacy">Privacy</a>
              </li>
              <li>
                <a href="/what-we-dont-know">What we don't know</a>
              </li>
              <li>
                <a href="/sign-in">Sign-in</a>
              </li>
            </ul>
          </div>
          <div className="bureau-footer-col">
            <h3 className="bureau-footer-heading">External</h3>
            <ul className="bureau-footer-list">
              <li>
                <a href="https://rekor.sigstore.dev" rel="noopener noreferrer">
                  Sigstore Rekor
                </a>
              </li>
              <li>
                <a href="https://docs.pluck.run/studio/programs" rel="noopener">
                  Docs
                </a>
              </li>
              <li>
                <a href="https://github.com/sizls/pluck">GitHub</a>
              </li>
            </ul>
          </div>
        </div>
        <p className="bureau-footer-attribution">
          Pluck anchors every observation to{" "}
          <a href="https://rekor.sigstore.dev" rel="noopener noreferrer">
            Sigstore Rekor
          </a>
          . Cosign-verifiable, Ed25519-signed, public-good forever.
        </p>
      </footer>
    </div>
  );
}
