import { expect, test, type Page } from "@playwright/test";
import { keepFocus, onboardGuest } from "./harness";

/**
 * R4 Board keys: the Board Bay live boards for Four Up and Oware (and Flip, retired, which shares the hook) are one
 * Tab stop each. The arrows move between columns or pits, Enter plays the focused one, and a cell that can't be
 * played still takes focus. One guest per test (logged for cleanup), each in a Bay game against the Practice bot.
 */
async function bayVsBot(page: Page, game: string) {
  const m = await page.request.post("/api/v1/bay", { data: { game, mode: "async", bot: true } });
  expect(m.ok(), await m.text()).toBe(true);
  const { id } = await m.json();
  await page.goto(`/bay/${id}`);
}

test.describe("R4 board keys", () => {
  test.beforeEach(async ({ page }) => {
    await keepFocus(page);
    await onboardGuest(page);
  });

  test("Four Up: one Tab stop, Right, Left, Home and End pick a column, Enter drops", async ({ page }) => {
    await bayVsBot(page, "fourup");
    const grid = page.getByRole("grid", { name: "Four Up board" });
    const cells = grid.getByRole("gridcell");
    await expect(cells).toHaveCount(7, { timeout: 30_000 });
    // your turn: a column says "drop here"
    await expect(grid.getByRole("gridcell", { name: /drop here$/ }).first()).toBeVisible({ timeout: 20_000 });
    expect(await grid.locator('[tabindex="0"]').count()).toBe(1);
    await cells.first().focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    await expect(cells.nth(3)).toBeFocused();
    await page.keyboard.press("End");
    await expect(cells.nth(6)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(cells.nth(0)).toBeFocused();
    // Up and Down stay put on a single row
    await page.keyboard.press("ArrowDown");
    await expect(cells.nth(0)).toBeFocused();
    for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
    const before = Number((await cells.nth(3).getAttribute("aria-label"))!.match(/(\d) discs?/)?.[1] ?? 0);
    await page.keyboard.press("Enter");
    await expect
      .poll(async () => Number((await cells.nth(3).getAttribute("aria-label"))!.match(/(\d) discs?/)?.[1] ?? 0), { timeout: 10_000 })
      .toBeGreaterThan(before);
    await expect(cells.nth(3)).toHaveAttribute("tabindex", "0");
  });

  test("Oware: arrows move across both rows of pits, theirs take focus too, Enter sows", async ({ page }) => {
    await bayVsBot(page, "oware");
    const grid = page.getByRole("grid", { name: "Oware board" });
    const pits = grid.getByRole("gridcell");
    await expect(pits).toHaveCount(12, { timeout: 30_000 });
    await expect(grid.getByRole("gridcell", { name: /, sow/ }).first()).toBeVisible({ timeout: 20_000 });
    expect(await grid.locator('[tabindex="0"]').count()).toBe(1);
    await pits.first().focus();
    // the top row is theirs: focusable, marked as not playable
    await expect(pits.first()).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowDown");
    await expect(pits.nth(6)).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(pits.nth(8)).toBeFocused();
    await page.keyboard.press("PageUp");
    await expect(pits.nth(2)).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(pits.nth(8)).toBeFocused();
    // sow the focused pit (every pit starts with 4)
    const name = (await pits.nth(8).getAttribute("aria-label"))!;
    expect(name).toMatch(/, 4 seeds, sow/);
    const pit = name.match(/^Pit (\d+)/)![1];
    await page.keyboard.press("Enter");
    await expect(grid.getByRole("gridcell", { name: new RegExp(`^Pit ${pit}, 0 seeds`) })).toHaveCount(1, { timeout: 10_000 });
  });
});
