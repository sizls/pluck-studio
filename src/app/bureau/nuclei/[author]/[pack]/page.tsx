// ---------------------------------------------------------------------------
// Bureau / NUCLEI – per-pack page
// ---------------------------------------------------------------------------
//
// Phase 3 alpha. Static placeholder until Kite Event Log wires; renders
// the metadata schema + the canonical subscribe command for the
// requested author/pack.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

export const metadata = {
  title: "NUCLEI Pack — Pluck Bureau",
};

interface Params {
  author: string;
  pack: string;
}

interface PageProps {
  params: Promise<Params>;
}

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default async function NucleiPackPage({ params }: PageProps): Promise<ReactNode> {
  const { author, pack } = await params;

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">{pack}</h1>
        <p className="bureau-hero-tagline">
          Signed probe-pack from author{" "}
          <code style={{ overflowWrap: "anywhere" }}>{author}</code>.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Metadata</h2>
        <p>
          Phase 3 alpha — registry hydration lands once Kite Event Log
          wires. Ingest a NUCLEI Rekor uuid via{" "}
          <code>pluck bureau nuclei lookup &lt;author&gt;/{pack} --seed &lt;uuid&gt;</code>{" "}
          to inspect locally.
        </p>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>License</strong> — required SPDX identifier; resolved at
            verify time
          </li>
          <li>
            <strong>Vendor scope</strong> — list of <code>vendor/model</code> targets
            DRAGNET subscribers expand into runner configs
          </li>
          <li>
            <strong>Recommended interval</strong> — operator hint (ms);
            subscribers may override
          </li>
          <li>
            <strong>SBOM-AI provenance</strong> — required cross-reference;
            without it the pack is TOFU and verifiers MUST refuse
          </li>
        </ul>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Subscribe</h2>
        <pre>
          <code>
            {`pluck bureau nuclei subscribe \\
  --author ${author} \\
  --tag <tag> \\
  --vendor <vendor> \\
  --seed <rekor-uuid> \\
  --output ./.nuclei`}
          </code>
        </pre>
        <p>
          The runner emits one DragnetTarget tuple per scoped (vendor,
          model) — thread the JSON into a long-running{" "}
          <code>pluck bureau dragnet run</code> daemon.
        </p>
      </section>
    </>
  );
}
