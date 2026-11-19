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

/**
 * A phone that will not turn (owner, 19 Nov 2026: "fullscreen on mobile still doesn't change the orientation"): the
 * lock is refused (iPhone, iPad, Firefox, Samsung Internet), or there is no full screen at all (an iPhone's
 * Safari). The page then turns itself: the board and its controls lie sideways across the upright screen, filling
 * it, and leaving full screen puts the page upright again.
 */
test.describe("upright phone, the lock refused", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const [label, noFullscreen] of [
    ["Android browser that refuses the lock", false],
    ["iPhone Safari, no full screen at all", true],
  ] as const) {
    test(`gotcha: ${label}: the page turns itself`, async ({ page }) => {
      await page.addInitScript((noFs) => {
        const o = screen.orientation as unknown as Record<string, unknown>;
        Object.defineProperty(o, "lock", { configurable: true, value: () => Promise.reject(new Error("NotSupportedError")) });
        Object.defineProperty(o, "unlock", { configurable: true, value: () => {} });
        if (noFs) Object.defineProperty(Document.prototype, "fullscreenEnabled", { configurable: true, get: () => false });
      }, noFullscreen);
      await page.goto(seededBoardUrl("gotcha", "qa", "easy"));
      const got = page.getByRole("button", { name: "Got it" });
      await expect(got.or(page.locator("[data-rage]")).first()).toBeVisible({ timeout: 45_000 });
      if (await got.isVisible()) await got.click();

      await page.getByRole("button", { name: "Full screen" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-turned", "");
      // Sideways layout inside the turned page: move buttons on one side of the board, Jump on the other. The page
      // turns anticlockwise (its top to the screen's left), so on the upright screen "left of" becomes "below".
      const canvas = page.locator("canvas").first();
      const move = page.getByRole("button", { name: "Move left", exact: true });
      const jump = page.getByRole("button", { name: "Jump", exact: true });
      await expect(page.locator("[data-sideways-left]")).toBeVisible();
      const [m, c, j] = await Promise.all([move.boundingBox(), canvas.boundingBox(), jump.boundingBox()]);
      expect(m!.y).toBeGreaterThanOrEqual(c!.y + c!.height - 1);
      expect(j!.y + j!.height).toBeLessThanOrEqual(c!.y + 1);
      // The top bar sits along the screen's left edge.
      const back = await page.getByRole("button", { name: "Back" }).boundingBox();
      expect(back!.x).toBeLessThan(c!.x);
      // The board fills the screen's long side between the controls, and its short side under the top bar, as a
      // phone held sideways does (the 844 x 390 tests above).
      expect(c!.height).toBeGreaterThan(480);
      expect(c!.width).toBeGreaterThan(260);
      for (const b of [m!, c!, j!]) {
        expect(b.x).toBeGreaterThanOrEqual(-1);
        expect(b.x + b.width).toBeLessThanOrEqual(391);
        expect(b.y).toBeGreaterThanOrEqual(-1);
        expect(b.y + b.height).toBeLessThanOrEqual(845);
      }

      await page.getByRole("button", { name: "Exit full screen" }).click();
      await expect(page.locator("html")).not.toHaveAttribute("data-turned", "");
      await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
    });
  }
});

test.describe("a large screen", () => {
  test.use({ isMobile: false, hasTouch: false, viewport: { width: 1646, height: 909 } });
  test("Gotcha's board is as big as Dash's (no narrow cap)", async ({ page }) => {
    const width = async (game: string) => {
      await page.goto(seededBoardUrl(game, "qa", "easy"));
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible({ timeout: 45_000 });
      await page.waitForTimeout(800);
      return (await canvas.boundingBox())!.width;
    };
    const dash = await width("dash");
    const gotcha = await width("gotcha");
    expect(gotcha).toBeGreaterThan(1000);
    expect(Math.abs(gotcha - dash)).toBeLessThan(40);
  });
});
