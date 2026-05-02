// ---------------------------------------------------------------------------
// Bureau / DRAGNET / [vendor] / [model] / [dotId] – red-dot deep-dive
// ---------------------------------------------------------------------------
//
// Each TimelineDot deep-link page surfaces:
//   - The Rekor uuid + sigstore-search deep link
//   - A copy-pasteable `cosign verify-attestation` command
//   - The vendor's contradicted Disclosure/v1 claim (if any)
//
// Phase 1 alpha – populated from the URL params; live data wires in
// with the ingestion API.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

interface PageProps {
  params: Promise<{
    vendor: string;
    model: string;
    dotId: string;
  }>;
}

const REKOR_SEARCH = "https://search.sigstore.dev/?logIndex=";

export default async function DragnetDotPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { vendor, model, dotId } = await params;
  // The dotId encodes the rekor uuid for the placeholder data; live
  // data will look this up in the dossier index. We deliberately keep
  // the page renderable without a backend so the Phase 1 alpha link
  // always works.
  const rekorUuid = dotId.slice(0, 64);

  const sectionHeading = {
    fontFamily: "var(--bureau-mono)",
    fontSize: 14,
    color: "var(--bureau-fg-dim)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    marginTop: 32,
  };

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">red dot · {dotId.slice(0, 12)}…</h1>
        <p className="bureau-hero-tagline">
          {vendor}/{model} — DRAGNET observation
        </p>
      </section>

      <section>
        <h2 style={sectionHeading}>Rekor entry</h2>
        <p>
          uuid: <code>{rekorUuid}</code>
        </p>
        <p>
          <a href={`${REKOR_SEARCH}${rekorUuid}`} rel="noreferrer">
            Open in sigstore-search
          </a>
        </p>
      </section>

      <section>
        <h2 style={sectionHeading}>Verify offline</h2>
        <pre>
          <code>
            cosign verify-attestation \\{"\n"}
            {"  "}--key public-key.pem \\{"\n"}
            {"  "}--type https://pluck.run/AgentRun/v1 \\{"\n"}
            {"  "}cassettes/{rekorUuid}.intoto.jsonl
          </code>
        </pre>
      </section>

      <section>
        <h2 style={sectionHeading}>Vendor claim</h2>
        <p>
          When this red dot was a contradict-hit, the vendor&apos;s
          Disclosure/v1 claim renders here once ingestion is wired.
          Phase 1 alpha — placeholder.
        </p>
      </section>
    </>
  );
}
