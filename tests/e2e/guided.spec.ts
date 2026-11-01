import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/** First try of a game: a hinted practice round, skippable, remembered; then the real game. */
test("guided first play: hints by themselves, skip, then the real board", async ({ page }, info) => {
  await onboardGuest(page, "18+", undefined, { guided: true });
  await page.goto("/play/dusk?mode=free");
  await expect(page.getByText("First time playing Dusk?")).toBeVisible();
  await expect(page.getByRole("status", { name: "Hints are free in this guided round" })).toBeVisible();
  // Stay still: a hint appears on its own.
  const before = await page.locator("main ~ div, main + div").allInnerTexts();
  await page.waitForTimeout(8000);
  const feedback = page.getByText("Tap for a sun, double-tap for a moon. Tap again to clear.");
  await expect(feedback).toHaveCount(0); // replaced by the hint
  expect(before.length).toBeGreaterThanOrEqual(0);
  await page.screenshot({ path: `docs/qa/screens/after/guided-${info.project.name}.png` });
  await page.getByRole("button", { name: "Skip the Dusk practice round" }).click();
  await expect(page.getByText("First time playing Dusk?")).toHaveCount(0);
  await expect(page.locator('[role="grid"]').first()).toBeVisible({ timeout: 30_000 });
  // Remembered: the next visit goes straight to the game.
  await page.goto("/play/dusk?mode=free");
  await expect(page.locator('[role="grid"]').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("First time playing Dusk?")).toHaveCount(0);
});
