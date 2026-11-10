import { expect, test, type Page } from "@playwright/test";
import { openTestBoard } from "./harness";

/**
 * R4-09 Five fits a 320 × 568 phone. The compact layout (the `tiny` variant, 600 px of height and less) tightens the
 * shell and the board, folds the tile key under the grid away and takes the keys to 40 px, and the tiles (letters
 * only, never tap targets) may step down to 26 px. 375 × 667 and the 1280 × 800 two-column shell still fit.
 * Checked on load (the rule and the start line showing) and after a refused word (a long feedback line, the rule
 * folded away). Screenshots: docs/qa/screens/r2/r4-09-five-<width>.png.
 */
const SCREENS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
] as const;

async function settle(page: Page) {
  // The height fit steps in layout effects; give it a few frames.
  await page.waitForTimeout(600);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function expectFits(page: Page, what: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: window.innerHeight }));
  expect(m.scroll, `${what}: scrollHeight ${m.scroll} vs innerHeight ${m.inner}`).toBeLessThanOrEqual(m.inner);
  // The whole keyboard (ENTER and Backspace on its last row) and the Hint tool are on screen.
  for (const key of [page.getByRole("button", { name: "ENTER" }), page.getByRole("button", { name: "Backspace" })]) {
    const box = (await key.boundingBox())!;
    expect(box.y + box.height, `${what}: keyboard`).toBeLessThanOrEqual(m.inner);
    expect(box.height, `${what}: key height`).toBeGreaterThanOrEqual(40);
  }
  const hint = page.getByRole("button", { name: /^Hint\b/ });
  if (await hint.count()) {
    const box = (await hint.first().boundingBox())!;
    expect(box.y + box.height, `${what}: Hint`).toBeLessThanOrEqual(m.inner);
  }
  const tile = (await page.getByRole("gridcell", { name: /^Row 1, column 1\b/ }).boundingBox())!;
  expect(tile.height, `${what}: tile`).toBeGreaterThanOrEqual(26);
}

for (const vp of SCREENS) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp });

    test("five: no page scroll on load and after a long feedback line", async ({ page }) => {
      await openTestBoard(page, "five", "r4-09-fit");
      await settle(page);
      await expectFits(page, "load");
      // The tile key folds away only on the compact layout.
      await expect(page.getByRole("list", { name: "Tile key" })).toBeVisible({ visible: vp.height > 600 });

      // A word that isn't in the list: the long "isn't in our word list" line, the rule folded on the first letter.
      await page.keyboard.type("QQQQQ");
      await page.keyboard.press("Enter");
      await expect(page.getByText(/isn't in our word list/)).toBeVisible();
      await expect(page.locator("[data-shell-rule]")).toHaveCount(0);
      await settle(page);
      await expectFits(page, "after a refused word");
      await page.screenshot({ path: `docs/qa/screens/r2/r4-09-five-${vp.width}.png` });
    });
  });
}
