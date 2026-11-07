import { expect, test, type Page } from "@playwright/test";
import { createRng } from "@/lib/rng";
import { generate } from "@/games/azonto/logic";
import { admin } from "../api/helpers";
import { expectOneTimer, keepFocus, onboardGuest, openTestBoard, playSeeded, solveSeeded, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-P5 part B: Azonto Steps, a lab game behind "features.labGames" (id azonto). Spuz dances the moves on the
 * beat, the player repeats them on four labelled buttons (or keys 1 to 4 and the arrows), one more move each round.
 * Reduced motion keeps Spuz still and leaves the highlighted move label.
 *
 * Flips "features.labGames" in game_settings and puts it back; run with --workers=1 against a server with a database
 * and dev routes. Screenshots: docs/qa/screens/r2/r2-p5b-azonto-<name>-<375|1280>.png.
 */
const KEY = "features.labGames";
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-p5b-azonto-${name}-${w}.png` });

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

test("the seeded test board plays two rounds by tapping, then a slip ends the run and it clears", async ({ page }) => {
  test.setTimeout(120_000);
  await keepFocus(page);
  await openTestBoard(page, "azonto", "qa");
  await expectOneTimer(page);
  await expect(page.getByRole("timer")).toHaveAttribute("data-timer", "waiting");
  // Every move is a real button with its name, arrow and key.
  for (const name of ["Iron, left arrow, key 1", "Phone call, up arrow, key 2", "Wash, right arrow, key 3", "Boxing, down arrow, key 4"])
    await expect(page.getByRole("button", { name })).toBeVisible();
  await solveSeeded(page, "azonto", "qa");
  await expect(page.locator("main.shell-solved")).toHaveCount(1, { timeout: 20_000 });
});

test("keys 1 to 4 and the arrows play moves", async ({ page }) => {
  test.setTimeout(90_000);
  await keepFocus(page);
  await openTestBoard(page, "azonto", "keys");
  const p = generate(createRng("keys"), "easy").puzzle;
  const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
  await page.getByRole("button", { name: /^Start\b/ }).click();
  const pad = page.getByRole("group", { name: "Azonto moves" });
  await expect(pad.getByRole("button").first()).toBeEnabled({ timeout: 30_000 });
  // round 1 by number key, round 2 by arrows
  await page.keyboard.press(String(p.seq[0] + 1));
  // the round is repeated: Spuz dances round 2, then the pad opens again
  await expect(pad.getByRole("button").first()).toBeDisabled();
  await expect(pad.getByRole("button").first()).toBeEnabled({ timeout: 30_000 });
  for (let k = 0; k < 2; k++) {
    await page.keyboard.press(keys[p.seq[k]]);
    await page.waitForTimeout(160);
  }
  await expect(page.getByText("Watch", { exact: true }).first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  expect(overflow).toBe(false);
});

test("reduced motion: Spuz stands still and the move label carries the dance", async ({ browser }) => {
  test.setTimeout(60_000);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await openTestBoard(page, "azonto", "qa");
  await page.getByRole("button", { name: /^Start\b/ }).click();
  await expect(page.locator("[data-now]:not([data-now='none'])").first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator(".spuz-root").first()).toHaveAttribute("data-still", "true");
  await context.close();
});

test("switched on, the practice round plays in full", async ({ page }) => {
  test.setTimeout(180_000);
  await setLab(["azonto"]);
  await keepFocus(page);
  await onboardGuest(page, { age: "13-15", guided: true });
  await page.goto("/play/azonto?mode=free");
  // Like Echo, Azonto Steps shows the photosensitivity notice once (pads light on the beat, at most 2 Hz).
  await page.getByRole("alertdialog").getByRole("button", { name: "Got it" }).click({ timeout: 45_000 });
  await expect(page.getByText("First time playing Azonto Steps?")).toBeVisible({ timeout: 45_000 });
  await waitForBoard(page, 45_000);
  await playSeeded(page, "azonto", "tutorial:azonto");
  await expect(page.getByText("You've got it!")).toBeVisible({ timeout: 30_000 });
});

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test(`screenshots at ${vp.width} px (${label})`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(vp);
    await keepFocus(page);
    await openTestBoard(page, "azonto", "qa", "medium");
    await shot(page, "ready", vp.width);
    await page.getByRole("button", { name: /^Start\b/ }).click();
    await expect(page.locator("[data-now]:not([data-now='none'])").first()).toBeVisible({ timeout: 10_000 });
    await shot(page, "dancing", vp.width);
    await expect(page.getByRole("group", { name: "Azonto moves" }).getByRole("button").first()).toBeEnabled({ timeout: 30_000 });
    await shot(page, "your-turn", vp.width);
  });
}
