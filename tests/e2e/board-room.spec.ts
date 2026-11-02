import { expect, test } from "@playwright/test";
import { openTestBoard } from "./harness";

/**
 * The slim game shell gives the board the room the title row, rule line and tall tool bar used to take.
 * On a 375 × 667 phone the board now starts right under the top bar and its cells are larger than before.
 *
 * Before (1.5.1) the board started under a 60 px top bar, a 32 px title row, at least one 18 px rule line and
 * 8 px of slot padding: 118 px down at the least. Old cell sizes: Crownfall's width rule with 18 px slot padding
 * (floor((375 − 36 − 6) / 8) = 41 px at 8 × 8); Nine was height-bound on this screen at about 35 px (the
 * whole shell down to its tool bar had to fit 667 px).
 */
const OLD_BOARD_TOP = 118;

const CASES = [
  { id: "crownfall", d: "expert", oldCell: 41, minCell: 43 },
  { id: "nine", d: "easy", oldCell: 35, minCell: 38 },
  { id: "dusk", d: "hard", oldCell: 0, minCell: 0 }, // top and fit only: its cells may already sit at their cap
] as const;

test.describe("board room on a 375 × 667 phone", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  for (const c of CASES) {
    test(`${c.id} board is larger and higher than before`, async ({ page }) => {
      await openTestBoard(page, c.id, "room", c.d);
      const grid = page.locator('main[aria-label$=" board"] [role="grid"]').first();
      await expect(grid).toBeVisible({ timeout: 30_000 });
      // Let the height fit settle (it steps on layout and resize observations).
      await page.waitForTimeout(400);
      const box = (await grid.boundingBox())!;
      expect(box.y, "board top").toBeLessThan(OLD_BOARD_TOP - 30);
      const cell = (await page.locator('main[aria-label$=" board"] [role="gridcell"]').first().boundingBox())!;
      if (c.minCell) {
        expect(cell.width, `${c.id} cell (was ${c.oldCell})`).toBeGreaterThanOrEqual(c.minCell);
        expect(cell.width).toBeGreaterThan(c.oldCell);
      }
      // Still no sideways scroll, and the tool row is on screen.
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, "horizontal scroll").toBe(false);
      const tail = await page.locator("[data-shell-tail]").last().boundingBox();
      expect(tail!.y + tail!.height, "tool row above the fold").toBeLessThanOrEqual(667 + 1);
    });
  }
});
