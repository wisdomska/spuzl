import { expect, test, type Page } from "@playwright/test";
import { openTestBoard, seededBoardUrl } from "./harness";

/**
 * Lab games switched on for players fit every screen like the live games: no page scroll and the tool bar fully on
 * screen at 320 × 568, 375 × 667, 390 × 844 and 1280 × 800 (the wide two-column shell), with 44 px tools. Measured
 * on the /dev/board fixtures (no guests). Quickfire shares the quiz board with Flagged and Two Truths, so it is
 * checked too, and the three quiz games are also played through to the summary at 320 × 568 (every round, reveal
 * and the long Two Truths verdict must fit, not just the start card).
 * Screenshots: docs/qa/screens/r2/r5-lab-fit-<game>-<width>.png.
 */
const SCREENS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
] as const;
const LAB = ["five", "hilo", "penalty", "market", "lightup", "killer", "dara", "pinned", "flagged", "tripwire", "pixl", "twotruths"];
const SHARED = ["quickfire"];
const QUIZ = ["flagged", "twotruths", "quickfire"];

async function settle(page: Page) {
  // The height fits (useFitHeight) step in layout effects; give them a few frames and the rule's first paint.
  await page.waitForTimeout(800);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

/** px the page scrolls past the viewport, and the lowest tool bar button's bottom (0 without one). */
const measure = (page: Page) =>
  page.evaluate(() => {
    const tails = [...document.querySelectorAll("[data-shell-tail] button, [data-shell-aside] button")];
    const boxes = tails.map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0);
    return {
      over: document.documentElement.scrollHeight - window.innerHeight,
      side: document.documentElement.scrollWidth - window.innerWidth,
      inner: window.innerHeight,
      toolsBottom: Math.round(Math.max(0, ...boxes.map((r) => r.bottom))),
      shortest: Math.round(Math.min(999, ...boxes.map((r) => r.height))),
    };
  });

for (const vp of SCREENS) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: vp.width < 900 });

    for (const id of [...LAB, ...SHARED]) {
      test(`${id}: no page scroll, the tool bar on screen`, async ({ page }) => {
        await openTestBoard(page, id);
        await settle(page);
        const m = await measure(page);
        expect(m.over, `page scrolls ${m.over} px`).toBeLessThanOrEqual(0);
        expect(m.side, `sideways scroll ${m.side} px`).toBeLessThanOrEqual(0);
        expect(m.toolsBottom, "tool bar below the fold").toBeLessThanOrEqual(m.inner);
        expect(m.shortest, "a tool under 44 px").toBeGreaterThanOrEqual(44);
        await page.screenshot({ path: `docs/qa/screens/r2/r5-lab-fit-${id}-${vp.width}.png` });
      });
    }
  });
}

test.describe("quiz games played through at 320 × 568", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });

  for (const id of QUIZ) {
    test(`${id}: every round, reveal and the summary fit`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(seededBoardUrl(id));
      await page.getByRole("button", { name: /^Start\b/ }).click();
      let worst = 0;
      const answers = page.getByRole("group", { name: /answers/i }).getByRole("button");
      for (let k = 0; k < 40; k++) {
        // Past the reading floor, then answer A (right or wrong, both reveal a verdict line).
        await page.waitForTimeout(1200);
        worst = Math.max(worst, (await measure(page)).over);
        const live = answers.and(page.locator(":not([disabled])")).first();
        if (await live.count()) {
          await live.click();
          await page.waitForTimeout(400);
          worst = Math.max(worst, (await measure(page)).over);
        } else if (!(await answers.count())) break; // the summary
      }
      expect(worst, `the page scrolled ${worst} px during the run`).toBeLessThanOrEqual(0);
    });
  }
});
