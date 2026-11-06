import { expect, test } from "@playwright/test";
import { onboardGuest, waitForBoard } from "./harness";
import { GAME_COUNT, WORLD_COUNT, WORLD_BY_ID } from "@/lib/catalog";

/**
 * The 2026-11 catalogue change: 29 live games (28 once Gauntlet went, 29 again with Quads back in R2-14), since regrouped into 4 worlds. Retired games and the emptied Number
 * Den are gone from every list and their pages are not found; Trotro Jam, Emoji Hits and Beat Tap play like any live game, with no
 * admin setting needed.
 */
const NOT_FOUND = "This page could not be found.";

test("retired games are hidden and refused; the promoted games play", async ({ page }) => {
  test.setTimeout(240_000);
  await onboardGuest(page);

  // All games: the live count, no retired names, no Number Den chip.
  await page.goto("/library");
  await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();
  for (const name of ["Pinned", "Pixl", "Dead On", "Hunch", "Flip"])
    await expect(page.getByRole("button", { name: new RegExp(`^${name} `) })).toHaveCount(0);
  await expect(page.getByRole("button", { name: WORLD_BY_ID.number.name })).toHaveCount(0);
  await page.getByRole("searchbox").fill("pinned");
  await expect(page.getByText("No games match.", { exact: false })).toBeVisible();

  // Home: one island per live world.
  await page.goto("/");
  await expect(page.locator("[data-world]")).toHaveCount(WORLD_COUNT);
  await expect(page.locator('[data-world="number"]')).toHaveCount(0);

  // Not found: a retired game's play and bot pages, the empty world, a retired ghost track.
  for (const path of ["/play/pinned?mode=free", "/play/flip/bot", "/world/number", "/ghost/flipside"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: NOT_FOUND }), path).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
  }

  // The server refuses to start one.
  const start = await page.evaluate(async () => {
    const r = await fetch("/api/v1/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "pinned", mode: "free" }),
    });
    return r.status;
  });
  expect(start).toBe(404);

  // Trotro Jam's old single-game world now leads to Puzzles, and the promoted games play.
  await page.goto("/world/shape");
  await expect(page).toHaveURL(/\/world\/logic$/);
  await expect(page.getByRole("heading", { name: WORLD_BY_ID.logic.name })).toBeVisible();
  await expect(page.locator("main li").filter({ hasText: "Trotro Jam" })).toHaveCount(1);

  for (const id of ["trotro", "emojihits", "beattap"]) {
    await page.goto(`/play/${id}?mode=free`);
    await waitForBoard(page, 45_000);
    await expect(page.getByRole("timer"), id).toHaveCount(1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `${id} scrolls sideways`).toBe(false);
  }
});
