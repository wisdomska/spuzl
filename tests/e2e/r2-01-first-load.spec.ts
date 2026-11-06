import { expect, test } from "@playwright/test";
import { keepFocus, onboardGuest, throttle, waitForBoard } from "./harness";

/**
 * R2-01 instant first game load: on a cold tap from Home the skeleton covers the screen at once, the game's data
 * request starts with the tap, sound effects and music wait until the board is ready, and /today is asked for at
 * most once. (The timing targets themselves are measured by tests/perf/r2-baseline.spec.ts.)
 */
test("cold Continue: skeleton on the tap frame, board first, audio after, one /today", async ({ browser }, info) => {
  test.setTimeout(180_000);
  const setup = await browser.newContext();
  const sp = await setup.newPage();
  await onboardGuest(sp);
  const state = await setup.storageState();
  await setup.close();

  const ctx = await browser.newContext({ storageState: state, viewport: info.project.use.viewport ?? undefined });
  const page = await ctx.newPage();
  await keepFocus(page);
  if (info.project.name.includes("375")) await throttle(page, "4g");
  const seen: { url: string; at: number }[] = [];
  page.on("request", (r) => seen.push({ url: new URL(r.url()).pathname, at: Date.now() }));

  await page.goto("/");
  const play = page.locator('main a[href^="/play/"]').first();
  await play.waitFor();
  await page.waitForTimeout(1500);
  const tapAt = Date.now();
  await play.click();
  // the skeleton (or the Play route itself) is up straight away: the Home map is never left showing
  await expect(page.locator("[data-tap-skeleton], [aria-label='Loading the game'], [role=grid]").first()).toBeVisible({ timeout: 1000 });
  await waitForBoard(page, 60_000);
  const boardAt = Date.now();

  const after = seen.filter((s) => s.at >= tapAt);
  const audioBeforeBoard = after.filter((s) => s.at < boardAt && /^\/(sfx|music)\//.test(s.url));
  expect(audioBeforeBoard, "no sound or music downloads before the board").toEqual([]);
  const attempts = after.find((s) => s.url === "/api/v1/attempts");
  expect(attempts, "the attempt starts with the tap").toBeTruthy();
  expect(after.filter((s) => s.url === "/api/v1/today").length).toBeLessThanOrEqual(1);
  await ctx.close();
});
