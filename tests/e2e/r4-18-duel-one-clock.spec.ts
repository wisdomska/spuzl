import { expect, test, type Page } from "@playwright/test";
import { duelFriend, tapCell } from "./harness";

/**
 * R4-18 (replaces R3-07): one Duel clock in a live round, the server's round time. The header timer and the
 * opponent strip's "You" clock both count from the shared round start (the end of the 3-2-1), first move or not, and
 * read the same; neither runs during the countdown. The rival's time is never a running clock. Both players see
 * the same round time.
 *
 * Needs a server with a database (the lead runs it):
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r4-18-duel-one-clock.spec.ts --project=phone-375
 */
const header = (page: Page) => page.getByRole("timer");
const strip = (page: Page) => page.locator("[data-strip-clock]");
const secs = (t: string | null) => {
  const m = /(\d+):(\d{2})/.exec(t ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

test("the header timer and the strip show the server round time from the round start, for both players", async ({ browser }) => {
  test.setTimeout(120_000);
  const { host, guest } = await duelFriend(browser, { game: "crownfall" });
  try {
    const page = host.page;
    await expect(header(page)).toBeVisible({ timeout: 45_000 });
    // Once the round starts both run without a move (the countdown shows neither).
    await expect(header(page)).toHaveAttribute("data-timer", "running", { timeout: 20_000 });
    await expect(strip(page)).toHaveAttribute("data-strip-clock", "running");
    await page.waitForTimeout(4000);
    const [h, s] = [secs(await header(page).textContent()), secs(await strip(page).textContent())];
    expect(h).toBeGreaterThanOrEqual(3); // counted from the round start, not from a first move
    expect(Math.abs(h - s)).toBeLessThanOrEqual(1);

    // A first move doesn't restart it.
    await tapCell(page, 1, 1);
    await page.waitForTimeout(1200);
    expect(secs(await header(page).textContent())).toBeGreaterThanOrEqual(h);

    // The other player sees the same round time (one server clock).
    await expect(header(guest.page)).toHaveAttribute("data-timer", "running");
    const [mine, theirs] = [secs(await header(page).textContent()), secs(await header(guest.page).textContent())];
    expect(Math.abs(mine - theirs)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("timer")).toHaveCount(1);
    await page.screenshot({ path: "docs/qa/screens/r2/r4-18-duel-clock-375.png" });
  } finally {
    await host.ctx.close();
    await guest.ctx.close();
  }
});
