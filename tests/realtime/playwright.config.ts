import { defineConfig, devices } from "@playwright/test";

/**
 * Realtime multiplayer E2E: several browser contexts, one dev server, local Supabase.
 * Run: pnpm playwright test -c tests/realtime/playwright.config.ts (E2E_BASE defaults to http://localhost:3201).
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE ?? "http://localhost:3201",
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
});
