import { expect, test } from "@playwright/test";
import { seededBoardUrl, VIEWPORTS } from "./harness";

/**
 * R4-21 Rage Ridge backdrop: the scene colour and dot grid are one texture drawn once and repeated (a TileSprite),
 * scrolled for the slow parallax, instead of ~270 circles a frame; the platformer painter makes no closures a
 * frame. Every painter that draws the backdrop (platformer: Gotcha, Dash; Ricochet; Stacked; Wobble) still boots
 * and draws with no page errors. Compare the screenshots with the earlier ones by eye: the same dark scene and
 * 20 px dot grid. Screenshots: docs/qa/screens/r2/r4-21-<game>-<375|1280>.png.
 */
const GAMES = ["gotcha", "dash", "ricochet", "stacked", "wobble"] as const;

for (const [name, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test.describe(`${name} wide`, () => {
    test.use({ viewport: vp });
    for (const id of GAMES) {
      test(`${id}: the backdrop renders from the texture, no page errors`, async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
          if (m.type() === "error" && /phaser|texture|webgl/i.test(m.text())) errors.push(m.text());
        });
        await page.goto(seededBoardUrl(id, "r4-21"));
        const canvas = page.locator("main canvas").first();
        await canvas.waitFor({ timeout: 45_000 });
        // A few frames with the camera moving (Gotcha and Dash run right on the arrow key).
        await page.keyboard.down("ArrowRight");
        await page.waitForTimeout(1200);
        await page.keyboard.up("ArrowRight");
        const box = (await canvas.boundingBox())!;
        expect(box.width).toBeGreaterThan(100);
        expect(box.height).toBeGreaterThan(100);
        await page.screenshot({ path: `docs/qa/screens/r2/r4-21-${id}-${name}.png` });
        expect(errors).toEqual([]);
      });
    }
  });
}
