import { expect, test } from "@playwright/test";
import { onboardGuest } from "./harness";
import { MERGED_WORLDS, WORLDS, WORLD_BY_ID, gamesInWorld } from "@/lib/catalog";

/** World screen: one card per game with its Challenge and vs-bot actions inside it; no Daily wording. */
test("world: each game is one card with its own actions", async ({ page }, info) => {
  await onboardGuest(page);
  await page.goto("/world/logic");
  await expect(page.getByText(/of \d+ tried\./)).toBeVisible();
  await expect(page.getByText(/cleared today|Daily/)).toHaveCount(0);
  const card = page.locator("main li").first();
  await expect(card.getByRole("link").first()).toBeVisible();
  await expect(card.getByRole("group", { name: /More ways to play/ }).getByRole("button", { name: /Challenge/ })).toBeVisible();
  await page.screenshot({ path: `docs/qa/screens/after/world-logic-${info.project.name}.png` });
  await page.goto("/world/board");
  const chess = page.locator("main li").first();
  await expect(chess.getByRole("link", { name: "Play vs bot" })).toBeVisible();
  // Board Games: find someone to play live, or invite a friend, from the same card.
  await expect(chess.getByRole("link", { name: "Chess: play live against another player" })).toHaveAttribute("href", "/bay?live=chess");
  await expect(chess.getByRole("link", { name: "Chess: challenge a friend" })).toHaveAttribute("href", "/bay?new=chess");
  await page.screenshot({ path: `docs/qa/screens/after/world-board-${info.project.name}.png` });
});

/** The 2026-11 regroup: 4 islands on Home, each group's page lists its games, old world links redirect. */
test("world: the Home map shows the 4 groups and every group page works", async ({ page }, info) => {
  test.setTimeout(120_000);
  await onboardGuest(page);
  await page.goto("/");
  const islands = page.locator("[data-world]");
  await expect(islands).toHaveCount(4);
  await expect(islands).toHaveCount(WORLDS.length);
  for (const [i, w] of WORLDS.entries()) {
    const island = islands.nth(i);
    await expect(island).toHaveAttribute("data-world", w.id);
    await expect(island).toContainText(w.name);
    await expect(island).toContainText(`/${gamesInWorld(w.id).length}`);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow, "Home scrolls sideways").toBe(false);
  await page.screenshot({ path: `docs/qa/screens/after/home-groups-${info.project.name}.png`, fullPage: true });

  for (const w of WORLDS) {
    await page.goto(`/world/${w.id}`);
    await expect(page.getByRole("heading", { level: 1, name: w.name })).toBeVisible();
    await expect(page.getByText(w.tagline, { exact: false })).toBeVisible();
    const games = gamesInWorld(w.id);
    await expect(page.locator("main > ul > li")).toHaveCount(games.length);
    for (const g of games) await expect(page.locator("main > ul > li").filter({ hasText: g.name }).first(), g.id).toBeVisible();
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(sideways, `${w.id} scrolls sideways`).toBe(false);
  }

  // The folded worlds' old links land on the group that took their games.
  for (const [from, to] of Object.entries(MERGED_WORLDS)) {
    await page.goto(`/world/${from}`);
    await expect(page, from).toHaveURL(new RegExp(`/world/${to}$`));
    await expect(page.getByRole("heading", { level: 1, name: WORLD_BY_ID[to!].name })).toBeVisible();
  }
});
