import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vitest uses esbuild for the TS/TSX transform. Point it at React's
  // automatic runtime so .tsx test files don't need an explicit
  // `import React from "react"` line. The repo's tsconfig says
  // `jsx: preserve` (Next.js owns the production transform); this
  // override is scoped to the vitest harness.
  esbuild: {
    jsx: "automatic",
  },
  test: {
    // e2e/ runs under Playwright (separate harness, see e2e/dragnet-activation.spec.ts).
    // Vitest only picks up unit + integration tests under src/.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
