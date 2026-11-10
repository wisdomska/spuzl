import { expect, test, type Page } from "@playwright/test";
import { openTestBoard, solveTestBoard, tapCell } from "./harness";

/**
 * R4-22 Light Up 10 × 10 tap-to-zoom. On a phone the hard board's cells are under 44 px (36 at 375, 30 at 320), so
 * the first tap zooms in on that spot (48 px cells inside the same frame) and places nothing; the next tap places a
 * lamp; a drag moves the zoomed board; Zoom again zooms out. The page never scrolls, zoomed or not, at 320 × 568,
 * 375 × 667 and 1280 × 800 (where the cells are 44 px and up, so there is no zoom). The harness solver clears a
 * zoomable board. Screenshots: docs/qa/screens/r2/r4-22-lightup-<zoomed|whole>-<width>.png.
 */
const SCREENS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
] as const;

async function settle(page: Page) {
  await page.waitForTimeout(400);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

async function expectNoScroll(page: Page, what: string) {
  const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: window.innerHeight }));
  expect(m.scroll, `${what}: scrollHeight ${m.scroll} vs innerHeight ${m.inner}`).toBeLessThanOrEqual(m.inner);
  const hint = page.getByRole("button", { name: /^Hint\b/ });
  const box = (await hint.first().boundingBox())!;
  expect(box.y + box.height, `${what}: Hint`).toBeLessThanOrEqual(m.inner);
}

/** A white cell that is empty: its name ends in "dark". */
const darkCell = (page: Page) => page.getByRole("gridcell", { name: /^Row \d+, column \d+, dark$/ }).first();
const rowCol = async (page: Page) => {
  const name = (await darkCell(page).getAttribute("aria-label"))!;
  const m = /^Row (\d+), column (\d+)/.exec(name)!;
  return [Number(m[1]), Number(m[2])] as const;
};

for (const vp of SCREENS) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp });

    test("lightup 10 × 10: tap to zoom, place, drag, whole board; no page scroll", async ({ page }) => {
      await openTestBoard(page, "lightup", "r4-22-zoom", "hard");
      await expect(page.getByRole("grid", { name: "Light Up board, 10 by 10" })).toBeVisible();
      await settle(page);
      await expectNoScroll(page, "whole board");

      const frame = page.locator("[data-zoom]");
      if (vp.width >= 900) {
        // Laptop: cells are big enough, no zoom; one tap places a lamp.
        await expect(frame).toHaveCount(0);
        const cell = (await darkCell(page).boundingBox())!;
        expect(cell.width).toBeGreaterThanOrEqual(44);
        const [r, c] = await rowCol(page);
        await tapCell(page, r, c);
        await expect(page.getByRole("gridcell", { name: new RegExp(`^Row ${r}, column ${c}, lamp`) })).toHaveCount(1);
        return;
      }

      await expect(frame).toHaveAttribute("data-zoom", "out");
      const before = (await frame.boundingBox())!;
      expect((await darkCell(page).boundingBox())!.width).toBeLessThan(44);
      await page.screenshot({ path: `docs/qa/screens/r2/r4-22-lightup-whole-${vp.width}.png` });

      // The first tap zooms in there and places nothing.
      const [r, c] = await rowCol(page);
      await tapCell(page, r, c);
      await expect(frame).toHaveAttribute("data-zoom", "in");
      await expect(page.getByRole("gridcell", { name: new RegExp(`^Row ${r}, column ${c}, dark$`) })).toHaveCount(1);
      await settle(page);
      const target = page.getByRole("gridcell", { name: new RegExp(`^Row ${r}, column ${c}\\b`) });
      const box = (await target.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      // The cell is wholly inside the frame, and the frame kept its place and size (nothing else moved).
      const after = (await frame.boundingBox())!;
      expect(after).toEqual(before);
      expect(box.x).toBeGreaterThanOrEqual(after.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(after.x + after.width + 1);
      await expectNoScroll(page, "zoomed");

      // The second tap places a lamp.
      await tapCell(page, r, c);
      await expect(page.getByRole("gridcell", { name: new RegExp(`^Row ${r}, column ${c}, lamp`) })).toHaveCount(1);
      await page.screenshot({ path: `docs/qa/screens/r2/r4-22-lightup-zoomed-${vp.width}.png` });

      // A drag moves the zoomed board (and places nothing).
      const grid = page.getByRole("grid", { name: "Light Up board, 10 by 10" });
      const t0 = await grid.evaluate((el) => getComputedStyle(el).transform);
      const lamps0 = await page.getByRole("gridcell", { name: /, lamp/ }).count();
      const cx = after.x + after.width / 2,
        cy = after.y + after.height / 2;
      const dir = c > 5 ? 1 : -1; // drag towards the side with more board to see
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dir * 60, cy + 40, { steps: 6 });
      await page.mouse.up();
      await settle(page);
      expect(await grid.evaluate((el) => getComputedStyle(el).transform)).not.toBe(t0);
      expect(await page.getByRole("gridcell", { name: /, lamp/ }).count()).toBe(lamps0);
      await expectNoScroll(page, "after a drag");

      // The Zoom tool (pressed while zoomed) zooms back out.
      const zoom = page.getByRole("button", { name: /^Zoom\b/ });
      await expect(zoom).toHaveAttribute("aria-pressed", "true");
      await zoom.click();
      await expect(frame).toHaveAttribute("data-zoom", "out");
      await expectNoScroll(page, "zoomed out");
    });
  });
}

test.describe("solver on a zoomable board", () => {
  test.use({ viewport: { width: 375, height: 667 } });
  test("the harness clears a 10 × 10 board through the zoom", async ({ page }) => {
    await solveTestBoard(page, "lightup", "r4-22-solve", "hard");
    await expect(page.getByText("Every cell is lit. Lights on!").first()).toBeVisible();
  });
});
