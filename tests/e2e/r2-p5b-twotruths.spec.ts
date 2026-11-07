import { expect, test, type Page } from "@playwright/test";
import { admin } from "../api/helpers";
import { expectOneTimer, keepFocus, onboardGuest, openTestBoard, playSeeded, solveSeeded, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-P5 part B: Two Truths and a Lie, an all-ages lab game behind "features.labGames" (id twotruths). Preset
 * statements only: every player, under-16s included, picks; nobody types. Answers are judged on the server.
 *
 * Sets the setting straight in game_settings (as r2-p5-lab-games.spec.ts does) and puts the old value back. Needs a
 * server with a database and dev routes, reading settings without a cache (development, or SETTINGS_CACHE_MS=0).
 * Run it with --workers=1. Screenshots: docs/qa/screens/r2/r2-p5b-twotruths-<name>-<375|1280>.png.
 */
const KEY = "features.labGames";
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-p5b-twotruths-${name}-${w}.png` });

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

test("the seeded test board plays through in the shell and clears", async ({ page }) => {
  test.setTimeout(120_000);
  await keepFocus(page);
  await openTestBoard(page, "twotruths", "qa");
  await expectOneTimer(page);
  await expect(page.getByText("Three statements, two of them true.", { exact: false }).first()).toBeVisible();
  await solveSeeded(page, "twotruths", "qa");
  await expect(page.locator("main.shell-solved")).toHaveCount(1, { timeout: 20_000 });
});

test("switched off it is not found; switched on an under-16 plays the practice round with picks only", async ({ page }) => {
  test.setTimeout(180_000);
  await setLab([]);
  await keepFocus(page);
  await onboardGuest(page, { age: "13-15", guided: true });
  await page.goto("/play/twotruths?mode=free");
  await expect(page.getByRole("heading", { name: "This page could not be found." })).toBeVisible();

  await setLab(["twotruths"]);
  await page.goto("/play/twotruths?mode=free");
  await expect(page.getByText("First time playing Two Truths and a Lie?")).toBeVisible({ timeout: 45_000 });
  await waitForBoard(page, 45_000);
  await playSeeded(page, "twotruths", "tutorial:twotruths");
  // Picks only: no text box anywhere in the game, whatever the player's age.
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByText("You've got it!")).toBeVisible({ timeout: 30_000 });
});

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test(`screenshots at ${vp.width} px (${label})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    await keepFocus(page);
    await openTestBoard(page, "twotruths", "qa");
    await shot(page, "ready", vp.width);
    await page.getByRole("button", { name: /^Start\b/ }).click();
    await expect(page.getByRole("group", { name: "Answers" }).getByRole("button")).toHaveCount(3);
    await shot(page, "round", vp.width);
    // Answer the first round wrong on purpose: the lie and what is true instead show under the board.
    await page.waitForTimeout(600);
    await page.getByRole("group", { name: "Answers" }).getByRole("button").first().click();
    await expect(page.getByRole("img", { name: "1 of 5 answered" })).toBeVisible();
    await shot(page, "answered", vp.width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow).toBe(false);
  });
}
