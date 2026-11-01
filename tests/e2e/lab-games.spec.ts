import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { onboardGuest, waitForBoard } from "./harness";
import { LAB_GAMES } from "@/lib/catalog";

/**
 * Phase 5 games behind "features.newGames": with it on, every lab game shows in All games and plays inside the
 * shell (one timer); Dara also offers a full game vs bot. With it off they are hidden and refused.
 * Needs the server to read settings without a cache (development, or SETTINGS_CACHE_MS=0). It flips a shared
 * setting, so run it with --workers=1.
 */
const setFlag = (on: boolean) =>
  execSync(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -qc "insert into game_settings(key,value) values ('features.newGames','${on}') on conflict (key) do update set value='${on}'"`,
  );

test.describe.configure({ mode: "serial" });

test("new games: on, every lab game opens and plays in the shell; off, hidden and refused", async ({ page }) => {
  test.setTimeout(600_000);
  await onboardGuest(page);
  try {
    setFlag(true);
    await page.goto("/library");
    await expect(page.getByText(`${51 + LAB_GAMES.length} games`)).toBeVisible();
    for (const g of LAB_GAMES) {
      await page.goto(`/play/${g.id}?mode=free`);
      await waitForBoard(page, 45_000);
      await expect(page.getByRole("timer")).toHaveCount(1);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${g.id} scrolls sideways`).toBe(false);
    }
    await page.goto("/play/dara/bot");
    await expect(page.getByRole("radiogroup", { name: "Bot level" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("gridcell", { name: "Row 1, column 1, empty, drop here" }).click();
    await expect(page.getByText(/In hand: you 11/)).toBeVisible({ timeout: 15_000 });
  } finally {
    setFlag(false);
  }
  await page.goto("/library");
  await expect(page.getByText("51 games")).toBeVisible();
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
