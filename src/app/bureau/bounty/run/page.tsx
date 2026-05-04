import type { ReactNode } from "react";

import { BountyRunForm } from "./RunForm";

export const metadata = {
  title: "File a bounty — BOUNTY — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function BountyRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">File a bounty</h1>
        <p className="bureau-hero-tagline">
          Hand a Rekor UUID (DRAGNET red dot, FINGERPRINT delta, or
          MOLE verdict) to Studio. We assemble it into an{" "}
          <code>EvidencePacket/v1</code>, dispatch it to HackerOne or
          Bugcrowd via the operator's stored platform credentials, and
          anchor the resulting <code>BountySubmission/v1</code> record
          to Sigstore Rekor.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Filing parameters</h2>
        <BountyRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the file to the BOUNTY runner. Today
            this is a stub — fetch + assemble + dispatch + anchor wire
            up when <code>pluck-api /v1/bounty/file</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            scoped to the platform (e.g.{" "}
            <code>hackerone-amber-otter-3742</code>) — vendor stays in
            the receipt body.
          </li>
          <li>
            On <code>filed</code>: green dot + platform submission ID +
            Rekor entry. On <code>rate-limited</code>: amber dot +
            retry window. On terminal failure: red dot + reason.
          </li>
        </ol>
      </section>
    </>
  );
}
