// ---------------------------------------------------------------------------
// /sign-in — placeholder route until Supabase auth UI lands
// ---------------------------------------------------------------------------
//
// The DRAGNET activation flow links here on 401. Until the real Supabase
// auth UI ships (with magic-link / OAuth / email+password flows), this
// page tells the operator how to sign in via the CLI / web shell. Logged
// to plan as a v1 follow-on; the link target needed to exist on day-1
// so the auth-fail flow doesn't dead-end.
// ---------------------------------------------------------------------------

import type { ReactNode } from "react";

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

const SectionHeadingStyle = {
  fontFamily: "var(--bureau-mono)",
  fontSize: 14,
  color: "var(--bureau-fg-dim)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  marginTop: 32,
};

export const metadata = {
  title: "Sign in — Pluck Studio",
};

export default async function SignInPage({
  searchParams,
}: PageProps): Promise<ReactNode> {
  const { redirect } = await searchParams;

  // The redirect target is rendered into a link below — sanitize:
  // accept only relative paths, no protocol-relative URLs.
  const safeRedirect =
    typeof redirect === "string" &&
    redirect.startsWith("/") &&
    !redirect.startsWith("//")
      ? redirect
      : "/";

  return (
    <>
      <section className="bureau-hero">
        <h1 className="bureau-hero-title">Sign in</h1>
        <p className="bureau-hero-tagline">
          Pluck Studio sign-in is part of the v1 alpha rollout. Until the
          managed sign-in UI lands, request an invite or sign in via the
          Pluck CLI to issue the same Supabase session cookie Studio
          expects.
        </p>
      </section>

      <section data-testid="signin-cli-instructions">
        <h2 style={SectionHeadingStyle}>For now</h2>
        <ol style={{ lineHeight: 1.7 }}>
          <li>
            Email <a href="mailto:hello@pluck.run">hello@pluck.run</a> for
            an invite, OR
          </li>
          <li>
            Run <code>pluck auth login</code> in the Pluck CLI (uses the
            same Supabase project) and the resulting session cookie will
            apply to <code>studio.pluck.run</code> automatically.
          </li>
          <li>
            Once signed in, return to{" "}
            <a href={safeRedirect} data-testid="signin-back-link">
              <code>{safeRedirect}</code>
            </a>{" "}
            and try again.
          </li>
        </ol>
      </section>

      <section>
        <h2 style={SectionHeadingStyle}>Why this stub exists</h2>
        <p>
          The activation flow ships before the managed sign-in UI by
          design — we're testing whether operators can navigate the form
          → receipt loop end-to-end before investing in a polished auth
          experience. The first 25 alpha users will be invited directly;
          the polished UI lands when validated demand crosses the
          activation gate.
        </p>
      </section>
    </>
  );
}
