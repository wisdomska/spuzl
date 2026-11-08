import { expect, test, type Page } from "@playwright/test";
import { GAMES, LAB_GAMES } from "@/lib/catalog";
import { labCopy } from "@/lib/copy/lab";
import { admin } from "../api/helpers";
import { onboardGuest, openTestBoard, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R3-05 Lab tag. A switched-on lab game ("features.labGames") carries a small "NEW" tag in All games
 * (the Library row and its card), on its world screen tile and in the game header, so players expect changes. Live
 * games never do. The tag's words are part of the row link's accessible name.
 *
 * The seeded-board checks need no database. The rest sets the setting straight in game_settings (like
 * r2-p5-lab-games.spec.ts) and puts the old value back: run with --workers=1. Screenshots:
 * docs/qa/screens/r2/r3-05-<name>-<375|1280>.png.
 */
const KEY = "features.labGames";
const LAB = LAB_GAMES[0];
const LIVE = GAMES[0];
const TAG = /\bNEW\b/;
const tag = (page: Page) => page.locator("[data-lab-tag]");
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r3-05-${name}-${w}.png` });

test.describe("game header (seeded boards)", () => {
  test("a lab game's header carries the tag, a live game's does not", async ({ page }) => {
    await openTestBoard(page, LAB.id, "r3-05");
    const header = page.locator("header").first();
    await expect(header.locator("[data-lab-tag]")).toHaveText(new RegExp(labCopy.tag));
    // The top bar keeps its height: the tag rides on the 16 px label line.
    const box = (await header.locator("[data-lab-tag]").boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(16);
    await shot(page, "header", page.viewportSize()!.width);

    await openTestBoard(page, LIVE.id, "r3-05");
    await expect(tag(page)).toHaveCount(0);
  });
});

test.describe("switched on for players", () => {
  test.describe.configure({ mode: "serial" });
  let before: unknown = undefined;
  const setLab = async (ids: string[]) => {
    const { error } = await admin().from("game_settings").upsert({ key: KEY, value: ids }, { onConflict: "key" });
    if (error) throw error;
  };
  test.beforeAll(async () => {
    const { data } = await admin().from("game_settings").select("value").eq("key", KEY).maybeSingle();
    before = data?.value;
    await setLab([LAB.id]);
  });
  test.afterAll(async () => {
    if (before === undefined) await admin().from("game_settings").delete().eq("key", KEY);
    else await setLab(before as string[]);
  });

  for (const [label, vp] of Object.entries(VIEWPORTS)) {
    test(`Library row and card, world tile, game header (${label})`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(vp);
      await onboardGuest(page);

      await page.goto("/library");
      await page.getByRole("searchbox").fill(LAB.name);
      const row = page.getByRole("link", { name: new RegExp(`^${LAB.name}\\b`) }).first();
      await expect(row).toBeVisible();
      await expect(row).toHaveAccessibleName(TAG);
      await expect(row.locator("[data-lab-tag]")).toBeVisible();
      await shot(page, "library-row", vp.width);
      await row.click();
      await expect(page.getByRole("dialog").locator("[data-lab-tag]")).toBeVisible();
      await shot(page, "library-card", vp.width);
      await page.keyboard.press("Escape");

      // A live game's row has no tag.
      await page.getByRole("searchbox").fill(LIVE.name);
      const live = page.getByRole("link", { name: new RegExp(`^${LIVE.name}\\b`) }).first();
      await expect(live).toBeVisible();
      await expect(live.locator("[data-lab-tag]")).toHaveCount(0);
      await expect(live).not.toHaveAccessibleName(TAG);

      await page.goto(`/world/${LAB.world}`);
      const tile = page.locator("li", { has: page.getByText(LAB.name, { exact: true }) }).first();
      await expect(tile.locator("[data-lab-tag]")).toBeVisible();
      await expect(tile.getByRole("link").first()).toHaveAccessibleName(TAG);
      // Only lab games are tagged on the world screen.
      await expect(tag(page)).toHaveCount(1);
      await shot(page, "world", vp.width);

      await page.goto(`/play/${LAB.id}?mode=free`);
      const skip = page.getByRole("button", { name: `Skip the ${LAB.name} practice round` });
      const practice = await skip
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (practice) await skip.click();
      await waitForBoard(page, 45_000);
      await expect(page.locator("header").first().locator("[data-lab-tag]")).toBeVisible();
    });
  }
});
