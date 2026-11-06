import { expect, test, type Page } from "@playwright/test";
import { keepFocus, seededBoardUrl, VIEWPORTS } from "./harness";
import { createRng } from "@/lib/rng";
import emojihits from "@/games/emojihits/logic";

/**
 * R2-17 Emoji Hits: one input per mode, said on screen. The practice round picks from four ("Pick the answer",
 * no typing box); scored rounds are typed ("Type the answer", no options). The hint is cleared once its round is
 * over, and the clock starts on Start (the practice round's idle hint can't start it before). Runs on the seeded
 * /dev/board fixture (ENABLE_DEV_ROUTES=1): `mode=tutorial` is the practice round, the default is a free round.
 * The server side (picks refused on scored boards, scored boards served without options) is in
 * tests/api/guess-tokens.test.ts and the unit tests.
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r2-17-emojihits-one-input.spec.ts
 */

const SEED = "qa";
const { puzzle, solution } = emojihits.generate(createRng(SEED), "easy");
const shots = "docs/qa/screens/r2";

async function open(page: Page, mode: "free" | "tutorial") {
  await page.goto(`${seededBoardUrl("emojihits", SEED)}${mode === "tutorial" ? "&mode=tutorial" : ""}`);
  const start = page.getByRole("button", { name: /^Start\b/ });
  await expect(start).toBeVisible({ timeout: 30_000 });
  return start;
}

const clock = (page: Page) => page.locator('[role="timer"]').first();
const clockText = async (page: Page) => ((await clock(page).count()) ? await clock(page).getAttribute("aria-label") : null);

test.describe("R2-17 Emoji Hits", () => {
  test.beforeEach(async ({ page }) => {
    await keepFocus(page);
  });

  test("practice: pick the answer from four, no typing box", async ({ page }) => {
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      const start = await open(page, "tutorial");
      await expect(page.locator('[data-input-mode="pick"]')).toHaveText(/Pick the answer/);
      await expect(page.getByRole("textbox", { name: "Type the title" })).toHaveCount(0);
      await start.click();
      const options = page.getByRole("group", { name: "Pick a title" });
      await expect(options.getByRole("button")).toHaveCount(4);
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await page.screenshot({ path: `${shots}/R2-17-practice-pick-${vp.width}.png` });
      const title = solution.answers[0][0];
      const k = puzzle.rounds[0].options!.indexOf(title);
      await options.getByRole("button", { name: new RegExp(`^${"ABCD"[k]}, `) }).click();
      await expect(page.getByText(`Yes! ${title}.`).first()).toBeVisible();
    }
  });

  test("a scored round: type the answer, no options", async ({ page }) => {
    for (const vp of [VIEWPORTS.phone, VIEWPORTS.desktop]) {
      await page.setViewportSize(vp);
      const start = await open(page, "free");
      await expect(page.locator('[data-input-mode="type"]')).toHaveText(/Type the answer/);
      await start.click();
      const box = page.getByRole("textbox", { name: "Type the title" });
      await expect(box).toBeEnabled();
      await expect(page.getByRole("group", { name: "Pick a title" })).toHaveCount(0);
      await page.screenshot({ path: `${shots}/R2-17-scored-type-${vp.width}.png` });
      const title = solution.answers[0][0];
      await box.fill(title.toLowerCase());
      await page.getByRole("button", { name: "Guess" }).click();
      await expect(page.getByText(`Yes! ${title}.`).first()).toBeVisible();
    }
  });

  test("the hint goes once its round is over", async ({ page }) => {
    const start = await open(page, "tutorial");
    await start.click();
    await expect(page.getByRole("group", { name: "Pick a title" })).toBeVisible();
    await page.getByRole("button", { name: /^Hint\b/ }).click();
    const clue = solution.clues[0];
    await expect(page.getByText(clue).first()).toBeVisible();
    // answer the round (any pick: right or wrong, three wrong ones end it too)
    const title = solution.answers[0][0];
    const k = puzzle.rounds[0].options!.indexOf(title);
    await page
      .getByRole("group", { name: "Pick a title" })
      .getByRole("button", { name: new RegExp(`^${"ABCD"[k]}, `) })
      .click();
    await expect(page.getByText(`Yes! ${title}.`).first()).toBeVisible();
    await expect(page.getByText(clue)).toHaveCount(0);
    // the next round opens on its own, still with no clue from round 1
    await expect(page.getByText(/^Round 2 of 5$/).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(clue)).toHaveCount(0);
    await page.screenshot({ path: `${shots}/R2-17-hint-cleared-${VIEWPORTS.phone.width}.png` });
  });

  test("the clock starts on Start, not before (not even the practice round's idle hint)", async ({ page }) => {
    test.setTimeout(60_000);
    for (const mode of ["tutorial", "free"] as const) {
      const start = await open(page, mode);
      const before = await clockText(page);
      // longer than the practice round's idle-hint wait (15 s)
      await page.waitForTimeout(mode === "tutorial" ? 17_000 : 3000);
      expect(await clockText(page)).toBe(before);
      await expect(page.getByText(solution.clues[0])).toHaveCount(0);
      await start.click();
      if (before !== null) await expect.poll(() => clockText(page), { timeout: 5000 }).not.toBe(before);
    }
  });
});
