// ---------------------------------------------------------------------------
// Bureau / reputation / [vendor] – per-vendor public reputation card
// ---------------------------------------------------------------------------
//
// Innovation game-changer #2 surface. Renders the score + the
// component breakdown + the activeOaths list + a sample badge SVG.
// Phase 5 alpha – placeholder reputation seeded server-side; Phase 7+
// Kite Event Log replays the public Rekor entries to derive the
// number for real.
// ---------------------------------------------------------------------------

import {
  computeVendorReputation,
  type VendorReputation,
} from "@sizls/pluck-bureau-core";
import { ReputationBadge } from "@/components/bureau-ui";
import type { ReactNode } from "react";

interface PageProps {
  params: Promise<{ vendor: string }>;
}

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export async function generateMetadata({ params }: PageProps) {
  const { vendor } = await params;

  return { title: `${sanitiseVendor(vendor)} — Reputation — Pluck Bureau` };
}

export default async function ReputationVendorPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { vendor } = await params;
  const safeVendor = sanitiseVendor(vendor);
  // Phase 5 alpha placeholder – anchored to a fixed referenceTime so
  // the same page renders identically across machines. Phase 7+
  // replaces this with a Kite Event Log fetch + derive call.
  const reputation = computePlaceholder(safeVendor);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">{safeVendor}</h1>
        <p className="bureau-hero-tagline">
          Auto-decaying public trust score — pure projection over the
          public Rekor log. Anyone can re-derive the number using{" "}
          <code>pluck bureau reputation {safeVendor}</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Score</h2>
        <p style={{ fontSize: 48, fontWeight: 700, lineHeight: 1.1 }}>
          {reputation.score.toFixed(1)} / 100
        </p>
        <ReputationBadge
          vendor={reputation.vendor}
          {...(reputation.model !== undefined ? { model: reputation.model } : {})}
          score={reputation.score}
        />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Components — auditable math</h2>
        <p>
          The score is a sum of weighted, decaying contributions over a{" "}
          {reputation.decayWindowDays}-day window. Anyone can re-run the
          math; the formula is documented in
          <code> @sizls/pluck-bureau-core/reputation.ts </code>.
        </p>
        <table className="bureau-leaderboard">
          <thead>
            <tr>
              <th scope="col">Predicate</th>
              <th scope="col">Count</th>
              <th scope="col">Contribution</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>green dots</td>
              <td>{reputation.components.greenDots.count}</td>
              <td>{reputation.components.greenDots.contribution.toFixed(2)}</td>
            </tr>
            <tr>
              <td>red dots</td>
              <td>{reputation.components.redDots.count}</td>
              <td>{reputation.components.redDots.contribution.toFixed(2)}</td>
            </tr>
            <tr>
              <td>black dots</td>
              <td>{reputation.components.blackDots.count}</td>
              <td>{reputation.components.blackDots.contribution.toFixed(2)}</td>
            </tr>
            <tr>
              <td>oaths honored</td>
              <td>{reputation.components.oathsHonored.count}</td>
              <td>{reputation.components.oathsHonored.contribution.toFixed(2)}</td>
            </tr>
            <tr>
              <td>oaths broken</td>
              <td>{reputation.components.oathsBroken.count}</td>
              <td>{reputation.components.oathsBroken.contribution.toFixed(2)}</td>
            </tr>
            <tr>
              <td>key compromise</td>
              <td>{reputation.components.keyCompromiseEvents.count}</td>
              <td>
                {reputation.components.keyCompromiseEvents.contribution.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Active OATHs</h2>
        {reputation.activeOaths.length === 0 ? (
          <p>(none — the vendor has no active commitments anchored at this score)</p>
        ) : (
          <ul style={{ lineHeight: 1.7 }}>
            {reputation.activeOaths.map((u) => (
              <li key={u}>
                <code>{u}</code>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Embed</h2>
        <pre>
          <code>
            &lt;img src=&quot;https://studio.pluck.run/api/reputation/{safeVendor}.svg&quot; /&gt;
          </code>
        </pre>
        <p>
          Phase 7+ ships the SVG API route. Today the badge above is
          rendered inline by the same React component the API will use
          — embedders see the same shape.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI re-derive</h2>
        <pre>
          <code>
            pluck bureau reputation {safeVendor} --reference-time {reputation.computedAt}{" "}
            --decay-window {reputation.decayWindowDays}
          </code>
        </pre>
      </section>
    </>
  );
}

function sanitiseVendor(raw: string): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 64) {
    return "unknown";
  }
  if (raw.includes("..")) {
    return "unknown";
  }
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/i.test(raw)) {
    return "unknown";
  }

  return raw.toLowerCase();
}

function computePlaceholder(vendor: string): VendorReputation {
  // Phase 5 alpha – empty inputs surface as the baseline 50.0. The
  // shape is byte-identical to the production output, so the page
  // renders the right HTML even before Kite is online.
  return computeVendorReputation({
    vendor,
    dots: [],
    referenceTime: "2026-04-26T00:00:00Z",
  });
}
