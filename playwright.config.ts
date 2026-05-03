// ---------------------------------------------------------------------------
// Playwright configuration — Studio's golden e2e suite
// ---------------------------------------------------------------------------
//
// Per the plan's testing strategy, e2e/dragnet-activation.spec.ts is one
// of the 5 golden tests that block release if broken. This config:
//
//   - Spins up `pnpm dev` on port 3030 if the server isn't already up
//   - Runs all tests in e2e/ against http://localhost:3030
//   - Locally: chromium-only for speed (set PW_ALL_BROWSERS=1 for full)
//   - In CI: chromium + firefox + webkit
//
// To run locally:  pnpm exec playwright install chromium && pnpm test:e2e
// In CI:           the action installs all three browsers + runs all
// ---------------------------------------------------------------------------

import { defineConfig, devices } from "@playwright/test";

const isCI = process.env.CI === "true";
const allBrowsers = isCI || process.env.PW_ALL_BROWSERS === "1";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3030";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: allBrowsers
    ? [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        { name: "firefox", use: { ...devices["Desktop Firefox"] } },
        { name: "webkit", use: { ...devices["Desktop Safari"] } },
      ]
    : [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
