import { expect, test, type Page } from "@playwright/test";
import { keepFocus, openTestBoard, solveSeeded, VIEWPORTS } from "./harness";
import { createRng } from "@/lib/rng";
import { cellsOf, generate, room, vehicleName, type TrotroPuzzle } from "@/games/trotro/logic";

/**
 * R2-11 Trotro Jam: a visible selected vehicle (accent outline and a small lift, no lift transition under reduced
 * motion), arrows that light up once a vehicle is selected, and a vehicle that moves by mouse drag, touch swipe
 * and keyboard (select, then arrow keys) on the seeded board. The tap-cell flow (the harness solver) still solves it.
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r2-11-trotro-select-swipe.spec.ts
 */

const SEED = "qa";
const { puzzle } = generate(createRng(SEED), "easy");
const shots = "docs/qa/screens/r2";

/** A vehicle on the seeded board with room to slide forward (right or down), and its first cell. */
function mover(p: TrotroPuzzle) {
  for (let v = 0; v < p.vehicles.length; v++) {
    const [, hi] = room(p, p.start, v);
    if (hi > 0) {
      const veh = p.vehicles[v];
      const first = cellsOf(p.size, veh, p.start[v])[0];
      return { v, veh, name: vehicleName(p, v), row: Math.floor(first / p.size), col: first % p.size };
    }
  }
  throw new Error("no vehicle can move on the seeded board");
}
const M = mover(puzzle);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The grid cell (0-based row, col) and whether it holds the mover. */
const cellAt = (page: Page, r: number, c: number) => page.getByRole("gridcell", { name: new RegExp(`^Row ${r + 1}, column ${c + 1}, `) });
/** One space forward along its lane: where its first cell is after the move. */
const ahead = () => (M.veh.axis === "h" ? [M.row, M.col + 1] : [M.row + 1, M.col]);
/** It moved one space forward: its old first cell is empty and the cell past its old end holds it. */
async function movedOne(page: Page) {
  const len = M.veh.len;
  const [er, ec] = M.veh.axis === "h" ? [M.row, M.col + len] : [M.row + len, M.col];
  await expect(cellAt(page, M.row, M.col)).toHaveAccessibleName(/, empty/);
  await expect(cellAt(page, er, ec)).toHaveAccessibleName(new RegExp(esc(M.name)));
}
const vehicle = (page: Page) => page.locator(`[data-vehicle="${M.v}"]`);

async function centre(page: Page, r: number, c: number) {
  const b = (await cellAt(page, r, c).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width };
}

test.describe("R2-11 Trotro Jam", () => {
  test.beforeEach(async ({ page }) => {
    await keepFocus(page);
  });

  test("a selected vehicle is outlined and lifted, and the arrows light up", async ({ page }) => {
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      await openTestBoard(page, "trotro", SEED);
      const pad = page.getByRole("group", { name: "Slide the selected vehicle" });
      // nothing selected: the arrows are off
      await expect(pad.locator("[data-enabled]")).toHaveCount(0);
      const before = await vehicle(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f);
      await cellAt(page, M.row, M.col).click();
      await expect(cellAt(page, M.row, M.col)).toHaveAttribute("aria-selected", "true");
      await expect(vehicle(page)).toHaveAttribute("data-selected", "true");
      // the accent outline and the lift
      expect(await vehicle(page).evaluate((el) => el.style.boxShadow)).toContain("0 0 0 3px var(--accent)");
      await expect.poll(() => vehicle(page).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).f)).toBeLessThan(before);
      // the arrow its way is enabled, in the accent colour
      const fwd = pad.getByRole("button", { name: M.veh.axis === "h" ? "Move right" : "Move down" });
      await expect(fwd).toBeEnabled();
      await expect(fwd).toHaveAttribute("data-enabled", "true");
      expect(await fwd.evaluate((el) => (el as HTMLElement).style.background)).toBe("var(--accent)");
      await page.screenshot({ path: `${shots}/R2-11-selected-${vp.width}.png` });
      // the arrow moves it
      await fwd.click();
      await movedOne(page);
    }
  });

  test("reduced motion: the lift is there but never animates", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openTestBoard(page, "trotro", SEED);
    await cellAt(page, M.row, M.col).click();
    await expect(vehicle(page)).toHaveAttribute("data-selected", "true");
    expect(await vehicle(page).evaluate((el) => el.style.transition)).toBe("none");
  });

  test("mouse: drag a vehicle along its lane", async ({ page }) => {
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      await openTestBoard(page, "trotro", SEED);
      const a = await centre(page, M.row, M.col);
      const along = a.w + 8; // one space (a cell plus the gap)
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      for (let k = 1; k <= 6; k++)
        await page.mouse.move(a.x + (M.veh.axis === "h" ? (along * k) / 6 : 0), a.y + (M.veh.axis === "v" ? (along * k) / 6 : 0));
      await page.screenshot({ path: `${shots}/R2-11-drag-${vp.width}.png` });
      await page.mouse.up();
      await movedOne(page);
      await expect(page.getByText(/1 move, par \d+/).first()).toBeVisible();
      // the dragged vehicle is selected; a plain click right after the drag is not swallowed (it lets go)
      await expect(vehicle(page)).toHaveAttribute("data-selected", "true");
      await cellAt(page, ahead()[0], ahead()[1]).click();
      await expect(vehicle(page)).not.toHaveAttribute("data-selected", "true");
    }
  });

  test("touch: a short swipe on a vehicle moves it one space", async ({ browser }) => {
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: vp === VIEWPORTS.phone });
      const page = await ctx.newPage();
      await keepFocus(page);
      await openTestBoard(page, "trotro", SEED);
      const a = await centre(page, M.row, M.col);
      // well short of half a cell: a swipe, not a drag to the next space
      const dx = M.veh.axis === "h" ? 28 : 0;
      const dy = M.veh.axis === "v" ? 28 : 0;
      const cdp = await ctx.newCDPSession(page);
      const pt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(a.x, a.y) });
      for (let k = 1; k <= 4; k++)
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(a.x + (dx * k) / 4, a.y + (dy * k) / 4) });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await movedOne(page);
      await page.screenshot({ path: `${shots}/R2-11-swipe-${vp.width}.png` });
      // the swiped vehicle is selected, and a plain tap on it right after still registers (it lets go)
      await expect(vehicle(page)).toHaveAttribute("data-selected", "true");
      const b = await centre(page, ahead()[0], ahead()[1]);
      await page.touchscreen.tap(b.x, b.y);
      await expect(vehicle(page)).not.toHaveAttribute("data-selected", "true");
      await ctx.close();
    }
  });

  test("keyboard: select with Enter, slide with the arrow keys, let go with Escape", async ({ page }) => {
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      await openTestBoard(page, "trotro", SEED);
      await cellAt(page, M.row, M.col).focus();
      await page.keyboard.press("Enter");
      await expect(cellAt(page, M.row, M.col)).toHaveAttribute("aria-selected", "true");
      await expect(vehicle(page)).toHaveAttribute("data-selected", "true");
      await expect(page.getByRole("group", { name: "Slide the selected vehicle" }).locator("[data-enabled]").first()).toBeVisible();
      await page.screenshot({ path: `${shots}/R2-11-keyboard-${vp.width}.png` });
      await page.keyboard.press(M.veh.axis === "h" ? "ArrowRight" : "ArrowDown");
      await movedOne(page);
      // the focus rides along with the vehicle and it stays selected
      await expect(page.locator('[role="gridcell"]:focus')).toHaveAccessibleName(new RegExp(esc(M.name)));
      await page.keyboard.press("Escape");
      await expect(vehicle(page)).not.toHaveAttribute("data-selected", "true");
    }
  });

  test("the rich vehicle labels stay, and the tap-cell solver still clears the seeded lot", async ({ page }) => {
    await openTestBoard(page, "trotro", SEED);
    await expect(cellAt(page, M.row, M.col)).toHaveAccessibleName(
      new RegExp(`${esc(M.name)}, slides ${M.veh.axis === "h" ? "left and right" : "up and down"}`),
    );
    await solveSeeded(page, "trotro", SEED);
    await expect(page.getByText(/Trotro is out in \d+ moves/).first()).toBeVisible({ timeout: 15_000 });
  });
});
