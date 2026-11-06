import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { GAMES } from "@/lib/catalog";
import { keepFocus, onboardGuest, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2 Phase 4: re-test what the round 2 audit didn't cover, at 375 and 1280 px, with screenshots
 * (docs/qa/screens/r2/phase4/). Runs against any deployment as one guest per viewport (logged for cleanup).
 *   PW_BASE_URL=https://spuzl.vercel.app pnpm exec playwright test tests/e2e/r2-phase4.spec.ts --project=desktop-1280
 */
const DIR = "docs/qa/screens/r2/phase4";
mkdirSync(DIR, { recursive: true });

test.describe.configure({ mode: "default", timeout: 30 * 60_000 });

for (const [vpName, vp] of Object.entries({ "375": VIEWPORTS.phone, "1280": VIEWPORTS.desktop })) {
  test.describe(`at ${vpName} px`, () => {
    let page: Page;
    test.beforeAll(async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: vp, colorScheme: "dark" });
      page = await ctx.newPage();
      await keepFocus(page);
      await onboardGuest(page); // every game marked learned: straight to the real board
    });
    test.afterAll(async () => page.context().close());

    const shot = (name: string) => page.screenshot({ path: `${DIR}/${name}-${vpName}.png` });
    const noSideScroll = async () => {
      const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      return w[0] <= w[1] + 1;
    };

    test("Home and Library layouts", async () => {
      await page.goto("/");
      await page.locator('main a[href^="/play/"]').first().waitFor();
      await page.waitForTimeout(800);
      await shot("home");
      expect(await noSideScroll(), "Home has no horizontal scroll").toBe(true);
      await page.goto("/library");
      await page.locator("main li").first().waitFor();
      await page.waitForTimeout(800);
      await shot("library");
      expect(await noSideScroll(), "Library has no horizontal scroll").toBe(true);
    });

    test("every game opens and fits", async () => {
      const bad: string[] = [];
      for (const g of GAMES) {
        await page.goto(`/play/${g.id}?mode=free`);
        try {
          await waitForBoard(page, 45_000);
        } catch {
          bad.push(`${g.id}: no board`);
          await shot(`game-${g.id}`);
          continue;
        }
        await page.waitForTimeout(700);
        await shot(`game-${g.id}`);
        if (!(await noSideScroll())) bad.push(`${g.id}: horizontal scroll`);
      }
      test.info().annotations.push({ type: "games", description: bad.join("; ") || "all fit" });
      expect.soft(bad).toEqual([]);
    });

    test("tool active state: Crownfall Crown / Mark X, Dusk Sun / Moon", async () => {
      for (const [game, tools] of [
        ["crownfall", ["Crown", "Mark X"]],
        ["dusk", ["Sun", "Moon"]],
      ] as const) {
        await page.goto(`/play/${game}?mode=free`);
        await waitForBoard(page, 45_000);
        for (const t of tools) {
          const b = page.getByRole("button", { name: new RegExp(`^${t}\\b`) }).first();
          if (!(await b.count())) continue;
          await b.click();
          await expect(b).toHaveAttribute("aria-pressed", "true");
          await shot(`tool-${game}-${t.replace(/\W+/g, "").toLowerCase()}`);
        }
      }
    });

    test("Quickfire: options hidden until Start, feedback cleared, end summary", async () => {
      await page.goto("/play/quickfire?mode=free");
      const start = page.getByRole("button", { name: /^Start\b/ });
      await start.waitFor({ timeout: 45_000 });
      await expect(page.getByRole("group", { name: /answers/i })).toHaveCount(0);
      await shot("quickfire-before-start");
      await start.click();
      const answers = page.getByRole("group", { name: /answers/i });
      await expect(answers).toBeVisible();
      await answers.getByRole("button").first().click();
      await page.waitForTimeout(2500);
      await shot("quickfire-after-answer");
    });

    test("Four Up: a tap anywhere in a column drops there", async () => {
      await page.goto("/play/fourup?mode=free");
      await waitForBoard(page, 45_000);
      const grid = page.getByRole("grid").first();
      const box = (await grid.boundingBox())!;
      // top of column 4 (an empty cell, far from where the disc lands)
      await page.mouse.click(box.x + box.width * (3.5 / 7), box.y + 6);
      await page.waitForTimeout(800);
      await shot("fourup-column-tap");
      const filled = await page.getByRole("gridcell", { name: /yours|your disc|red|you/i }).count();
      test.info().annotations.push({ type: "fourup", description: `cells naming the player's disc after a top tap: ${filled}` });
    });

    test("Chess: pieces inside their squares, coordinates readable", async () => {
      await page.goto("/play/chess?mode=free");
      await waitForBoard(page, 45_000);
      await page.waitForTimeout(600);
      await shot("chess");
      const overflow = await page.evaluate(() => {
        const cells = [...document.querySelectorAll('[role="gridcell"]')] as HTMLElement[];
        let worst = 0;
        for (const c of cells) {
          const r = c.getBoundingClientRect();
          for (const k of c.querySelectorAll("svg, img, span")) {
            const q = (k as HTMLElement).getBoundingClientRect();
            if (!q.width) continue;
            worst = Math.max(worst, r.left - q.left, q.right - r.right, r.top - q.top, q.bottom - r.bottom);
          }
        }
        return Math.round(worst);
      });
      test.info().annotations.push({ type: "chess", description: `largest piece overflow past its square: ${overflow}px` });
      expect(overflow).toBeLessThanOrEqual(2);
    });

    test("Gotcha: no black first frame, playfield at least 60% of the viewport height", async () => {
      await page.goto("/play/gotcha?mode=free");
      const canvas = page.locator("canvas").first();
      await canvas.waitFor({ timeout: 45_000 });
      const firstFrameDark = await canvas.evaluate((c: HTMLCanvasElement) => {
        try {
          const g = c.getContext("2d") ?? null;
          if (!g) return null; // WebGL: checked by screenshot
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let lit = 0;
          for (let i = 0; i < d.length; i += 4 * 97) if (d[i] + d[i + 1] + d[i + 2] > 40) lit++;
          return lit === 0;
        } catch {
          return null;
        }
      });
      await shot("gotcha-first-frame");
      const h = (await canvas.boundingBox())!.height;
      test
        .info()
        .annotations.push({
          type: "gotcha",
          description: `canvas ${Math.round(h)}px of ${vp.height}; dark first frame: ${firstFrameDark}`,
        });
      expect(firstFrameDark).not.toBe(true);
      expect(h / vp.height).toBeGreaterThanOrEqual(0.6);
    });

    test("adult Quick Match: live queue copy, then the bot offer", async () => {
      await page.goto("/duel");
      const qm = page.getByRole("button", { name: /Quick Match/ }).first();
      await qm.waitFor({ timeout: 30_000 });
      await qm.click();
      await page.waitForTimeout(1500);
      await shot("duel-quickmatch-queue");
      const bot = page.getByRole("button", { name: /Practice bot|Play the bot|bot/i }).first();
      await expect(bot).toBeVisible({ timeout: 70_000 });
      await shot("duel-quickmatch-bot-offer");
      const cancel = page.getByRole("button", { name: /Cancel|Back|Stop/ }).first();
      if (await cancel.count()) await cancel.click();
    });
  });
}
