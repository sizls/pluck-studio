// ---------------------------------------------------------------------------
// Bureau / AVAP – program landing page
// ---------------------------------------------------------------------------
//
// Phase 10 alpha. AVAP is the H1-killer composite Bureau program.
// Composes DRAGNET + FINGERPRINT + MOLE + BOUNTY + NUCLEI + OATH into
// time-locked, threshold-witnessed disclosure auctions.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "AVAP — Pluck Bureau",
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

export default function AvapIndexPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">AVAP</h1>
        <p className="bureau-hero-tagline">
          AI Vulnerability Auction Protocol. Vendors stake to{" "}
          <strong>delay</strong> disclosure. Civil society stakes to{" "}
          <strong>release</strong> it. A neutral threshold quorum decides when
          the seal breaks. Pluck records the math, never holds custody.
        </p>
      </section>

      <section style={CalloutStyle}>
        <h2 style={{ ...SectionHeadingStyle, marginTop: 0 }}>
          The HackerOne-killer
        </h2>
        <p>
          HackerOne and Bugcrowd are 1:1 channels: a researcher reports, the
          vendor decides whether to pay, and the public sees only what the
          vendor allows. <strong>AVAP is N:N.</strong> The market — not the
          vendor — sets the disclosure clock. A vendor that wants to extend
          the window must <em>pay</em> for it on a public ledger that anyone
          can see.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What AVAP composes</h2>
        <p>
          AVAP doesn't invent new primitives. It composes the cryptographic
          verbs already shipping across the Bureau:
        </p>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>NUCLEI</strong> — the signed probe-pack that proves a
            vulnerability exists
          </li>
          <li>
            <strong>DRAGNET</strong> — runs the probe-pack against the target
            until red dot
          </li>
          <li>
            <strong>FINGERPRINT</strong> — proves <em>which</em> model the dot
            fired against
          </li>
          <li>
            <strong>MOLE</strong> (optional) — adversarial training-data
            extraction proof
          </li>
          <li>
            <strong>BOUNTY</strong> — after unseal, dispatches to HackerOne /
            Bugcrowd
          </li>
          <li>
            <strong>OATH</strong> — vendor's signed Disclosure/v1 is the
            contradiction target; silent fix triggers a red dot
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What lands on Rekor</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <code>AVAP/v1</code> — the auction-open envelope. References the
            NUCLEI probe-pack, FINGERPRINT scan, and optional MOLE PoC by
            Rekor uuid. Threshold-party slate + closesAt + disclosureDeadline
            time-locks.
          </li>
          <li>
            <code>AVAP.Bid/v1</code> — single signed bid against an open
            auction. <code>direction: &quot;delay&quot;</code> (vendors stake
            to extend) or <code>direction: &quot;immediate&quot;</code> (civil
            society stakes to release). Amounts are{" "}
            <strong>informational only</strong>; payouts settle off-platform.
          </li>
          <li>
            <code>AVAP.Unseal/v1</code> — the threshold-share unseal envelope.
            <code> k</code>-of-<code>n</code> parties contribute Ed25519
            signatures over the canonical{" "}
            <code>{`{auctionId, outcome, unsealedAt}`}</code> triple; verifier
            requires <code>k</code> distinct fingerprints from the auction's
            party slate. <code>t-1</code> shares cannot unblind.
          </li>
          <li>
            <code>AVAP.Distribution/v1</code> — the payout ledger. Default
            split: researcher 70%, treasury 20%, civil society 10%.
            <code> vendor-buyout</code> outcome flips to 80/15/5. Sum-of-shares
            ≤ 1; off-platform payment receipts attached as opaque strings.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Threshold semantics</h2>
        <p>
          AVAP's threshold is <strong>simpler than VSS</strong>. Every party
          publishes a public share at auction-open; unseal requires k parties
          to each publish a signed share over the canonical auction body. The
          shares are not used to derive a secret — they are used as a{" "}
          <em>verifiable quorum vote</em> that controls the time-lock. A{" "}
          <code>t-1</code> collusion cannot unblind because the quorum check
          fails-closed.
        </p>
        <p>
          This is documented as{" "}
          <strong>quorum-vote-controlled time-lock</strong> rather than full
          Verifiable Secret Sharing. The cryptographic guarantee:
        </p>
        <blockquote
          style={{
            borderLeft: "3px solid var(--bureau-fg-dim)",
            paddingLeft: 16,
            margin: "16px 0",
            fontStyle: "italic",
          }}
        >
          Without k distinct fingerprints in the unseal envelope, the verifier
          rejects the unseal. The auction body remains sealed from the
          verifier's perspective.
        </blockquote>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Trust posture — Pluck records, never holds custody</h2>
        <p>
          AVAP is a <strong>ledger</strong>, not a court. The auction protocol
          records:
        </p>
        <ol style={{ lineHeight: 1.7 }}>
          <li>that the parties agreed the auction was open at time T</li>
          <li>that a quorum of k parties unsealed it at time T'</li>
          <li>that the parties published a payout distribution at time T''</li>
        </ol>
        <p>
          Adjudication, dispute resolution, and actual money movement are{" "}
          <strong>always off-platform</strong>. Auction parties retain full
          agency over their fingerprints, their bids, and their payouts.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>CLI</h2>
        <pre>
          <code>
            {`# 1. open
pluck bureau avap open \\
  --target openai/gpt-4o \\
  --nuclei-pack <rekor-uuid> --fingerprint <rekor-uuid> --mole <rekor-uuid> \\
  --parties parties.json \\
  --threshold 2-of-3 \\
  --closes-at 2026-05-01T00:00:00Z \\
  --disclosure-deadline 2026-05-15T00:00:00Z \\
  --keys ./keys --accept-public

# 2. bid
pluck bureau avap bid <auction-id> \\
  --direction delay --amount 50000 --currency USD \\
  --keys ./keys --accept-public

# 3. status
pluck bureau avap status <auction-rekor-uuid> --auction auction.json --bids bids.json

# 4. unseal (after closesAt)
pluck bureau avap unseal <auction-id> --shares shares.json \\
  --outcome fix-shipped --threshold 2-of-3 \\
  --keys ./keys --accept-public

# 5. distribute
pluck bureau avap distribute <auction-id> \\
  --escrow escrow.json --recipients recipients.json \\
  --keys ./keys --accept-public`}
          </code>
        </pre>
      </section>
    </>
  );
}
