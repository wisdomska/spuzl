import { expect, test, type Page } from "@playwright/test";
import { keepFocus, openTestBoard, tapCell, VIEWPORTS } from "./harness";

/**
 * R2-16 Pause. While paused the board is always hidden behind an opaque cover (privacy, no free peeks), for grid
 * boards and canvas / Phaser boards alike, and the Pause sheet says "Board hidden". The game menu, which also stops
 * the clock, covers it too. The Comfort settings stay in the Pause sheet. Reduced motion: the cover is there at once.
 * Seeded boards, no database. Screenshots: docs/qa/screens/r2/r2-16-<name>-<375|1280>.png.
 */
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-16-${name}-${w}.png` });
const cover = (page: Page) => page.locator("[data-board-cover]");

async function openPause(page: Page) {
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  const sheet = page.getByRole("dialog", { name: "Paused" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** What sits on top at the board's centre: the cover, never a cell or the canvas. */
async function topAtBoardCentre(page: Page) {
  return page.evaluate(() => {
    const slot = document.querySelector("main[data-shell-slot]")!.getBoundingClientRect();
    const el = document.elementFromPoint(slot.x + slot.width / 2, slot.y + slot.height / 2);
    return el?.closest("[data-board-cover]") ? "cover" : (el?.tagName ?? "none");
  });
}

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`at ${vp.width} px (${label})`, () => {
    test.use({ viewport: vp });

    for (const game of ["crownfall", "dash"]) {
      test(`${game}: Pause hides the board and says so; Comfort settings stay`, async ({ page }) => {
        await keepFocus(page);
        await openTestBoard(page, game, "r2-16");
        if (game === "crownfall") await tapCell(page, 1, 1); // mid-game
        const sheet = await openPause(page);
        await expect(sheet).toContainText("Board hidden");
        await expect(cover(page)).toBeAttached();
        // Under the sheet's dimmed backdrop, the board slot itself is covered (Radix hides it from hit-testing, so
        // read it with the overlay out of the way).
        await page.evaluate(() =>
          document.querySelectorAll<HTMLElement>("[data-state=open].fixed").forEach((el) => (el.style.pointerEvents = "none")),
        );
        expect(await topAtBoardCentre(page)).toBe("cover");
        for (const name of [/Colour-blind patterns/, /Text size/, /Reduced motion/, /Hide timer/, /Sound/, /Haptics/])
          await expect(sheet.getByRole("button", { name })).toBeVisible();
        await shot(page, `${game}-paused`, vp.width);
        await sheet.getByRole("button", { name: "Resume" }).click();
        await expect(cover(page)).toHaveCount(0);
      });
    }

    test("the game menu covers the board while it holds the clock", async ({ page }) => {
      await keepFocus(page);
      await openTestBoard(page, "crownfall", "r2-16-menu");
      await page.getByRole("button", { name: "Game menu" }).click();
      await expect(page.getByRole("menu")).toBeVisible();
      await expect(cover(page)).toBeVisible();
      await shot(page, "menu", vp.width);
      await page.keyboard.press("Escape");
      await expect(cover(page)).toHaveCount(0);
    });
  });
}

test("reduced motion: the cover is there at once, the sheet does not slide", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phone);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await keepFocus(page);
  await openTestBoard(page, "crownfall", "r2-16-rm");
  await page.getByRole("button", { name: "Game menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(cover(page)).toHaveCSS("opacity", "1", { timeout: 100 });
  const box = await page.getByRole("dialog", { name: "Paused" }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORTS.phone.height + 1);
});
