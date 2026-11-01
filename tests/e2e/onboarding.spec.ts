import { expect, test } from "@playwright/test";

/** SPZ-15 + SPZ-05: plain start choices, lesson flows into "Make Spuz yours", CTA names the destination, lesson counts today. */
test("onboarding: lesson, merged celebration, named CTA, counted on Home", async ({ page }, info) => {
  await page.goto("/welcome");
  await page.getByRole("button", { name: "Play as guest" }).click();
  await page.getByRole("radio", { name: /18 or older/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("button", { name: /Browse all 51 games/ })).toBeVisible();
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
