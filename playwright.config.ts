import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite against the real app (UI + Route Handlers + MongoDB in-memory replica set).
 * `npm run e2e` starts its own isolated server on :3100 (separate build dir, test DB, mock payments),
 * so it never touches a developer's `next dev` or any real database.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;
export const TEST_TOKEN = process.env.E2E_TEST_API_TOKEN ?? "e2e-local-token";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // shared database: tests run serially for determinism
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "test-results/results.json" }]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
    navigationTimeout: 90_000,
    actionTimeout: 20_000,
    locale: "en-US",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /responsive\.spec\.ts|navigation\.spec\.ts|checkout\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npx tsx scripts/dev-memory.ts",
    url: `${BASE_URL}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      NEXT_DIST_DIR: ".next-e2e",
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      E2E_TEST_API_TOKEN: TEST_TOKEN,
      PAYMENT_MODE: "mock",
      RATE_LIMIT_DISABLED: "true",
      JOBS_IN_PROCESS: "false",
      MONGODB_DB_NAME: "vapehub_e2e",
    },
  },
});
