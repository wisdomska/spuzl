import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { onboardGuest, waitForBoard } from "./harness";
import { GAME_COUNT, LAB_GAMES } from "@/lib/catalog";

/**
 * Lab games behind "features.labGames" (a set of game ids; it replaced the all-or-nothing "features.newGames" in
 * R2-P5): with every lab id in it, every lab game shows in All games and plays inside the shell (one timer); with it
 * empty they are hidden and refused. tests/e2e/r2-p5-lab-games.spec.ts covers practice rounds and solvers.
 * Needs the server to read settings without a cache (development, or SETTINGS_CACHE_MS=0). It flips a shared
 * setting, so run it with --workers=1.
 */
const setFlag = (on: boolean) => {
  const value = JSON.stringify(on ? LAB_GAMES.map((g) => g.id) : []);
  execSync(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -qc "insert into game_settings(key,value) values ('features.labGames','${value}') on conflict (key) do update set value='${value}'"`,
  );
};

test.describe.configure({ mode: "serial" });

test("lab games: all switched on, every lab game opens and plays in the shell; none, hidden and refused", async ({ page }) => {
  test.skip(LAB_GAMES.length === 0, "no lab games right now");
  test.setTimeout(600_000);
  await onboardGuest(page);
  try {
    setFlag(true);
    await page.goto("/library");
    await expect(page.getByText(`${GAME_COUNT + LAB_GAMES.length} games`)).toBeVisible();
    for (const g of LAB_GAMES) {
      await page.goto(`/play/${g.id}?mode=free`);
      await waitForBoard(page, 45_000);
      await expect(page.getByRole("timer")).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${g.id} scrolls sideways`).toBe(false);
    }
  } finally {
    setFlag(false);
  }
  await page.goto("/library");
  await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();
  // The page streams its loading skeleton first, so the status stays 200; the content is the not-found page.
  await page.goto(`/play/${LAB_GAMES[0].id}?mode=free`);
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(0);
  // And the server refuses to start it.
  const start = await page.evaluate(async (game) => {
    const r = await fetch("/api/v1/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game, mode: "free" }),
    });
    return r.status;
  }, LAB_GAMES[0].id);
  expect(start).toBe(404);
});
