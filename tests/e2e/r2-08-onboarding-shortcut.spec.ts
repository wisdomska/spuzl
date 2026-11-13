import { expect, test, type Browser } from "@playwright/test";
import { birthFor, keepFocus, logGuest, pickBirth, solveLandingDemo, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-08 onboarding shortcut: the landing page's "Play now" goes straight to "When were you born?" as a guest (no
 * logo intro, no second guest / Google / email screen). Sign-in stays in the landing header. A solved landing demo
 * counts as the first clear (the lesson's own record) and the lesson is skipped. The age gate is unchanged.
 * Each test opens a fresh context with no session cookie, so "/" is the visitor landing page. Needs the app with a
 * database. Screenshots: docs/qa/screens/r2/r2-08-<name>-<375|1280>.png.
 */
const SIZES = [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const;
const shot = (name: string, w: string) => `docs/qa/screens/r2/r2-08-${name}-${w}.png`;

async function visitor(browser: Browser, viewport: { width: number; height: number }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await keepFocus(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Play now" }).first()).toBeVisible();
  return { ctx, page };
}

for (const [w, viewport] of SIZES) {
  test.describe(`R2-08 at ${w}`, () => {
    test("Play now opens the birth step as a guest, then the lesson board", async ({ browser }) => {
      const { ctx, page } = await visitor(browser, viewport);
      // Sign-in is still one tap away on the landing header, at every width.
      const signIn = page.getByRole("banner").getByRole("link", { name: "Sign in" });
      await expect(signIn).toBeVisible();
      await expect(signIn).toHaveAttribute("href", "/intro?next=/welcome");
      await page.screenshot({ path: shot("landing", w) });

      await page.getByRole("link", { name: "Play now" }).first().click();
      await page.waitForURL((u) => u.pathname === "/welcome/play", { timeout: 15_000 });
      // After the logo intro (owner, 13 Nov 2026), the birth step: no "Ready to play?" choice.
      await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Play as guest" })).toHaveCount(0);
      await expect(page.getByRole("progressbar", { name: "Step 1 of 4" })).toBeVisible();
      await page.screenshot({ path: shot("birth", w) });
      // The intro is marked seen, so later first-run redirects skip it too.
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("spuzl.onboarding") ?? "{}").introSeen)).toBe(true);

      await pickBirth(page, "18+");
      const learn = page.getByRole("button", { name: /Learn a game in 30 seconds/ });
      await expect(learn).toBeVisible();
      await page.screenshot({ path: shot("start", w) });
      await learn.click();
      await waitForBoard(page);
      await ctx.close();
    });

    test("a solved landing demo is the first clear: no lesson, straight to Crownfall", async ({ browser }) => {
      const { ctx, page } = await visitor(browser, viewport);
      await solveLandingDemo(page);
      await expect(page.getByText("It counts as your first clear.")).toBeVisible();
      await page.screenshot({ path: shot("demo-solved", w) });

      await page.getByRole("link", { name: "Play now" }).first().click();
      await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
      // A 13 to 15 birth: the birth step still decides the band.
      await pickBirth(page, "13-15");
      await expect(page.getByRole("status").filter({ hasText: "You cleared Crownfall on the way in" })).toBeVisible();
      await expect(page.getByRole("button", { name: /Learn a game in 30 seconds/ })).toHaveCount(0);
      await page.screenshot({ path: shot("start-after-demo", w) });

      await page.getByRole("button", { name: /Play more Crownfall/ }).click();
      await expect(page.getByText("First clear!")).toBeVisible();
      await expect(page.getByRole("heading", { name: "Now make Spuz yours" })).toBeVisible();
      await page.screenshot({ path: shot("nickname-after-demo", w) });
      await page.locator("#nick").fill(`Qs${Date.now() % 1e7}`);
      await page.getByRole("button", { name: "Save my Spuz and play Crownfall" }).click();
      await page.waitForURL((u) => u.pathname === "/play/crownfall", { timeout: 30_000 });
      await waitForBoard(page);
      // Learned: the real board, not the practice round.
      await expect(page.getByText("First time playing Crownfall?")).toHaveCount(0);
      await logGuest(page);

      const me = await page.evaluate(() => fetch("/api/v1/me").then((r) => r.json()));
      expect(me.age_band).toBe("13-15");
      await expect
        .poll(() =>
          page.evaluate(() =>
            fetch("/api/v1/me")
              .then((r) => r.json())
              .then((m) => m.learned),
          ),
        )
        .toContain("crownfall");
      // Counted once, then dropped from this tab.
      expect(await page.evaluate(() => sessionStorage.getItem("spuzl.demoClear"))).toBeNull();
      await ctx.close();
    });

    test("under 13 from the shortcut: turned away, nothing kept (the demo clear neither)", async ({ browser }) => {
      const { ctx, page } = await visitor(browser, viewport);
      await solveLandingDemo(page);
      await page.getByRole("link", { name: "Play now" }).first().click();
      await expect(page.getByRole("heading", { name: /When were you born\?/ })).toBeVisible();
      const y = new Date().getUTCFullYear();
      await pickBirth(page, { year: y - 10, month: 1 });
      await expect(page.getByRole("heading", { name: "SPUZL is for 13 and up" })).toBeVisible();
      expect(await page.evaluate(() => fetch("/api/v1/me?optional=1").then((r) => r.json()))).toBeNull();
      expect(await page.evaluate(() => sessionStorage.getItem("spuzl.demoClear"))).toBeNull();
      await ctx.close();
    });
  });
}

test("the adult band is unchanged on the shortcut", async ({ browser }) => {
  const { ctx, page } = await visitor(browser, VIEWPORTS.phone);
  await page.getByRole("link", { name: "Play now" }).first().click();
  await pickBirth(page, birthFor("18+"));
  await page.getByRole("button", { name: /Go to the map/ }).click();
  await page.locator("#nick").fill(`Qa${Date.now() % 1e7}`);
  await page.getByRole("button", { name: /Save my Spuz/ }).click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await logGuest(page);
  expect((await page.evaluate(() => fetch("/api/v1/me").then((r) => r.json()))).age_band).toBe("18+");
  await ctx.close();
});
