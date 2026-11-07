import { expect, test, type Page } from "@playwright/test";
import { GAME_COUNT, LAB_GAMES } from "@/lib/catalog";
import { admin } from "../api/helpers";
import {
  expectOneTimer,
  hasSolver,
  keepFocus,
  onboardGuest,
  openTestBoard,
  playSeeded,
  solveSeeded,
  VIEWPORTS,
  waitForBoard,
} from "./harness";

/**
 * R2-P5 per-game lab flag. Eleven retired games came back as lab games behind "features.labGames" (a set of game
 * ids). With the setting empty a lab game is not found and the server refuses it; with its id in the set it shows
 * in All games, opens, runs its practice round (played through by the harness solver where there is one, skipped
 * otherwise) and plays in the shell (one timer, the rule line). Every lab game's seeded /dev/board renders, and
 * the ones with a solver clear it.
 *
 * Sets the setting straight in game_settings, as tests/api/setup.ts setSetting does, and puts the old value back.
 * Needs a server with a database and dev routes, reading settings without a cache (development, or
 * SETTINGS_CACHE_MS=0). It flips a shared setting, so run it with --workers=1. The lead runs it.
 * Screenshots: docs/qa/screens/r2/r2-p5-<name>-<375|1280>.png.
 */
const KEY = "features.labGames";
const ALL = LAB_GAMES.map((g) => g.id);
const NOT_FOUND = "This page could not be found.";
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-p5-${name}-${w}.png` });

async function setLab(ids: string[]) {
  const { error } = await admin().from("game_settings").upsert({ key: KEY, value: ids }, { onConflict: "key" });
  if (error) throw error;
}

let before: unknown = undefined;
test.beforeAll(async () => {
  const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
  before = data?.value;
});
test.afterAll(async () => {
  if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
  else await setLab(before as string[]);
});

test.describe.configure({ mode: "serial" });

test("the eleven are lab games (part B's new games follow them)", () => {
  expect(ALL.slice(0, 11)).toEqual([
    "five",
    "hilo",
    "penalty",
    "market",
    "lightup",
    "killer",
    "dara",
    "pinned",
    "flagged",
    "tripwire",
    "pixl",
  ]);
});

test("switched off: a lab game is hidden, not found and refused", async ({ page }) => {
  test.setTimeout(120_000);
  await setLab([]);
  await onboardGuest(page);
  await page.goto("/library");
  await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();
  await page.getByRole("searchbox").fill("five");
  await expect(page.getByRole("link", { name: /^Five / })).toHaveCount(0);

  for (const path of ["/play/five?mode=free", "/play/dara/bot", "/play/pixl?mode=free"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: NOT_FOUND }), path).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
  }
  const status = await page.evaluate(async () => {
    const start = await fetch("/api/v1/attempts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ game: "five", mode: "free" }),
    });
    const guided = await fetch("/api/v1/guided/hilo");
    const guess = await fetch("/api/games/five/guess", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref: { game: "five", t: "1.AAAA" }, guess: "CRANE" }),
    });
    return [start.status, guided.status, guess.status];
  });
  expect(status).toEqual([404, 404, 404]);
});

test("switched on: each lab game opens, runs its practice round and plays in the shell", async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize(VIEWPORTS.phone);
  await setLab(ALL);
  await keepFocus(page);
  // Practice rounds kept (guided), so each first open starts with one.
  await onboardGuest(page, { guided: true });
  await page.goto("/library");
  await expect(page.getByText(`${GAME_COUNT + ALL.length} games`)).toBeVisible();

  for (const g of LAB_GAMES) {
    await test.step(g.id, async () => {
      await page.goto(`/play/${g.id}?mode=free`);
      await expect(page.getByText(`First time playing ${g.name}?`)).toBeVisible({ timeout: 45_000 });
      if (hasSolver(g.id)) {
        // The practice board is the seeded easy board from `tutorial:<id>` (lib/game/service.ts guidedSeed): play it
        // through, then go on to the real game.
        await waitForBoard(page, 45_000);
        await playSeeded(page, g.id, `tutorial:${g.id}`, "easy");
        await expect(page.getByText("You've got it!")).toBeVisible({ timeout: 30_000 });
        await shot(page, `practice-${g.id}`, VIEWPORTS.phone.width);
        await page.getByRole("button", { name: "Start playing" }).click({ timeout: 30_000 });
      } else {
        await page.getByRole("button", { name: `Skip the ${g.name} practice round` }).click();
      }
      await waitForBoard(page, 45_000);
      // One header timer, still waiting: no lab board starts the clock before the first move (R2-15).
      await expectOneTimer(page);
      await expect(page.getByRole("timer")).toHaveAttribute("data-timer", "waiting");
      // The one-line rule under the title until the first move (R2-06).
      await expect(page.getByText(g.rule).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${g.id} scrolls sideways`).toBe(false);
    });
  }
});

test("every lab game's seeded board renders, and the ones with a solver clear it", async ({ page }) => {
  test.setTimeout(600_000);
  await keepFocus(page);
  for (const g of LAB_GAMES) {
    await test.step(g.id, async () => {
      await openTestBoard(page, g.id, "qa");
      if (!hasSolver(g.id)) return;
      await solveSeeded(page, g.id, "qa");
      await expect(page.locator("main.shell-solved"), g.id).toHaveCount(1, { timeout: 20_000 });
    });
  }
});

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test(`screenshots at ${vp.width} px (${label})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(vp);
    await setLab(["five", "hilo", "dara"]);
    await keepFocus(page);
    await onboardGuest(page);
    await page.goto("/library");
    await expect(page.getByText(`${GAME_COUNT + 3} games`)).toBeVisible();
    await shot(page, "library", vp.width);
    // A switched-on lab game shows on its world after the live games.
    await page.goto("/world/board");
    await expect(page.locator("main li").filter({ hasText: "Dara" })).toHaveCount(1);
    await shot(page, "world-board", vp.width);
    await page.goto("/play/hilo?mode=free");
    await waitForBoard(page, 45_000);
    await expectOneTimer(page);
    await shot(page, "hilo", vp.width);
    // Switched off again: gone from the list and not found.
    await setLab(["five", "dara"]);
    await page.goto("/play/hilo?mode=free");
    await expect(page.getByRole("heading", { name: NOT_FOUND })).toBeVisible();
    await openTestBoard(page, "killer", "qa");
    await shot(page, "killer-board", vp.width);
  });
}
