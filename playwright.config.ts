import { defineConfig, devices } from "@playwright/test";

// Supabase URL and publishable key for API-level checks (same values the app uses).
try {
  process.loadEnvFile(".env.local");
} catch {
  // CI provides the variables directly.
}

/** Set E2E_BASE_URL (e.g. the Vercel URL) to test a deployed site instead of a local build. */
const remote = process.env.E2E_BASE_URL;

/**
 * End-to-end tests (BUILD_BRIEF §10, TEST_PLAN). They run against the production build and the
 * linked Supabase project, so they create a small amount of real data per run (2 guests, 2 trips;
 * share links are turned off at the end). Run serially to keep that predictable.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: remote ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true },
    },
  ],
  webServer: remote
    ? undefined
    : {
        command: "npx next start -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
