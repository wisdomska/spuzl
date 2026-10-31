import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against a running app (start it yourself: `pnpm dev -p <port>` or `pnpm build && pnpm start`).
 * PW_BASE_URL picks the server; projects match `pnpm test:e2e` (mobile 390 × 844 and desktop 1280, dark).
 */
const baseURL = process.env.PW_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests",
  testMatch: "**/*.spec.ts",
  testIgnore: process.env.PERF ? [] : ["tests/perf/**"],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }], ["list"]] : "list",
  use: { baseURL, trace: "retain-on-failure", colorScheme: "dark" },
  projects: [
    { name: "mobile-dark", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, colorScheme: "dark" } },
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
    { name: "mobile-light", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, colorScheme: "light" } },
    // QA harness projects (tests/e2e/harness.ts): the audit's two viewports and the perf baseline.
    { name: "phone-375", use: { ...devices["Pixel 7"], viewport: { width: 375, height: 812 }, colorScheme: "dark" } },
    { name: "desktop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "dark" } },
    { name: "perf", testDir: "tests/perf", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
  ],
});
