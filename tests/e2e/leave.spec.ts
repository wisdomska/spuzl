import { expect, test } from "@playwright/test";
import { onboardGuest, openGame, tapCell, waitForBoard } from "./harness";

/**
 * Leaving a game (lib/game/leave.ts): solo play leaves at once by every route and comes back through Resume;
 * a timed scored run asks once, with Keep playing as the default. (Duel forfeits: tests/realtime/duel.spec.ts.)
 */
const marked = /^Row 1, column 1, .*marked empty/;

test("solo: Back leaves at once, the game card offers Resume, and the move is still there", async ({ page }) => {
  await onboardGuest(page);
  await openGame(page, "crownfall", "free");
  await tapCell(page, 1, 1); // one tap marks the cell empty (X)
  await expect(page.getByRole("gridcell", { name: marked })).toBeVisible();

  await page.getByRole("button", { name: "Back" }).click();
  await page.waitForURL(/\/world\/logic/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  const card = page.getByRole("link", { name: /Crownfall/ });
  await expect(card.getByText("Resume")).toBeVisible();
  await card.click();
  await waitForBoard(page);
  await expect(page.getByRole("gridcell", { name: marked })).toBeVisible({ timeout: 15_000 });
});

test("solo: the game menu's Leave game and the back gesture leave at once too", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/world/logic");
  await page.goto("/play/crownfall?mode=free");
  await waitForBoard(page);
  await tapCell(page, 2, 2);

  await page.getByRole("button", { name: "Game menu" }).click();
  await page.getByRole("menuitem", { name: "Leave game" }).click();
  await page.waitForURL(/\/world\/logic/);

  await page.goto("/play/crownfall?mode=free");
  await waitForBoard(page);
  await page.goBack();
  await page.waitForURL(/\/world\/logic/);
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
});

test("timed run: one light confirm with Keep playing as the default; a second back always leaves", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/world/word");
  await openGame(page, "quickfire", "free");
  // Before Start there is nothing to lose: Escape would leave. Start the run first.
  await page.getByRole("button", { name: "Start" }).click();

  await page.getByRole("button", { name: "Back" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Leave this round?" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("Your progress here won't count.")).toBeVisible();
  await expect(confirm.getByRole("button", { name: "Keep playing" })).toBeFocused();
  // Escape (like a tap outside) keeps playing.
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(page).toHaveURL(/\/play\/quickfire/);

  // The back gesture asks the same question...
  await page.goBack();
  await expect(confirm).toBeVisible();
  await expect(page).toHaveURL(/\/play\/quickfire/);
  // ...and a second back always leaves.
  await page.goBack();
  await page.waitForURL(/\/world\/word/);
});

test("timed run: Leave from the confirm goes straight out", async ({ page }) => {
  await onboardGuest(page);
  await openGame(page, "quickfire", "free");
  await page.getByRole("button", { name: "Start" }).click();
  await page.keyboard.press("Escape");
  const confirm = page.getByRole("alertdialog", { name: "Leave this round?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Leave", exact: true }).click();
  await page.waitForURL(/\/world\/word/);
});
