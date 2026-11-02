import { expect, test } from "@playwright/test";
import { GAME_COUNT } from "@/lib/catalog";
import { pickBirth } from "./harness";

/** SPZ-15 + SPZ-05: plain start choices, lesson flows into "Make Spuz yours", CTA names the destination, lesson counts today. */
test("onboarding: lesson, merged celebration, named CTA, counted on Home", async ({ page }, info) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Play as guest" }).click();
  await pickBirth(page, "18+");
  await expect(page.getByRole("button", { name: `Browse all ${GAME_COUNT} games`, exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: /Go to the map/ })).toBeVisible();
  await page.getByRole("button", { name: /Learn a game in 30 seconds/ }).click();
  for (const [r, c] of [
    [0, 1],
    [1, 3],
    [2, 0],
    [3, 2],
  ]) {
    const cell = page.locator(`[data-i="${r * 4 + c}"]`);
    await cell.click();
    await cell.click();
  }
  await expect(page.getByText("First clear!")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Now make Spuz yours" })).toBeVisible();
  await page.screenshot({ path: `docs/qa/screens/after/onboarding-clear-${info.project.name}.png` });
  await page.locator("#nick").fill(`Ob${Date.now() % 1e7}`);
  await page.getByRole("button", { name: "Save my Spuz and open the map" }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await expect(page.getByRole("link", { name: /(Today's Dailies|Games tried): 1 of \d+/ })).toBeVisible();
  await expect(page.getByText(/streak is sleepy/)).toHaveCount(0);
});

/** Age up front: under 13 is turned away before anything is saved; the step says why and that it is locked. */
test("onboarding: birth month and year first, under 13 keeps nothing", async ({ page }) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Play as guest" }).click();
  await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
  await expect(page.getByText(/can't change this later/)).toBeVisible();
  // Month and year only: no day picker.
  await expect(page.getByLabel("Day")).toHaveCount(0);
  for (const name of ["Month", "Year"]) {
    const box = await page.getByLabel(name, { exact: true }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const y = new Date().getUTCFullYear();
  await page.getByLabel("Month", { exact: true }).selectOption("1");
  await page.getByLabel("Year", { exact: true }).selectOption(String(y - 10));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "SPUZL is for 13 and up" })).toBeVisible();
  const me = await page.evaluate(() => fetch("/api/v1/me?optional=1").then((r) => r.json()));
  expect(me).toBeNull();
});
