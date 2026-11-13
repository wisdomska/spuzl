import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, openTestBoard } from "./harness";

/**
 * Undo takes back your own last move, at once (owner, 13 Nov 2026). Against the bot, the bot's answer goes with it,
 * and Undo works while the bot is still thinking. (Chess used to show the undone move again: the board kept drawing
 * the move it had sent whenever the position matched the one it was sent from.) In the Four Up puzzle, Undo works
 * while a drop is still being checked.
 */
const pieces = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[aria-label]")]
      .map((e) => e.getAttribute("aria-label")!)
      .filter((l) => /^[a-h][1-8], (white|black)/.test(l))
      .map((l) => l.replace(/, last move$/, ""))
      .sort()
      .join("|"),
  );
const sq = (page: Page, n: string) =>
  page
    .getByRole("button", { name: new RegExp(`^${n}\\b`) })
    .or(page.getByRole("gridcell", { name: new RegExp(`^${n}\\b`) }))
    .first();

test("chess against the bot: Undo takes back your move and the bot's answer, even mid-think", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/play/chess/bot");
  const skip = page.getByRole("button", { name: /Skip the .* practice round/ });
  if (await skip.isVisible({ timeout: 8000 }).catch(() => false)) await skip.click();
  await sq(page, "e2").waitFor({ timeout: 20_000 });
  const start = await pieces(page);
  const undo = page.getByRole("button", { name: "Undo" }).first();

  await sq(page, "e2").click();
  await sq(page, "e4").click();
  await expect.poll(() => page.locator('[aria-label*="black"][aria-label$="last move"]').count(), { timeout: 10_000 }).toBe(1);
  await undo.click();
  await expect.poll(() => pieces(page), { timeout: 500 }).toBe(start);
  await page.waitForTimeout(1500);
  expect(await pieces(page)).toBe(start);

  await sq(page, "d2").click();
  await sq(page, "d4").click();
  await undo.click();
  await expect.poll(() => pieces(page), { timeout: 500 }).toBe(start);
  await page.waitForTimeout(1500);
  expect(await pieces(page)).toBe(start);
});

test("Four Up puzzle: Undo works while a drop is still being checked", async ({ page }) => {
  await openTestBoard(page, "fourup");
  const discs = () => page.locator('[aria-label^="Column"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")).join("|"));
  const before = await discs();
  await page.locator('[aria-label^="Column 1"]').first().click();
  await page.getByRole("button", { name: "Undo" }).first().click();
  await expect.poll(discs, { timeout: 500 }).toBe(before);
  await page.waitForTimeout(1500);
  expect(await discs()).toBe(before);
});
