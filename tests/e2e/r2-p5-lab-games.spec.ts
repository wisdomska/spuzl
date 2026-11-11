import { expect, test, type Page } from "@playwright/test";
import { GAME_BY_ID, GAME_COUNT } from "@/lib/catalog";
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
 * R2-P5 brought eleven retired games back as lab games behind "features.labGames", and part B added Two Truths and a
 * Lie. All twelve graduated to live on 11 Nov 2026 (migration 20261211300101): with the setting empty they show in All
 * games and on their worlds, open, run their practice round (played through by the harness solver where there is
 * one, skipped otherwise) and play in the shell (one timer, the rule line). A value stored before the graduation
 * (naming the twelve) changes nothing. Every one's seeded /dev/board renders, and the ones with a solver clear it.
 *
 * Sets the setting straight in game_settings, as tests/api/setup.ts setSetting does, and puts the old value back.
 * Needs a server with a database and dev routes, reading settings without a cache (development, or
 * SETTINGS_CACHE_MS=0). It flips a shared setting, so run it with --workers=1. The lead runs it.
 * Screenshots: docs/qa/screens/r2/r2-p5-<name>-<375|1280>.png.
 */
const KEY = "features.labGames";
const ALL = ["five", "hilo", "penalty", "market", "lightup", "killer", "dara", "pinned", "flagged", "tripwire", "pixl", "twotruths"];
const GRADUATED = ALL.map((id) => GAME_BY_ID[id]);
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

test("graduated: live with the setting empty, and a stale stored value changes nothing", async ({ page }) => {
  test.setTimeout(120_000);
  await onboardGuest(page);
  for (const value of [[], ALL]) {
    await setLab(value);
    await page.goto("/library");
    await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();
    await page.getByRole("searchbox").fill("five");
    await expect(page.getByRole("link", { name: /^Five / })).toHaveCount(1);
    for (const path of ["/play/five?mode=free", "/play/dara/bot", "/play/pixl?mode=free"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.getByRole("heading", { name: NOT_FOUND }), path).toHaveCount(0);
    }
    const status = await page.evaluate(async () => {
      const start = await fetch("/api/v1/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: "five", mode: "free" }),
      });
      const guided = await fetch("/api/v1/guided/hilo");
      return [start.status, guided.status];
    });
    expect(status).toEqual([200, 200]);
  }
});

test("each graduated game opens, runs its practice round and plays in the shell", async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize(VIEWPORTS.phone);
  await setLab([]);
  await keepFocus(page);
  // Practice rounds kept (guided), so each first open starts with one.
  await onboardGuest(page, { guided: true });
  await page.goto("/library");
  await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();

  for (const g of GRADUATED) {
    await test.step(g.id, async () => {
      await page.goto(`/play/${g.id}?mode=free`);
      // A photosensitive game would show the one-time notice first.
      if (g.photosensitive) {
        const notice = page.getByRole("alertdialog").getByRole("button", { name: "Got it" });
        const shown = await notice
          .waitFor({ state: "visible", timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        if (shown) await notice.click();
      }
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
      // One header timer, still waiting: no board starts the clock before the first move (R2-15).
      await expectOneTimer(page);
      await expect(page.getByRole("timer")).toHaveAttribute("data-timer", "waiting");
      // The one-line rule under the title until the first move (R2-06).
      await expect(page.getByText(g.rule).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `${g.id} scrolls sideways`).toBe(false);
    });
  }
});

test("every graduated game's seeded board renders, and the ones with a solver clear it", async ({ page }) => {
  test.setTimeout(600_000);
  await keepFocus(page);
  for (const g of GRADUATED) {
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
    await setLab([]);
    await keepFocus(page);
    await onboardGuest(page);
    await page.goto("/library");
    await expect(page.getByText(`${GAME_COUNT} games`)).toBeVisible();
    await shot(page, "library", vp.width);
    // Dara shows on Board Games, after Four Up.
    await page.goto("/world/board");
    await expect(page.locator("main li").filter({ hasText: "Dara" })).toHaveCount(1);
    await shot(page, "world-board", vp.width);
    await page.goto("/play/hilo?mode=free");
    await waitForBoard(page, 45_000);
    await expectOneTimer(page);
    await shot(page, "hilo", vp.width);
    await openTestBoard(page, "killer", "qa");
    await shot(page, "killer-board", vp.width);
  });
}
