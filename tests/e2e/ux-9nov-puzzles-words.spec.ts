import { expect, test, type Page } from "@playwright/test";
import { openTestBoard, tapCell } from "./harness";

/**
 * UX pass (9 Nov), round 2: Puzzles and Words & Quiz.
 * - Weave, Flowline, Pairup (and Dusk, Trotro Jam) fit a phone by height too: no page scroll at 320 × 568 and
 *   375 × 667 portrait, the Hint button above the fold.
 * - The game menu's Restart asks first once the board has moves (Crownfall), and not on an untouched board.
 * Screenshots: docs/qa/screens/r2/ux-9nov-<game>-<width>.png.
 */
const PHONES = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
] as const;
const FIT = ["weave", "flowline", "pairup", "dusk", "trotro"] as const;

async function settle(page: Page) {
  await page.waitForTimeout(600);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

for (const vp of PHONES) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp });
    for (const id of FIT) {
      test(`${id}: no page scroll, tools above the fold`, async ({ page }) => {
        await openTestBoard(page, id, "ux-9nov-fit");
        await settle(page);
        const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: window.innerHeight }));
        expect(m.scroll, `scrollHeight ${m.scroll} vs innerHeight ${m.inner}`).toBeLessThanOrEqual(m.inner);
        const hint = page.getByRole("button", { name: /^Hint\b/ });
        if (await hint.count()) {
          const box = (await hint.first().boundingBox())!;
          expect(box.y + box.height).toBeLessThanOrEqual(m.inner);
        }
        await page.screenshot({ path: `docs/qa/screens/r2/ux-9nov-${id}-${vp.width}.png` });
      });
    }
  });
}

test.describe("Restart asks first", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("crownfall: untouched board has nothing to restart; with marks, Restart asks and Keep playing keeps them", async ({ page }) => {
    await openTestBoard(page, "crownfall", "ux-9nov-restart");
    await page.getByRole("button", { name: /game menu/i }).click();
    await expect(page.locator('[data-menu-item="restart"]')).toHaveAttribute("data-disabled", "");
    await page.keyboard.press("Escape");

    await tapCell(page, 1, 1);
    await page.getByRole("button", { name: /game menu/i }).click();
    await page.locator('[data-menu-item="restart"]').click();
    const ask = page.locator("[data-restart-confirm]");
    await expect(ask).toBeVisible();
    await ask.getByRole("button", { name: "Keep playing" }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByRole("gridcell", { name: /^Row 1, column 1, .*marked empty/ })).toHaveCount(1);

    await page.getByRole("button", { name: /game menu/i }).click();
    await page.locator('[data-menu-item="restart"]').click();
    await page.locator("[data-restart-confirm]").getByRole("button", { name: "Start over" }).click();
    await expect(page.getByRole("gridcell", { name: /^Row 1, column 1, .*, empty$/ })).toHaveCount(1);
  });
});
