import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/ runs under Playwright (separate harness, see e2e/dragnet-activation.spec.ts).
    // Vitest only picks up unit + integration tests under src/.
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
