// ---------------------------------------------------------------------------
// Bureau / BOUNTY / inbox – per-dev bug-bounty inbox
// ---------------------------------------------------------------------------
//
// Innovation game-changer #1. Phase 5 alpha – placeholder. The CLI
// is the source of truth today; Phase 7+ Kite Event Log fetches the
// dossier index server-side and renders live entries here.
// ---------------------------------------------------------------------------

import {
  DEFAULT_BOUNTY_DIRECTORY,
  type BountyProgramDirectoryEntry,
} from "@sizls/pluck-bureau-bounty";
import type { ReactNode } from "react";

export const metadata = {
  title: "Inbox — BOUNTY — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

const CalloutStyle = {
  border: "1px solid var(--bureau-fg-dim)",
  background: "rgba(0, 255, 0, 0.04)",
  padding: 16,
  borderRadius: 4,
  margin: "16px 0",
};

export default function BountyInboxPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">BOUNTY / Inbox</h1>
        <p className="bureau-hero-tagline">
          Per-dev bug-bounty inbox. TRIPWIRE keeps watching the dev's
          normal LLM traffic. When a captured event red-dots against an
          OATH commitment for a vendor that runs a HackerOne or Bugcrowd
          program, the inbox surfaces it. Click → BOUNTY auto-files via
          the existing adapter. Side income for being a careful AI
          engineer.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          Pure read-side composition — no new signed predicates
        </h2>
        <p>
          The inbox is a projection over your local TRIPWIRE / DRAGNET
          dossier. Nothing new is written; nothing leaves your machine
          until you choose to file. The seed program directory ships
          with the bounty package and can be overridden with
          <code> --directory &lt;programs.json&gt;</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            pluck bureau bounty inbox ./.tripwire{"\n"}
            pluck bureau bounty inbox ./.tripwire --since 7{"\n"}
            pluck bureau bounty inbox ./.tripwire --directory ./programs.json{"\n"}
            pluck bureau bounty inbox ./.tripwire --json
          </code>
        </pre>
        <p>
          The output lists every bountyable red dot in the lookback
          window with the resolved program, payout estimate, and the
          one-line file command you'd run next.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Default seed directory</h2>
        <table className="bureau-leaderboard">
          <thead>
            <tr>
              <th scope="col">Vendor</th>
              <th scope="col">Platform / Handle</th>
              <th scope="col">Estimated payout</th>
            </tr>
          </thead>
          <tbody>
            {DEFAULT_BOUNTY_DIRECTORY.entries.map(
              (entry: BountyProgramDirectoryEntry) => (
                <tr key={entry.vendor}>
                  <td>
                    <code>{entry.vendor}</code>
                  </td>
                  <td>
                    {entry.platform} / <code>{entry.programHandle}</code>
                  </td>
                  <td>
                    {entry.estimatedPayout
                      ? `$${entry.estimatedPayout.min}-${entry.estimatedPayout.max} ${entry.estimatedPayout.currency}`
                      : "(payout not published)"}
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>How the routing works</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            TRIPWIRE captures the LLM call and writes a dot into{" "}
            <code>me-dossier.json</code>.
          </li>
          <li>
            If the call contradicted an active OATH commitment, the dot is
            tagged <code>red</code>.
          </li>
          <li>
            <code>pluck bureau bounty inbox</code> walks the dossier and
            keeps every red dot whose vendor is on the directory.
          </li>
          <li>
            <code>pluck bureau bounty file &lt;rekor-uuid&gt;</code> wraps
            the dot into an EvidencePacket and dispatches via the
            existing H1 / Bugcrowd adapter.
          </li>
        </ol>
      </section>
    </>
  );
}
