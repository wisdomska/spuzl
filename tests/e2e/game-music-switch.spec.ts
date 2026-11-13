import { expect, test } from "@playwright/test";
import { onboardGuest, openTestBoard } from "./harness";

/**
 * In-game audio (owner, 13 Nov 2026): the game menu has Sound effects and Music as two switches, so music can be
 * turned off from inside a game (turning sound effects off used to leave the music playing).
 */
test("the game menu turns music off on its own", async ({ page }) => {
  await onboardGuest(page);
  await openTestBoard(page, "crownfall");
  const menu = page.getByRole("button", { name: "Game menu" }).first();
  const sfx = page.getByRole("menuitemcheckbox", { name: /Sound effects/ });
  const music = page.getByRole("menuitemcheckbox", { name: /^Music/ });
  await menu.click();
  await expect(sfx).toBeVisible();
  await expect(music).toHaveAttribute("aria-checked", "true");
  await music.click();
  if (!(await music.isVisible())) await menu.click();
  await expect(music).toHaveAttribute("aria-checked", "false");
  await expect(sfx).toHaveAttribute("aria-checked", "true");
  const saved = await page.evaluate(() => Object.values(localStorage).find((v) => v.includes("musicTouched")) ?? "");
  expect(saved).toContain('"music":false');
});
