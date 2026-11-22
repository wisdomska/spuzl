import { expect, test, type Page } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * Draughts against Spuzl in both sizes (owner, 22 Nov 2026: International 10 × 10 is the default, 8 × 8 a choice):
 * the board picker starts on 10 × 10, the game is played on a 10 × 10 board, a move goes through and Spuzl answers;
 * picking 8 × 8 gives an 8 × 8 board, and the choice is remembered for next time.
 */
async function start(page: Page) {
  await page.goto("/play/draughts/bot");
  await expect(page.getByRole("radiogroup", { name: "Board" })).toBeVisible({ timeout: 30_000 });
}

/** Plays the first legal move for the light pieces: tap an outlined man, then a square it can reach. */
async function playOne(page: Page) {
  const grid = page.getByRole("grid", { name: /Draughts board/ });
  const movable = grid
    .locator('[role="gridcell"]')
    .filter({ has: page.locator("span[style*='outline']") })
    .first();
  await movable.click();
  await grid
    .getByRole("gridcell", { name: /legal move/ })
    .first()
    .click();
}

test("draughts against Spuzl: 10 × 10 by default, 8 × 8 when picked, and the choice is remembered", async ({ page }) => {
  test.setTimeout(180_000);
  await onboardGuest(page);

  await start(page);
  await expect(page.getByRole("radio", { name: /^10 × 10/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Start game" }).click();
  const grid = page.getByRole("grid", { name: /Draughts board/ });
  await expect(grid).toHaveAttribute("aria-rowcount", "10", { timeout: 30_000 });
  await expect(grid.getByRole("gridcell")).toHaveCount(100);
  // 20 light men and 20 dark
  await expect(grid.getByRole("gridcell", { name: /light man/ })).toHaveCount(20);
  await expect(grid.getByRole("gridcell", { name: /dark man/ })).toHaveCount(20);
  await playOne(page);
  // Spuzl answers: it's the light side's turn again, with a man to move
  await expect(grid.locator("span[style*='outline']").first()).toBeVisible({ timeout: 20_000 });

  // 8 × 8, picked once, is remembered
  await start(page);
  await page.getByRole("radio", { name: /^8 × 8/ }).click();
  await page.getByRole("button", { name: "Start game" }).click();
  await expect(grid).toHaveAttribute("aria-rowcount", "8", { timeout: 30_000 });
  await expect(grid.getByRole("gridcell", { name: /light man/ })).toHaveCount(12);
  await playOne(page);
  await start(page);
  await expect(page.getByRole("radio", { name: /^8 × 8/ })).toHaveAttribute("aria-checked", "true");
});
