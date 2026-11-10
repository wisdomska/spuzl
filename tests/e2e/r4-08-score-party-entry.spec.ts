import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * R4-08: score games (Quickfire, Emoji Hits, Beat Tap, ...) race in Party (R3-08), so their Library card and their
 * Challenge sheet offer "Host a party" (and only that: Duels stay time races). The Host tab opens with the game
 * picked. Time games keep Quick Match, Duel a friend and Host a party. Needs the app with a database and the
 * release default "party.scoreRaces" on (the lead runs it).
 */

test("Quickfire's Library card offers Host a party, which opens the Host tab with Quickfire picked", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await page.getByRole("link", { name: /^Quickfire\b/ }).click();
  const card = page.getByRole("dialog");
  await expect(card.getByRole("heading", { name: "Quickfire" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Host a party", exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: "Quick Match", exact: true })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "Duel a friend", exact: true })).toHaveCount(0);
  await page.screenshot({ path: "docs/qa/screens/r4/r4-08-card-375.png" });
  await card.getByRole("button", { name: "Host a party", exact: true }).click();
  await page.waitForURL(/\/party\?host=1&game=quickfire/);
  // The Host tab opens with Quickfire picked (a score race, "most points wins").
  await expect(page.getByRole("radio", { name: /^Quickfire, most points wins/ })).toBeChecked();
});

test("Quickfire's Challenge sheet on its world page offers only Host a party", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/world/word");
  await page.getByRole("button", { name: "Challenge someone to Quickfire" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: /Host a party/ })).toBeVisible();
  await expect(sheet.getByRole("link", { name: /Quick Match/ })).toHaveCount(0);
  await expect(sheet.getByRole("link", { name: /Duel a friend/ })).toHaveCount(0);
  await expect(sheet.getByText(/Most points wins/).first()).toBeVisible();
  await sheet.getByRole("link", { name: /Host a party/ }).click();
  await page.waitForURL(/\/party\?host=1&game=quickfire/);
});

test("a time game's card keeps all three ways to race", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/library");
  await page.getByRole("link", { name: /^Sixer\b/ }).click();
  const card = page.getByRole("dialog");
  for (const name of ["Quick Match", "Duel a friend", "Host a party"])
    await expect(card.getByRole("button", { name, exact: true })).toBeVisible();
});
