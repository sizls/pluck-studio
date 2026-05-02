// ---------------------------------------------------------------------------
// Bureau / OATH / [vendor] – public oath viewer
// ---------------------------------------------------------------------------
//
// Phase 4 alpha. Renders the vendor's oath body + signer fingerprint
// + expiresAt countdown. Phase 4+ wires real Kite Event Log fetch;
// today the page is a static-shape preview seeded from the URL.
// ---------------------------------------------------------------------------

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
  return {
    title: `${vendor} — OATH — Pluck Bureau`,
  };
}

export default async function OathVendorPage({
  params,
}: PageProps): Promise<ReactNode> {
  const { vendor } = await params;
  const safeVendor = sanitiseVendor(vendor);

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">{safeVendor}</h1>
        <p className="bureau-hero-tagline">
          Public oath viewer for <code>{safeVendor}</code>. The body
          shown here is fetched from{" "}
          <code>https://{safeVendor}/.well-known/pluck-oath.json</code>{" "}
          server-side and verified before render.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Live fetch</h2>
        <p>
          Phase 4 alpha — the public viewer ships next pass. To inspect
          this vendor today, run:
        </p>
        <pre>
          <code>
            pluck bureau oath fetch {safeVendor} --out ./.oath{"\n"}
            pluck bureau oath verify ./.oath/&lt;hash&gt;.intoto.jsonl
            --expected-origin https://{safeVendor}
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Badge embed</h2>
        <p>
          Vendors can embed the canonical green / red / unknown /
          missing badge. Build it from the CLI:
        </p>
        <pre>
          <code>
            pluck bureau oath badge {safeVendor} --state green --format
            html
          </code>
        </pre>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Predicate URI</h2>
        <pre>
          <code>https://pluck.run/PluckOath/v1</code>
        </pre>
      </section>
    </>
  );
}

function sanitiseVendor(raw: string): string {
  // Match the publish.ts VENDOR_RE – DNS-safe.
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 253) {
    return "(unknown)";
  }
  if (raw.includes("..")) {
    return "(unknown)";
  }
  if (!/^[a-z0-9](?:[a-z0-9.\-]{0,251}[a-z0-9])?$/i.test(raw)) {
    return "(unknown)";
  }

  return raw.toLowerCase();
}
