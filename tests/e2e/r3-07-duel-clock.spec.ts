import { expect, test, type Page } from "@playwright/test";
import { duelFriend, tapCell } from "./harness";

/**
 * R3-07: one Duel clock rule. In a live Duel round the header timer and the opponent strip's "You" clock both start
 * on your first move (R2-15), not at the round start: before it, neither shows a running time; after it, they read
 * the same. The rival's time is never a running clock.
 *
 * Needs a server with a database (the lead runs it):
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r3-07-duel-clock.spec.ts --project=phone-375
 */
const header = (page: Page) => page.getByRole("timer");
const strip = (page: Page) => page.locator("[data-strip-clock]");
const secs = (t: string | null) => {
  const m = /(\d+):(\d{2})/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

test("the header timer and the strip clock wait for the first move together, then agree", async ({ browser }) => {
  test.setTimeout(120_000);
  const { host, guest } = await duelFriend(browser, { game: "crownfall" });
  try {
    const page = host.page;
    await expect(header(page)).toBeVisible({ timeout: 45_000 });
    // Past the countdown, still no move: both wait (the round started, so the old strip clock would be running).
    await expect(header(page)).toHaveAttribute("data-timer", "waiting", { timeout: 15_000 });
    await page.waitForTimeout(6000);
    await expect(strip(page)).toHaveAttribute("data-strip-clock", "waiting");
    await expect(header(page)).toHaveAttribute("data-timer", "waiting");

    await tapCell(page, 1, 1);
    await expect(header(page)).toHaveAttribute("data-timer", "running");
    await expect(strip(page)).toHaveAttribute("data-strip-clock", "running");
    await page.waitForTimeout(2200);
    const [h, s] = [secs(await header(page).textContent()), secs(await strip(page).textContent())];
    expect(h).toBeLessThan(5); // counted from the move, not the round start 8+ s ago
    expect(Math.abs(h - s)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: "docs/qa/screens/r2/r3-07-duel-clock-375.png" });
  } finally {
    await host.ctx.close();
    await guest.ctx.close();
  }
});
