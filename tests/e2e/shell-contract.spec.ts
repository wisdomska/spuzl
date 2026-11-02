import { expect, test } from "@playwright/test";
import { GAMES, LAB_GAMES } from "@/lib/catalog";

/**
 * Phase 1 acceptance: every one of the 51 games renders inside GameShell, with the slim top bar contract
 * (Back, ONE timer, the game menu, all 44 px and at least 12 px apart) and no second clock on the board.
 * Help, Pause (Settings), Sound and the rest live in the menu, every item a 44 px target.
 */
const CLOCK = /\b\d{1,2}:\d{2}\b/;

test.describe.configure({ mode: "parallel" });

for (const g of [...GAMES, ...LAB_GAMES]) {
  test(`shell contract: ${g.id}`, async ({ page }) => {
    await page.goto(`/dev/board/${g.id}?seed=contract&d=easy`);
    // Photosensitive games show a one-time notice first.
    const ok = page.getByRole("button", { name: /I understand|Continue|Got it/ });
    if (await ok.count()) await ok.first().click();
    const header = page.locator("header").first();
    await expect(header.getByRole("button", { name: "Back" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("timer")).toHaveCount(1);
    for (const name of ["Back", "Game menu"]) {
      const b = await header.getByRole("button", { name }).boundingBox();
      expect(b!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(b!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
    // The menu holds the secondary actions; it opens, every item is a 44 px target, and Escape closes it.
    await header.getByRole("button", { name: "Game menu" }).click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    for (const name of [/Sound/, /Haptics/, /Settings/, /Share/, /Report a problem/]) {
      const b = await menu.getByRole(/Sound|Haptics/.test(String(name)) ? "menuitemcheckbox" : "menuitem", { name }).boundingBox();
      expect(b!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(header.getByRole("button", { name: "Game menu" })).toBeFocused();
    const boxes = await header.locator(":scope > *").evaluateAll((els) =>
      els
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => [r.left, r.right]),
    );
    for (let i = 1; i < boxes.length; i++) expect(boxes[i][0] - boxes[i - 1][1], "header gap").toBeGreaterThanOrEqual(12 - 0.5);
    // No second mm:ss clock anywhere below the header (results and timers belong to the shell).
    const below = await page.locator("main").first().innerText();
    expect(below.match(CLOCK), `second clock in ${g.id}`).toBeNull();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, "horizontal scroll").toBe(false);
  });
}
