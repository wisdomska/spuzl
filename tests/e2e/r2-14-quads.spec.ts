import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS, onboardGuest, openTestBoard, quadsSolveGroups, quadsTile, runAxe, solveSeeded, waitForBoard } from "./harness";
import { createRng } from "@/lib/rng";
import { generate } from "@/games/quads/logic";
import { PRACTICE_GROUPS } from "@/games/quads/practice";

/**
 * R2-14 Quads is back: the practice round on first open, a seeded board solved through real taps, answer
 * feedback under 600 ms (measured in the page by the board: Submit to feedback on screen), colour-blind mode
 * labels and patterns, axe on the board, and screenshots at 375 and 1280 for the QA report.
 * The seeded boards use the /dev/board fixture (ENABLE_DEV_ROUTES=1 or a non-production build).
 */
const SHOTS = "docs/qa/screens/r2";
const FEEDBACK_BUDGET_MS = 600;
const board = (page: Page) => page.locator("[data-feedback-n]");
const lastMs = async (page: Page) => Number(await board(page).getAttribute("data-feedback-ms"));

test("first open is a practice round of two groups, then the real board", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize(VIEWPORTS.phone);
  await onboardGuest(page, { guided: true });
  await page.goto("/play/quads?mode=free");
  await expect(page.getByText("First time playing Quads?")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("option")).toHaveCount(8);
  await page.screenshot({ path: `${SHOTS}/R2-14-practice-375.png` });
  await quadsSolveGroups(
    page,
    PRACTICE_GROUPS.map((g) => g.words),
  );
  await expect(page.getByText("You've got it!")).toBeVisible();
  await page.getByRole("button", { name: "Start playing" }).click();
  await waitForBoard(page, 45_000);
  await expect(page.getByRole("option")).toHaveCount(16);
  await expect(page.getByText("First time playing Quads?")).toHaveCount(0);
});

for (const [size, viewport] of Object.entries(VIEWPORTS)) {
  test(`seeded board: feedback under ${FEEDBACK_BUDGET_MS} ms, one away, solved (${size})`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await openTestBoard(page, "quads", "qa", "medium");
    const g = generate(createRng("qa"), "medium").solution.groups.map((x) => x.words);
    const times: number[] = [];

    // A plain miss: two and two.
    await quadsSolveGroups(page, [[g[0][0], g[0][1], g[1][0], g[1][1]]]);
    await expect(board(page)).toHaveAttribute("data-feedback", "wrong");
    times.push(await lastMs(page));
    for (const w of [g[0][0], g[0][1], g[1][0], g[1][1]]) await quadsTile(page, w).click(); // put them down

    // One away: three of a group and one stray.
    await quadsSolveGroups(page, [[g[2][0], g[2][1], g[2][2], g[3][0]]]);
    await expect(board(page)).toHaveAttribute("data-feedback", "one-away");
    await expect(page.getByText(/One away\./).first()).toBeVisible();
    times.push(await lastMs(page));
    for (const w of [g[2][0], g[2][1], g[2][2], g[3][0]]) await quadsTile(page, w).click();

    // Then every group, Easy to Tricky.
    for (const words of g) {
      await quadsSolveGroups(page, [words]);
      await expect(board(page)).toHaveAttribute("data-feedback", "correct");
      times.push(await lastMs(page));
    }
    await expect(page.locator("[data-quad]")).toHaveCount(4);
    for (const t of times) expect(t, `feedback took ${t} ms`).toBeLessThan(FEEDBACK_BUDGET_MS);
    // The page's own measure agrees.
    const measured = await page.evaluate(() => performance.getEntriesByName("quads:feedback").map((e) => e.duration));
    expect(measured.length).toBeGreaterThanOrEqual(times.length);
    for (const t of measured) expect(t).toBeLessThan(FEEDBACK_BUDGET_MS);
    await page.screenshot({ path: `${SHOTS}/R2-14-solved-${viewport.width}.png` });
  });
}

test("solveSeeded plays a Quads board through real taps", async ({ page }) => {
  await solveSeeded(page, "quads", "qa2", "easy");
  await expect(page.locator("[data-quad]")).toHaveCount(4);
});

test("colour-blind mode: every level is labelled, shaped and patterned; axe on the board", async ({ page }) => {
  test.setTimeout(90_000);
  for (const viewport of Object.values(VIEWPORTS)) {
    await page.setViewportSize(viewport);
    await openTestBoard(page, "quads", "cb", "hard");
    await page.evaluate(() => (document.documentElement.dataset.cb = "deutan"));
    const groups = generate(createRng("cb"), "hard").solution.groups;
    await quadsSolveGroups(
      page,
      groups.map((x) => x.words),
    );
    const levels = ["Easy", "Medium", "Hard", "Tricky"];
    for (let i = 0; i < 4; i++) {
      const bar = page.locator(`[data-quad="${i}"]`);
      await expect(bar).toContainText(levels[i]);
      await expect(bar).toContainText(groups[i].label);
      await expect(bar.locator("[data-level-tag] svg")).toHaveCount(1);
      await expect(bar).toHaveAttribute("aria-label", new RegExp(`^${levels[i]} group: `));
      const look = await bar.evaluate((el) => getComputedStyle(el).backgroundImage);
      expect(look, `level ${i} has a pattern`).not.toBe("none");
    }
    // Four different fills.
    const fills = await page.locator("[data-quad]").evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(new Set(fills).size).toBe(4);
    expect(await runAxe(page, { include: "main" })).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/R2-14-colourblind-${viewport.width}.png` });
  }
});

test("axe on a fresh board with four words lifted", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.phone);
  await openTestBoard(page, "quads", "qa", "easy");
  const g = generate(createRng("qa"), "easy").solution.groups;
  for (const w of g[1].words) await quadsTile(page, w).click();
  await expect(page.getByRole("option", { selected: true })).toHaveCount(4);
  expect(await runAxe(page, { include: "main" })).toEqual([]);
  await page.screenshot({ path: `${SHOTS}/R2-14-board-375.png` });
});
