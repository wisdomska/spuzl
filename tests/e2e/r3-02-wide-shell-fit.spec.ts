import { expect, test, type Page } from "@playwright/test";
import { GAME_BY_ID } from "@/lib/catalog";
import { openTestBoard } from "./harness";

/**
 * R3-02 Wide shell fits the viewport. On a laptop or desktop (the two-column shell, `[data-shell][data-wide]`) the
 * page never scrolls: the board fits under the top bar (Crownfall now counts its grid padding on both sides, which
 * left a 5 px scroll at 1280 × 800 with reduce motion), and the side panel never reaches past the viewport (tools
 * pinned at its foot, the rest scrolls inside it as a last resort). With and without reduced motion.
 *
 * Protect list: one header timer, the hint count on the Hint button only, the R2-06 rule visible before the first
 * move. Screenshots: docs/qa/screens/r2/r3-02-<game>-<rm|motion>-<width>.png.
 */
const SCREENS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
] as const;
const GAMES = ["crownfall", "nine", "dusk"] as const;

async function settle(page: Page) {
  // The height fit steps in layout effects; give it a few frames and the rule's first paint.
  await page.waitForTimeout(600);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const overflow = (page: Page) =>
  page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    inner: window.innerHeight,
    aside: Math.round(document.querySelector("[data-shell-aside]")?.getBoundingClientRect().bottom ?? 0),
  }));

for (const vp of SCREENS) {
  for (const reduce of [false, true]) {
    test.describe(`${vp.width} × ${vp.height}${reduce ? ", reduced motion" : ""}`, () => {
      test.use({ viewport: vp, reducedMotion: reduce ? "reduce" : "no-preference" });

      for (const id of GAMES) {
        test(`${id}: no page scroll, the side panel inside the viewport`, async ({ page }) => {
          await openTestBoard(page, id, `r3-02-${reduce ? "rm" : "m"}`);
          await expect(page.locator("[data-shell][data-wide]")).toHaveCount(1);
          await settle(page);
          const m = await overflow(page);
          expect(m.scroll, `scrollHeight ${m.scroll} vs innerHeight ${m.inner}`).toBeLessThanOrEqual(m.inner);
          expect(m.aside).toBeLessThanOrEqual(m.inner);

          // Protect: one header timer, the R2-06 rule up before the first move, the hint count on the Hint button.
          await expect(page.getByRole("timer")).toHaveCount(1);
          await expect(page.locator("[data-shell-rule]")).toHaveText(GAME_BY_ID[id].rule);
          const hint = page.getByRole("button", { name: /^Hint\b/ });
          if (await hint.count()) {
            await expect(hint.first()).toBeVisible();
            const box = (await hint.first().boundingBox())!;
            expect(box.y + box.height).toBeLessThanOrEqual(m.inner);
          }
          await page.screenshot({ path: `docs/qa/screens/r2/r3-02-${id}-${reduce ? "rm" : "motion"}-${vp.width}.png` });
        });
      }
    });
  }
}
