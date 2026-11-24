import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Tests start with a stored "reject optional cookies" choice so the banner doesn't cover the page;
  // consent.spec.ts uses a fresh context to test the banner itself.
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry", storageState: "tests/e2e/helpers/consent-state.json" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /admin\.spec/ },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] }, testIgnore: /admin\.spec/ },
    // Admin flows are stateful (one fresh database per run) → single serial project.
    // Runs after the public projects: it publishes content into the shared E2E database.
    { name: "admin", use: { ...devices["Desktop Chrome"] }, testMatch: /admin\.spec/, fullyParallel: false, timeout: 90_000, dependencies: ["chromium", "mobile-chrome"] },
  ],
  webServer: [
    {
      // Disposable MongoDB + Redis + API (see infrastructure/scripts/e2e-backend.sh)
      command: "bash ../infrastructure/scripts/e2e-backend.sh",
      url: "http://localhost:4000/api/v1/health",
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      // Each run gets a fresh database, so also drop ISR/data cache written by previous runs
      // (build-time seeds in .next/server/app are immutable and kept).
      command: `node scripts/clean-next-cache.mjs && next start --port ${PORT}`,
      port: PORT,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { REVALIDATE_SECRET: "e2e-revalidate-secret-0123456789abcdefghij", API_INTERNAL_URL: "http://localhost:4000/api/v1" },
    },
  ],
});
