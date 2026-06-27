// ---------------------------------------------------------------------------
// Root error / loading / not-found — contract tests
// ---------------------------------------------------------------------------
//
// Each boundary is a leaf React component with no fact dependency, so a
// `renderToStaticMarkup` pass exercises the full render path. We assert
// on the data-testid hooks + critical a11y attributes so the next
// refactor doesn't accidentally drop the screen-reader announcement
// (role="alert" on error, aria-busy on loading) or break the visible
// retry / back-to-programs CTAs.
// ---------------------------------------------------------------------------

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RootError from "../error.js";
import RootLoading from "../loading.js";
import RootNotFound from "../not-found.js";

describe("root error boundary", () => {
  it("renders the apology copy + retry button + digest when supplied", () => {
    const html = renderToStaticMarkup(
      <RootError
        error={Object.assign(new Error("boom"), { digest: "abc123" })}
        reset={() => {
          /* noop */
        }}
      />,
    );
    expect(html).toContain('data-testid="root-error"');
    expect(html).toContain('data-testid="root-error-retry"');
    expect(html).toContain('data-testid="root-error-digest"');
    expect(html).toContain("digest: abc123");
    expect(html).toContain("Try again");
    expect(html).toContain('href="/programs"');
  });

  it("omits the digest block when the error has none", () => {
    const html = renderToStaticMarkup(
      <RootError
        error={new Error("boom")}
        reset={() => {
          /* noop */
        }}
      />,
    );
    expect(html).not.toContain('data-testid="root-error-digest"');
  });
});

describe("root not-found", () => {
  it("renders three navigation paths back into the surface", () => {
    const html = renderToStaticMarkup(<RootNotFound />);
    expect(html).toContain('data-testid="root-not-found"');
    expect(html).toContain('href="/programs"');
    expect(html).toContain('href="/runs"');
    expect(html).toContain('href="/search"');
  });
});

describe("root loading", () => {
  it("signals a11y status + busy to assistive tech", () => {
    const html = renderToStaticMarkup(<RootLoading />);
    expect(html).toContain('data-testid="root-loading"');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('aria-live="polite"');
  });
});
