import { expect, test } from "@playwright/test";
import { GAMES, LAB_GAMES } from "@/lib/catalog";

/**
 * Phase 1 acceptance: every one of the 51 games renders inside GameShell, with the shell header contract
 * (Back, ONE timer, Help, Pause, all 44 px and at least 12 px apart) and no second clock on the board.
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
    for (const name of ["Back", "Help", "Pause"]) {
      const b = await header.getByRole("button", { name }).boundingBox();
      expect(b!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(b!.height, `${name} height`).toBeGreaterThanOrEqual(44);
    }
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
