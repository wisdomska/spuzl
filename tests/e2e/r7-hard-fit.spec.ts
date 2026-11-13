import { expect, test, type Page } from "@playwright/test";
import { openTestBoard } from "./harness";

/**
 * R7: the hardest boards fit small phones too. Market Run and Tripwire on their mega boards, and Emoji Hits before
 * Start, at 320 × 568 and 375 × 667: no page scroll, the tool bar on screen, 44 px tools. The first-slip tip (once per
 * device) must not move the tool bar (Market Run's long rule line at 320 × 568). Tripwire mega zooms on its first tap,
 * with cells of 32 px and more. Measured on the /dev/board fixtures (no guests).
 * Screenshots: docs/qa/screens/r2/r7-hard-fit-<game>-<width>.png.
 */
const SCREENS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
] as const;
const BOARDS = [
  { id: "market", d: "mega" },
  { id: "tripwire", d: "mega" },
  { id: "emojihits", d: "easy" },
] as const;

async function settle(page: Page) {
  await page.waitForTimeout(800);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const tails = [...document.querySelectorAll("[data-shell-tail] button")];
    const boxes = tails.map((b) => b.getBoundingClientRect()).filter((r) => r.width > 0);
    const el = document.scrollingElement ?? document.documentElement;
    return {
      over: el.scrollHeight - window.innerHeight,
      side: el.scrollWidth - window.innerWidth,
      inner: window.innerHeight,
      toolsTop: Math.round(Math.min(9999, ...boxes.map((r) => r.top + window.scrollY))),
      toolsBottom: Math.round(Math.max(0, ...boxes.map((r) => r.bottom))),
      shortest: Math.round(Math.min(999, ...boxes.map((r) => r.height))),
    };
  });

for (const vp of SCREENS) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: true });

    for (const b of BOARDS) {
      test(`${b.id} (${b.d}): no page scroll, the tool bar on screen`, async ({ page }) => {
        await openTestBoard(page, b.id, "qa", b.d);
        await settle(page);
        const m = await measure(page);
        await page.screenshot({ path: `docs/qa/screens/r2/r7-hard-fit-${b.id}-${vp.width}.png` });
        expect(m.over, `page scrolls ${m.over} px`).toBeLessThanOrEqual(0);
        expect(m.side, `sideways scroll ${m.side} px`).toBeLessThanOrEqual(0);
        expect(m.toolsBottom, "tool bar below the fold").toBeLessThanOrEqual(m.inner);
        expect(m.shortest, "a tool under 44 px").toBeGreaterThanOrEqual(44);
      });
    }

    test("market (mega): every rule can be read", async ({ page }) => {
      await openTestBoard(page, "market", "qa", "mega");
      await settle(page);
      const toggle = page.getByRole("button", { name: /^Rules\b/ });
      if (await toggle.count()) await toggle.click();
      const items = page.locator("[data-market-rules] li:visible");
      expect(await items.count()).toBeGreaterThanOrEqual(5);
      for (const li of await items.all()) await expect(li).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `docs/qa/screens/r2/r7-hard-fit-market-rules-${vp.width}.png` });
      // A tap anywhere closes them; the board is as it was.
      await page.locator("[data-market-rules]").first().tap();
      await expect(items).toHaveCount(0);
      expect((await measure(page)).over).toBeLessThanOrEqual(0);
    });

    test("tripwire (mega): the first tap zooms to 32 px+ cells, the page still fits", async ({ page }) => {
      await openTestBoard(page, "tripwire", "qa", "mega");
      await settle(page);
      const tile = page.getByRole("gridcell").nth(60);
      await expect(page.locator("[data-zoom=out]")).toHaveCount(1);
      await tile.tap();
      await settle(page);
      // Zoomed in on that tile, nothing revealed yet; the next tap reveals it (the first reveal is always safe).
      await expect(page.locator("[data-zoom=in]")).toHaveCount(1);
      await expect(tile).toHaveAttribute("aria-label", /hidden$/);
      const size = await tile.boundingBox();
      expect(size!.width).toBeGreaterThanOrEqual(32);
      await expect(tile).toBeInViewport({ ratio: 1 });
      expect((await measure(page)).over).toBeLessThanOrEqual(0);
      await tile.tap();
      await expect(tile).not.toHaveAttribute("aria-label", /hidden$/);
      await settle(page);
      expect((await measure(page)).over).toBeLessThanOrEqual(0);
      await page.screenshot({ path: `docs/qa/screens/r2/r7-hard-fit-tripwire-zoomed-${vp.width}.png` });
    });
  });
}

test.describe("the first-slip tip at 320 × 568", () => {
  test.use({ viewport: { width: 320, height: 568 }, hasTouch: true });

  test("market (mega): the tip never moves the tool bar", async ({ page }) => {
    await openTestBoard(page, "market", "qa", "mega");
    await settle(page);
    // The top number on every item: over the spend, a rule break (the first one carries the tip). Measured from the
    // first move on (the one-line rule under the title goes on the first move).
    const items = page.getByRole("gridcell");
    const n = await items.count();
    const eight = page.getByRole("button", { name: "Number 8" });
    await items.nth(0).click();
    await eight.click();
    await settle(page);
    const before = await measure(page);
    const slip = page.getByRole("alert").filter({ hasText: /more than/ });
    for (let k = 1; k < n; k++) {
      await items.nth(k).click();
      await eight.click();
      await page.waitForTimeout(400);
      if (await slip.count()) break;
    }
    await expect(slip).toBeVisible();
    await expect(slip).not.toContainText(/accuracy/);
    await settle(page);
    const atSlip = await measure(page);
    // A moment later the one-time tip takes the rule's place, on one line.
    const tip = page.getByRole("status").filter({ hasText: /accuracy/ });
    await expect(tip).toBeVisible({ timeout: 5000 });
    await settle(page);
    const atTip = await measure(page);
    const tipBox = await tip.boundingBox();
    await page.screenshot({ path: "docs/qa/screens/r2/r7-hard-fit-slip-tip-320.png" });
    expect(atSlip.toolsTop, "the slip moved the tool bar").toBe(before.toolsTop);
    expect(atTip.toolsTop, "the tip moved the tool bar").toBe(before.toolsTop);
    expect(tipBox!.height, "the tip takes more than one line").toBeLessThanOrEqual(44);
    expect(atTip.over).toBeLessThanOrEqual(0);
  });
});
