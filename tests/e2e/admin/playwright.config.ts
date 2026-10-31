import { defineConfig, devices } from "@playwright/test";

/**
 * Admin console E2E: `pnpm playwright test -c tests/e2e/admin/playwright.config.ts`.
 * Needs local Supabase and a dev server (ADMIN_BASE, default http://localhost:3203). Desktop first, tablet too.
 */
export default defineConfig({
  testDir: ".",
  testMatch: /.*\.spec\.ts/,
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.ADMIN_BASE ?? "http://localhost:3203",
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "tablet-light",
      use: { ...devices["Desktop Chrome"], viewport: { width: 834, height: 1112 }, colorScheme: "light" },
      grep: /@tablet/,
    },
  ],
});
