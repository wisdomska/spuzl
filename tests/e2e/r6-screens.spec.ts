import { expect, test, type Page } from "@playwright/test";
import { guestContext } from "./harness";
import { signedIn } from "./admin/helpers";

/**
 * R6 (12 Nov 2026): motion, Back links, /games tabs, the FAQ and shorter copy. Every public page, the main app tabs
 * and every admin page at phone and laptop widths: no sideways scroll, screenshots for review. Needs a dev server
 * with a database (PW_BASE_URL, API_BASE).
 */
test.describe.configure({ mode: "serial" });
const OUT = "docs/qa/screens/r6";
const WIDTHS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];
const sideways = (p: Page) => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const settle = (p: Page) => p.waitForTimeout(900); // entrances finish within 400 ms; reveals once in view

async function shoot(page: Page, name: string, w: number, full = true) {
  await settle(page);
  expect(await sideways(page), `${name} at ${w} scrolls sideways`).toBeLessThanOrEqual(0);
  await page.screenshot({ path: `${OUT}/${name}-${w}.png`, fullPage: full });
}

const PUBLIC = ["/", "/games", "/games#board", "/world/logic", "/games/crownfall", "/how-to-play", "/fair-play", "/contact", "/privacy"];

for (const vp of WIDTHS)
  test(`public pages at ${vp.width}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    for (const path of PUBLIC) {
      await page.goto(path);
      if (path === "/") {
        // Scroll through so every reveal runs, then back to the top for the shot.
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 400) {
            window.scrollTo({ top: y, behavior: "instant" });
            await new Promise((r) => setTimeout(r, 60));
          }
          window.scrollTo({ top: 0, behavior: "instant" });
        });
      }
      const name = path === "/" ? "landing" : path.replace(/[/#]+/g, "-").replace(/^-/, "");
      await shoot(page, name, vp.width);
    }
    // FAQ heading and an open accordion on the landing page.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Frequently Asked/ }).first()).toBeAttached();
    const q = page.locator("details summary").first();
    await q.scrollIntoViewIfNeeded();
    await q.click();
    await page.waitForTimeout(400);
    await page
      .locator("details")
      .first()
      .screenshot({ path: `${OUT}/faq-open-${vp.width}.png` });
    // /games tabs: four worlds, and a Back link.
    await page.goto("/games");
    await expect(page.getByRole("tab")).toHaveCount(4);
    await expect(page.getByRole("link", { name: /Back/ }).first()).toBeVisible();
    await ctx.close();
  });

const APP = [
  "/",
  "/daily",
  "/library",
  "/leagues",
  "/friends",
  "/me",
  "/quests",
  "/shop",
  "/leaderboards",
  "/archive",
  "/settings",
  "/party",
];

for (const vp of [WIDTHS[0], WIDTHS[2], WIDTHS[3]])
  test(`app pages at ${vp.width}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const g = await guestContext(browser, { viewport: vp });
    try {
      for (const path of APP) {
        await g.page.goto(path);
        await shoot(g.page, `app${path === "/" ? "-home" : path.replace(/\//g, "-")}`, vp.width, false);
      }
    } finally {
      await g.ctx.close();
    }
  });

const ADMIN = [
  "",
  "players",
  "moderation",
  "join-requests",
  "feedback",
  "library",
  "content",
  "puzzles",
  "calendar",
  "daily-five",
  "events",
  "shop",
  "metrics",
  "liveops",
  "settings",
  "team",
  "audit",
];

for (const vp of [
  { width: 1280, height: 800 },
  { width: 820, height: 1180 },
])
  test(`admin pages at ${vp.width}`, async ({ browser }) => {
    test.setTimeout(400_000);
    const ctx = await browser.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await signedIn(page, "owner");
    for (const p of ADMIN) {
      await page.goto(`/admin${p ? `/${p}` : ""}`);
      await page.waitForLoadState("networkidle").catch(() => undefined);
      await shoot(page, `admin-${p || "overview"}`, vp.width);
    }
    await ctx.close();
  });
