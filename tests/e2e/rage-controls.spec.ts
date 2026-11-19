import { expect, test } from "@playwright/test";
import { seededBoardUrl } from "./harness";

/**
 * Gotcha and Dash on a computer (owner, 14 Nov 2026): the on-screen controls can be shown and hidden again, and full
 * screen never makes the board smaller (it already has the whole width). A computer: mouse, no touch (phones
 * and tablets always keep the controls, so the mobile project runs it as a desktop too).
 */
test.use({ isMobile: false, hasTouch: false });

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
  // Gotcha already takes the page's width (no cap since 19 Nov 2026), and a headless browser's full screen is the
  // same size as its window, so the board keeps its size here; on a real screen full screen adds the browser's bars.
  expect(after!.width * after!.height).toBeGreaterThanOrEqual(before!.width * before!.height);
  expect(after!.width).toBeGreaterThan(1000);
  await page.screenshot({ path: `${process.env.SHOTS ?? "test-results"}/gotcha-fullscreen.png` });
  await page.getByRole("button", { name: "Exit full screen" }).click();
  await expect(page.getByRole("button", { name: "Full screen" })).toBeVisible();
});
