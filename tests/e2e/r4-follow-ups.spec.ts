import { expect, test, type Page } from "@playwright/test";
import { seededBoardUrl } from "./harness";

/**
 * R4 follow-ups:
 * - All games: the server HTML and the hydrated page show the same game count (the seeded lab games were missing
 *   from the server render, React error #418 in production), and no hydration error is reported.
 * - Fit at 320 × 568, 375 × 667 and 1280 × 800: the Duel round end (countdown and reactions) and match end (Rematch)
 *   on the /dev/duel fixture, and Flinch and Beat Tap on /dev/board (ENABLE_DEV_ROUTES=1). No guests are created.
 */

const fits = (page: Page) =>
  page.evaluate(() => ({
    scroll: document.documentElement.scrollHeight,
    inner: window.innerHeight,
    wide: document.documentElement.scrollWidth - window.innerWidth,
  }));

test("All games: the server and the browser render the same list, no hydration error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && /hydrat|didn't match|#418/i.test(m.text()) && errors.push(m.text()));
  const html = await (await page.request.get("/library")).text();
  const server = html.match(/>(\d+) games</)?.[1];
  expect(server, "the count line in the server HTML").toBeTruthy();
  for (let visit = 0; visit < 2; visit++) {
    await page.goto("/library");
    await expect(page.locator("main header [aria-live]")).toHaveText(`${server} games`);
  }
  await page.waitForTimeout(1000);
  expect(errors.filter((e) => /hydrat|didn't match|#418/i.test(e))).toEqual([]);
});

for (const vp of [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
]) {
  test.describe(`${vp.width} × ${vp.height}`, () => {
    test.use({ viewport: vp, reducedMotion: "reduce" });

    test("Duel round end: the countdown and the reactions are on screen", async ({ page }) => {
      await page.goto("/dev/duel?screen=round&long=1");
      await expect(page.getByRole("progressbar")).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: "Chat" })).toBeInViewport({ ratio: 1 });
      const m = await fits(page);
      expect(m.scroll, `page ${m.scroll} px on a ${m.inner} px screen`).toBeLessThanOrEqual(m.inner);
      expect(m.wide).toBeLessThanOrEqual(0);
    });

    test("Duel match end: Rematch is always on screen, nothing scrolls without the extras", async ({ page }) => {
      for (const won of ["1", "0"]) {
        await page.goto(`/dev/duel?screen=end&won=${won}`);
        await expect(page.getByRole("button", { name: /Rematch/ })).toBeInViewport({ ratio: 1 });
        const m = await fits(page);
        expect(m.scroll, `page ${m.scroll} px on a ${m.inner} px screen`).toBeLessThanOrEqual(m.inner);
      }
      // the worst case (head to head, Add friend, the rematch note) may scroll, but Rematch stays on screen
      await page.goto("/dev/duel?screen=end&long=1");
      await page.mouse.wheel(0, 400);
      await expect(page.getByRole("button", { name: /Rematch/ })).toBeInViewport({ ratio: 1 });
    });

    test("Flinch and Beat Tap fit without a scroll", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("spuzl.beattap.soundAsked", "1"));
      for (const game of ["flinch", "beattap"]) {
        await page.goto(seededBoardUrl(game));
        await expect(page.getByRole("button", { name: /^(Start|Beat pad\.)/ }).first()).toBeInViewport({ ratio: 1, timeout: 30_000 });
        const m = await fits(page);
        expect(m.scroll, `${game}: page ${m.scroll} px on a ${m.inner} px screen`).toBeLessThanOrEqual(m.inner);
        expect(m.wide).toBeLessThanOrEqual(0);
      }
    });
  });
}
