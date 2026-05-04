import type { ReactNode } from "react";

import { TripwireRunForm } from "./RunForm";

export const metadata = {
  title: "Configure a tripwire — TRIPWIRE — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function TripwireRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Configure a tripwire</h1>
        <p className="bureau-hero-tagline">
          TRIPWIRE is a continuous JS-layer interceptor — there's no
          one-shot "run." Hand Studio a machine ID + policy choice
          and we issue a signed <code>TripwirePolicy/v1</code> +
          install snippet + ingestion endpoint. Receipts represent
          active deployments; rotate via{" "}
          <a href="/bureau/rotate/run">/bureau/rotate/run</a> when you
          retire a machine.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Configuration parameters</h2>
        <TripwireRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the configure to the TRIPWIRE runner.
            Today this is a stub — sign + issue endpoint + snippet
            wire up when{" "}
            <code>pluck-api /v1/tripwire/configure</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            scoped to your machine ID (e.g.{" "}
            <code>alice-mbp-amber-otter-3742</code>) so each machine's
            deployment has a permanent shareable URL.
          </li>
          <li>
            The receipt shows the install snippet you paste into your
            dev machine + the ingestion endpoint URL where attestations
            will land. Run the snippet, attestations appear in your
            per-machine timeline at{" "}
            <a href="/bureau/tripwire/me"><code>/bureau/tripwire/me</code></a>.
          </li>
        </ol>
      </section>
    </>
  );
}
