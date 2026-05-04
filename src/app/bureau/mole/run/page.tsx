import type { ReactNode } from "react";

import { MoleRunForm } from "./RunForm";

export const metadata = {
  title: "Seal a canary — MOLE — Pluck Bureau",
};

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export default function MoleRunPage(): ReactNode {
  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Seal a canary</h1>
        <p className="bureau-hero-tagline">
          Hand Studio a canary URL + fingerprint phrases. We fetch
          (HTTPS-only, ≤ 256 KiB, 10s, no redirects), compute sha256,
          and sign a <code>CanaryDocument/v1</code> manifest. The
          Rekor timestamp predates any probe-run, so vendors can't
          claim "we trained on your canary AFTER the seal."
        </p>
        <p className="bureau-hero-tagline" style={{ marginTop: 12 }}>
          The canary body itself <strong>never</strong> enters the
          public log — only the sha256 + your fingerprint phrases.
        </p>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Seal parameters</h2>
        <MoleRunForm />
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>What you'll see next</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Studio dispatches the seal to the MOLE runner. Today this
            is a stub — fetch + hash + sign + anchor wire up when{" "}
            <code>pluck-api /v1/mole/seal</code> ships.
          </li>
          <li>
            You're redirected to the receipt page. The phrase ID is
            scoped to your canary ID (e.g.{" "}
            <code>nyt20240115-amber-otter-3742</code>) so the URL
            self-discloses *which* canary was sealed (never the body).
          </li>
          <li>
            On <code>sealed</code>: green dot + sha256 + fingerprint
            list + Rekor entry. The probe-run step is a separate CLI
            invocation (<code>pluck bureau mole run</code>) and lands
            in the per-target dossier.
          </li>
        </ol>
      </section>
    </>
  );
}
