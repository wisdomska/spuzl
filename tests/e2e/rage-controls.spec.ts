import { expect, test } from "@playwright/test";
import { seededBoardUrl } from "./harness";

/**
 * Gotcha and Dash on a computer (owner, 14 Nov 2026): the on-screen controls can be shown and hidden again, and full
 * screen makes the board bigger (no width cap, the height above the controls).
 */
test("controls show and hide again; full screen grows the board", async ({ page }) => {
  await page.setViewportSize({ width: 1554, height: 732 });
  await page.goto(seededBoardUrl("gotcha", "qa", "medium"));
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Show controls" }).click();
  await expect(page.getByRole("button", { name: "Jump" })).toBeVisible();
  await page.getByRole("button", { name: "Hide controls" }).click();
  await expect(page.getByRole("button", { name: "Jump" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Show controls" })).toBeVisible();

  const before = await canvas.boundingBox();
  await page.getByRole("button", { name: "Full screen" }).click();
  await expect(page.getByRole("button", { name: "Exit full screen" })).toBeVisible();
  await page.waitForTimeout(800);
  const after = await canvas.boundingBox();
  console.log("canvas", JSON.stringify(before), "->", JSON.stringify(after));
  expect(after!.width * after!.height).toBeGreaterThan(before!.width * before!.height);
  await page.screenshot({ path: `${process.env.SHOTS ?? "test-results"}/gotcha-fullscreen.png` });
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
});
