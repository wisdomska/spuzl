import { expect, test, type Page } from "@playwright/test";
import { expectOneTimer, keepFocus, onboardGuest, openTestBoard, tapCell, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-15 Timers. The one header timer starts on the first move (Start on Emoji Hits), never on board load; before
 * that it holds its place with the clock icon only and never reads "00:00". Practice rounds show no timer at all.
 * Pause before the first move shows no clock either. Seeded boards need no database; the practice round does.
 *
 * Screenshots: docs/qa/screens/r2/r2-15-<name>-<375|1280>.png.
 */
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-15-${name}-${w}.png` });
const timer = (page: Page) => page.getByRole("timer");
const CLOCK = /\d{2}:\d{2}/;

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`at ${vp.width} px (${label})`, () => {
    test.use({ viewport: vp });

    test("the timer waits for the first move, then runs; never 00:00 before", async ({ page }) => {
      await keepFocus(page);
      await openTestBoard(page, "crownfall", "r2-15");
      await expectOneTimer(page);
      await expect(timer(page)).toHaveAttribute("data-timer", "waiting");
      await expect(timer(page)).toHaveAccessibleName("Timer starts on your first move");
      await page.waitForTimeout(2500); // board load and looking do not count
      await expect(timer(page)).not.toHaveText(CLOCK);
      await shot(page, "waiting", vp.width);

      await tapCell(page, 1, 1);
      await expect(timer(page)).toHaveAttribute("data-timer", "running");
      await expect(timer(page)).toHaveText(/00:0[0-2]/);
      await page.waitForTimeout(2200);
      await expect(timer(page)).toHaveText(/00:0[2-4]/);
      await expectOneTimer(page);
      await shot(page, "running", vp.width);
    });

    test("Emoji Hits: the timer starts on Start, not on load", async ({ page }) => {
      await keepFocus(page);
      await openTestBoard(page, "emojihits", "r2-15");
      await page.waitForTimeout(3000);
      await expect(timer(page)).toHaveAttribute("data-timer", "waiting");
      await page.getByRole("button", { name: /^Start\b/ }).click();
      await expect(timer(page)).toHaveAttribute("data-timer", "running");
      await expectOneTimer(page);
      await shot(page, "emojihits-start", vp.width);
    });

    test("Pause before the first move shows no clock", async ({ page }) => {
      await keepFocus(page);
      await openTestBoard(page, "crownfall", "r2-15-pause");
      await page.getByRole("button", { name: "Game menu" }).click();
      await page.getByRole("menuitem", { name: "Settings" }).click();
      const sheet = page.getByRole("dialog", { name: "Paused" });
      await expect(sheet).toBeVisible();
      await expect(sheet).not.toContainText(CLOCK);
    });
  });
}

test("the practice round has no timer, and the real game's waits for its first move", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(VIEWPORTS.phone);
  await keepFocus(page);
  await onboardGuest(page, { guided: true });
  await page.goto("/play/dusk?mode=free");
  await expect(page.getByText("First time playing Dusk?")).toBeVisible({ timeout: 30_000 });
  await expect(timer(page)).toHaveCount(0);
  // The idle hint after 15 s must not start any clock either.
  await page.waitForTimeout(16_000);
  await expect(timer(page)).toHaveCount(0);
  await shot(page, "practice", 375);
  await page.getByRole("button", { name: "Skip the Dusk practice round" }).click();
  await waitForBoard(page);
  await expectOneTimer(page);
  await expect(timer(page)).toHaveAttribute("data-timer", "waiting");
});
