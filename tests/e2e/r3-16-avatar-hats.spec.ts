import { expect, test, type Browser, type Page } from "@playwright/test";
import { guestContext, VIEWPORTS } from "./harness";
import { admin } from "../api/helpers";
import { LAUNCH_IDS } from "@/lib/catalog";

/**
 * R3-16 (owner: "the Spuz avatar customizations should reflect everywhere"): list avatars are small still Spuz
 * chips wearing each player's Shop look. A friend's Shades show on their Friends row and their leaderboard row,
 * and on their Party lobby seat; the chips keep the old avatar box, so no row grows or scrolls sideways.
 * Needs the app with a database: it sets Sparks and a Daily result through the service role (local or hosted).
 * The leaderboard is a Daily-only screen: while Dailies are off (admin "features.dailies", off in production) it
 * redirects to Home, so its checks run only when Dailies are on.
 */

const must = async (q: PromiseLike<{ error: unknown }>) => {
  const { error } = await q;
  if (error) throw error;
};

/** Whether the Daily leaderboards are on (they answer dailies_off otherwise). */
async function dailiesOn(page: Page) {
  const res = await page.request.get("/api/v1/leaderboards/crownfall?scope=friends");
  if (!res.ok()) expect(await res.text()).toContain("dailies_off");
  return res.ok();
}

async function myId(page: Page) {
  return (await (await page.request.get("/api/v1/me")).json()).id as string;
}

/** Buys and wears Shades through the real Shop API. */
async function wearShades(page: Page, nickname: string) {
  await must(admin().from("players").update({ sparks: 1000 }).eq("nickname", nickname));
  const buy = await page.request.post("/api/v1/shop/buy", { data: { itemId: "hat-shades", requestId: crypto.randomUUID() } });
  expect(buy.ok(), await buy.text()).toBe(true);
  const equip = await page.request.post("/api/v1/shop/equip", { data: { itemId: "hat-shades", equip: true } });
  expect(equip.ok(), await equip.text()).toBe(true);
}

/** Two friends: `a` (no hat) and `b` (in Shades), both with today's Daily cleared on the board's default game. */
async function friendsWithShades(browser: Browser, viewport: { width: number; height: number } = VIEWPORTS.phone) {
  const a = await guestContext(browser, { viewport });
  const b = await guestContext(browser, { viewport });
  await wearShades(b.page, b.nickname);
  const inv = await (await a.page.request.get("/api/v1/friends/invite")).json();
  const acc = await b.page.request.post("/api/v1/friends/invite/accept", { data: { code: inv.code } });
  expect(acc.ok(), await acc.text()).toBe(true);
  const game = LAUNCH_IDS[0] ?? "crownfall";
  const day = new Date().toISOString().slice(0, 10);
  for (const [id, ms] of [
    [await myId(a.page), 70_000],
    [await myId(b.page), 50_000],
  ] as const)
    await must(
      admin()
        .from("daily_results")
        .upsert(
          { date: day, game_id: game, player_id: id, time_ms: ms, finished_at: new Date().toISOString() },
          { onConflict: "date,game_id,player_id", ignoreDuplicates: true },
        ),
    );
  return { a, b };
}

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);

test("a friend's Shades show on their Friends row and leaderboard row; no hat shows none", async ({ browser }) => {
  const { a, b } = await friendsWithShades(browser);

  await a.page.goto("/friends");
  const friends = a.page.getByRole("region", { name: "Your friends" });
  await expect(friends.getByText(b.nickname)).toBeVisible({ timeout: 15_000 });
  await expect(friends.locator('[data-avatar="spuz"] [data-hat="shades"]')).toHaveCount(1);
  await noOverflow(a.page);

  if (!(await dailiesOn(a.page))) {
    test.info().annotations.push({ type: "leaderboard", description: "Dailies are off: leaderboard checks skipped" });
    await a.ctx.close();
    await b.ctx.close();
    return;
  }
  await a.page.goto("/leaderboards");
  const theirRow = a.page.locator(`a[href="/u/${b.nickname}"]`);
  await expect(theirRow.locator('[data-hat="shades"]').first()).toBeVisible({ timeout: 15_000 });
  // your own row: your Spuz, no hat (you wear none), and no letter avatar left anywhere in the list
  const mine = a.page.locator('a[href="/me"][data-me]').first();
  await expect(mine.locator('[data-avatar="spuz"] .spuz-root')).toBeVisible();
  await expect(mine.locator("[data-hat]")).toHaveCount(0);
  // chips keep the 30 px avatar box
  const box = await theirRow.last().locator('[data-avatar="spuz"]').boundingBox();
  expect(Math.round(box!.width)).toBe(30);
  expect(Math.round(box!.height)).toBe(30);

  await a.ctx.close();
  await b.ctx.close();
});

test("a player's Shades show on their Party lobby seat for the host", async ({ browser }) => {
  const host = await guestContext(browser);
  const g = await guestContext(browser);
  await wearShades(g.page, g.nickname);
  await host.page.goto("/party");
  await host.page
    .getByRole("button", { name: /Open (a )?room|Host/i })
    .first()
    .click();
  await host.page.waitForURL(/\/party\/[A-Z0-9]{4}/, { timeout: 30_000 });
  const code = new URL(host.page.url()).pathname.split("/").pop()!;
  await g.page.goto(`/party/${code}`);
  await g.page.getByRole("button", { name: /^Join$/ }).click();

  const seats = host.page.getByRole("list", { name: "Players" });
  const seat = seats.locator(`li[aria-label^="${g.nickname}"]`);
  await expect(seat).toBeVisible({ timeout: 30_000 });
  await expect(seat.locator('[data-hat="shades"]')).toBeVisible();
  // the host wears nothing: their own seat has a Spuz, no hat
  await expect(seats.locator('li[aria-label^="You"] [data-avatar="spuz"]')).toBeVisible();
  await expect(seats.locator('li[aria-label^="You"] [data-hat]')).toHaveCount(0);
  // and the guest sees their own Shades on their seat too
  await expect(g.page.getByRole("list", { name: "Players" }).locator('li[aria-label^="You"] [data-hat="shades"]')).toBeVisible({
    timeout: 30_000,
  });

  await host.ctx.close();
  await g.ctx.close();
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`R3-16 screens at ${label} (${size.width})`, async ({ browser }) => {
    const { a, b } = await friendsWithShades(browser, size);

    if (await dailiesOn(a.page)) {
      await a.page.goto("/leaderboards");
      await expect(a.page.locator(`a[href="/u/${b.nickname}"] [data-hat="shades"]`).first()).toBeVisible({ timeout: 15_000 });
      await a.page.screenshot({ path: `docs/qa/screens/r3/R3-16-leaderboard-${size.width}.png` });
      await noOverflow(a.page);
    }

    await a.page.goto("/friends");
    await expect(a.page.getByRole("region", { name: "Your friends" }).locator('[data-hat="shades"]')).toBeVisible({ timeout: 15_000 });
    await a.page.screenshot({ path: `docs/qa/screens/r3/R3-16-friends-${size.width}.png` });
    await noOverflow(a.page);

    await b.page.goto("/party");
    await b.page
      .getByRole("button", { name: /Open (a )?room|Host/i })
      .first()
      .click();
    await b.page.waitForURL(/\/party\/[A-Z0-9]{4}/, { timeout: 30_000 });
    await expect(b.page.getByRole("list", { name: "Players" }).locator('[data-hat="shades"]')).toBeVisible({ timeout: 15_000 });
    await b.page.screenshot({ path: `docs/qa/screens/r3/R3-16-party-lobby-${size.width}.png` });
    await noOverflow(b.page);

    await a.ctx.close();
    await b.ctx.close();
  });
