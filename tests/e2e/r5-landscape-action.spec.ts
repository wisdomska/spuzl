import { expect, test, type Page } from "@playwright/test";
import { seededBoardUrl } from "./harness";

/**
 * Gotcha and Dash on a phone held sideways (owner, 17 Nov 2026: "full screen should be in landscape"): the board
 * takes the width between the controls (move or duck on the left, jump on the right), nothing scrolls, and full
 * screen asks the phone to turn sideways (the lock is let go on leaving full screen).
 */
test.use({ isMobile: true, hasTouch: true, viewport: { width: 844, height: 390 } });

/** Records screen.orientation lock and unlock calls (headless Chromium can't really turn). */
async function spyOrientation(page: Page) {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { __turns: string[] }).__turns = calls;
    const o = screen.orientation as unknown as Record<string, unknown>;
    Object.defineProperty(o, "lock", { configurable: true, value: (t: string) => (calls.push(`lock:${t}`), Promise.resolve()) });
    Object.defineProperty(o, "unlock", { configurable: true, value: () => void calls.push("unlock") });
  });
}

for (const [game, left] of [
  ["gotcha", "Move left"],
  ["dash", "Duck"],
] as const) {
  test(`${game}: controls either side of the board, no scroll; full screen turns sideways`, async ({ page }) => {
    await spyOrientation(page);
    await page.goto(seededBoardUrl(game, "qa", "easy"));
    const got = page.getByRole("button", { name: "Got it" });
    const board = page.locator("[data-rage]").first();
    await expect(got.or(board).first()).toBeVisible({ timeout: 45_000 });
    if (await got.isVisible()) await got.click();

    const leftBtn = page.getByRole("button", { name: left, exact: true });
    const jump = page.getByRole("button", { name: "Jump", exact: true });
    const canvas = page.locator("canvas").first();
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await expect(leftBtn).toBeInViewport({ ratio: 1 });
    await expect(jump).toBeInViewport({ ratio: 1 });
    const [l, c, j] = await Promise.all([leftBtn.boundingBox(), canvas.boundingBox(), jump.boundingBox()]);
    expect(l!.x + l!.width).toBeLessThanOrEqual(c!.x);
    expect(j!.x).toBeGreaterThanOrEqual(c!.x + c!.width);
    // The board uses most of the screen, and the page never scrolls.
    expect(c!.width).toBeGreaterThan(480);
    expect(c!.height).toBeGreaterThan(260);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(390);

    await page.getByRole("button", { name: "Full screen" }).click();
    await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __turns: string[] }).__turns)).toContain("lock:landscape");
    await page.getByRole("button", { name: "Exit full screen" }).click();
    await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __turns: string[] }).__turns.at(-1))).toBe("unlock");
  });
}

test("a puzzle game never asks to turn sideways", async ({ page }) => {
  await spyOrientation(page);
  await page.goto(seededBoardUrl("crownfall", "qa", "easy"));
  const fs = page.getByRole("button", { name: "Full screen" });
  await expect(fs).toBeVisible({ timeout: 45_000 });
  await fs.click();
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => (window as unknown as { __turns: string[] }).__turns)).not.toContain("lock:landscape");
  await page.getByRole("button", { name: "Exit full screen" }).click();
});
