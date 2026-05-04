// ---------------------------------------------------------------------------
// /privacy — public privacy posture statement
// ---------------------------------------------------------------------------
//
// Required disclosure for the v1 alpha: DRAGNET phrase IDs publicly
// disclose probe targets via the URL slug (e.g. `openai-swift-falcon-3742`
// names the vendor in the URL itself). Operators must understand this
// trade-off before submitting.
//
// This is a posture page, not a full legal document. The full ToS / DPA /
// AUP land with the public alpha. Until then, this page is the primary
// link target from the auth-ack flow + receipt page footers.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "Privacy posture — Pluck Studio",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function PrivacyPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Privacy posture</h1>
        <p className="bureau-hero-tagline">
          Public-by-default for the artifact, private-by-default for the
          operator. Read this before submitting your first DRAGNET cycle.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What's public</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>The receipt URL</strong> — bookmarkable, shareable,
            permanent. The phrase ID (`openai-swift-falcon-3742`)
            self-discloses the probed target via the URL slug. Anyone
            who has the link can see the cycle outcome.
          </li>
          <li>
            <strong>The Sigstore Rekor anchor</strong> — every signed
            receipt is appended to the public transparency log. Once
            anchored it is permanent and cannot be retracted.
          </li>
          <li>
            <strong>The classification verdict</strong> — contradict /
            mirror / shadow / snare counts, target hostname, probe-pack
            ID + version, signing-key fingerprint.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What we refuse to know</h2>
        <p>
          The phrase-ID schema is the proof — if Studio knew it, it
          would be in the URL. For the per-program list of what Studio
          explicitly does not see / store / log about your operation,
          read{" "}
          <a
            href="/what-we-dont-know"
            title="Per-program negative-knowledge disclosure"
          >
            /what-we-dont-know
          </a>
          .
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What's private</h2>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>Operator identity</strong> is bound to a Pluck
            account but is not embedded in the receipt or in Rekor. We
            retain the binding internally for billing + abuse response.
          </li>
          <li>
            <strong>Probe-pack source</strong> (the probe payloads
            themselves) is signed but not anchored verbatim — only the
            content hash + signature. Pack secrets stay with the
            operator.
          </li>
          <li>
            <strong>Operator-authored YAML</strong> for recipes / feeds
            (when those land) defaults to private; you choose to
            publish.
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Subpoena posture</h2>
        <p>
          We may be compelled to disclose the operator-account →
          phrase-id mapping under valid legal process. The mapping
          exists for billing + abuse response and isn't otherwise
          published. Operators concerned about this binding should run
          Pluck self-hosted (the OSS path; CLI + API server live in the
          sibling repos) and sign with their own operator key — Pluck
          never sees the mapping in that case.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Authorization to probe</h2>
        <p>
          The activation form requires you to acknowledge that you are
          authorized to probe the target. Today this is a single
          checkbox; we plan to expand this into a tiered acknowledgement
          (pre-existing-ToS / public-claims-page / fair-use-research)
          tracking the legal basis per cycle. Until then, do not probe
          targets you do not have authority to probe.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Right to erasure</h2>
        <p>
          We can delete a receipt's appearance from <code>studio.pluck.run</code>{" "}
          on request. We <em>cannot</em> delete it from Sigstore Rekor —
          the public transparency log is append-only by design. If
          you've made a mistake, contact{" "}
          <a href="mailto:privacy@pluck.run">privacy@pluck.run</a> and
          we'll mute the convenience layer immediately.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>This page is not the full policy</h2>
        <p>
          A full Terms of Service, Data Processing Agreement, and
          Acceptable Use Policy land with the public alpha. This page
          is the v0 disclosure and will be linked from every receipt
          and every form footer.
        </p>
      </section>
    </>
  );
}
