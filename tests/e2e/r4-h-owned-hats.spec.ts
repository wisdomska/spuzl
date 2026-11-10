import { execSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { guestContext, VIEWPORTS } from "./harness";

/**
 * R4-H (owner decision H: "the hats/shades should only show everywhere to players who have purchased them"): every
 * player chip draws the player's Spuz in their hat, and a hat shows only when that player owns it. `owner` buys and
 * wears Shades through the Shop API; `forger` gets 'shades' written straight into players.hat with no purchase (a
 * stale or forged value). Every payload and chip shows the owner's Shades and never the forger's.
 * Needs the app with the local database (psql, like r3-15-spuz-wear and r3-16-avatar-hats).
 */

const psql = (sql: string) => execSync(`PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -qc "${sql}"`);

async function myId(page: Page) {
  return (await (await page.request.get("/api/v1/me")).json()).id as string;
}

async function wearShades(page: Page, nickname: string) {
  psql(`update players set sparks = 1000 where nickname = '${nickname}'`);
  const buy = await page.request.post("/api/v1/shop/buy", { data: { itemId: "hat-shades", requestId: crypto.randomUUID() } });
  expect(buy.ok(), await buy.text()).toBe(true);
  const equip = await page.request.post("/api/v1/shop/equip", { data: { itemId: "hat-shades", equip: true } });
  expect(equip.ok(), await equip.text()).toBe(true);
}

/** Two friends: `owner` bought Shades, `forger` has them only in the players row. Both cleared today's Daily. */
async function ownerAndForger(browser: Browser, viewport: { width: number; height: number } = VIEWPORTS.phone) {
  const owner = await guestContext(browser, { viewport });
  const forger = await guestContext(browser, { viewport });
  await wearShades(owner.page, owner.nickname);
  psql(`update players set hat = 'shades' where nickname = '${forger.nickname}'`);
  const inv = await (await owner.page.request.get("/api/v1/friends/invite")).json();
  const acc = await forger.page.request.post("/api/v1/friends/invite/accept", { data: { code: inv.code } });
  expect(acc.ok(), await acc.text()).toBe(true);
  const day = new Date().toISOString().slice(0, 10);
  for (const [id, ms] of [
    [await myId(owner.page), 50_000],
    [await myId(forger.page), 70_000],
  ] as const)
    psql(
      `insert into daily_results (date, game_id, player_id, time_ms, finished_at) values ('${day}', 'crownfall', '${id}', ${ms}, now()) on conflict do nothing`,
    );
  return { owner, forger };
}

const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);

test("payloads carry a hat only for the player who bought it", async ({ browser }) => {
  const { owner, forger } = await ownerAndForger(browser);
  const get = async (page: Page, path: string) => {
    const r = await page.request.get(path);
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };

  // their own profile (MySpuz, the Home ring)
  expect((await get(owner.page, "/api/v1/me")).hat).toBe("shades");
  expect((await get(forger.page, "/api/v1/me")).hat ?? null).toBeNull();

  // public profiles, both ways
  expect((await get(forger.page, `/api/v1/players/${owner.nickname}`)).hat ?? null).toBe("shades");
  expect((await get(owner.page, `/api/v1/players/${forger.nickname}`)).hat ?? null).toBeNull();

  // the friends list and the leaderboard
  const text = (o: unknown) => JSON.stringify(o);
  const friendsOfOwner = await get(owner.page, "/api/v1/friends");
  expect(text(friendsOfOwner)).toContain(forger.nickname);
  expect(text(friendsOfOwner)).not.toContain('"hat":"shades"');
  const friendsOfForger = await get(forger.page, "/api/v1/friends");
  expect(text(friendsOfForger)).toContain('"hat":"shades"');

  const board = await get(owner.page, "/api/v1/leaderboards/crownfall?scope=friends");
  const rows = board.rows as { nickname: string; hat: string | null }[];
  expect(rows.find((r) => r.nickname === owner.nickname)?.hat).toBe("shades");
  expect(rows.find((r) => r.nickname === forger.nickname)?.hat).toBeNull();

  // blocking: the blocked list shows the forger with no hat
  const bl = await owner.page.request.post("/api/v1/blocks", { data: { playerId: await myId(forger.page) } });
  expect(bl.ok(), await bl.text()).toBe(true);
  const blocked = (await get(owner.page, "/api/v1/blocks")).blocked as { nickname: string; hat: string | null }[];
  expect(blocked.find((b) => b.nickname === forger.nickname)?.hat).toBeNull();

  await owner.ctx.close();
  await forger.ctx.close();
});

test("chips: the owner's Shades show, the forger's never do (friends, Home, Party seats, Board Bay inbox)", async ({ browser }) => {
  const { owner, forger } = await ownerAndForger(browser);

  // Friends: the forger sees the owner's Shades; the owner sees no hat on the forger's row
  await forger.page.goto("/friends");
  const forgersFriends = forger.page.getByRole("region", { name: "Your friends" });
  await expect(forgersFriends.getByText(owner.nickname)).toBeVisible({ timeout: 15_000 });
  await expect(forgersFriends.locator('[data-avatar="spuz"] [data-hat="shades"]')).toHaveCount(1);
  await owner.page.goto("/friends");
  const ownersFriends = owner.page.getByRole("region", { name: "Your friends" });
  await expect(ownersFriends.getByText(forger.nickname)).toBeVisible({ timeout: 15_000 });
  await expect(ownersFriends.locator('[data-avatar="spuz"] .spuz-root').first()).toBeVisible();
  await expect(ownersFriends.locator("[data-hat]")).toHaveCount(0);

  // Home: the forger's own ring shows a Spuz with no hat
  await forger.page.goto("/");
  await expect(forger.page.locator('a[href="/me"] [data-avatar="spuz"] .spuz-root').first()).toBeVisible({ timeout: 15_000 });
  await expect(forger.page.locator('a[href="/me"] [data-hat]')).toHaveCount(0);

  // Party lobby: the owner hosts, the forger joins; only the owner's seat wears Shades
  await owner.page.goto("/party");
  await owner.page
    .getByRole("button", { name: /Open (a )?room|Host/i })
    .first()
    .click();
  await owner.page.waitForURL(/\/party\/[A-Z0-9]{4}/, { timeout: 30_000 });
  const code = new URL(owner.page.url()).pathname.split("/").pop()!;
  await forger.page.goto(`/party/${code}`);
  await forger.page.getByRole("button", { name: /^Join$/ }).click();
  const seats = owner.page.getByRole("list", { name: "Players" });
  await expect(seats.locator(`li[aria-label^="${forger.nickname}"]`)).toBeVisible({ timeout: 30_000 });
  await expect(seats.locator(`li[aria-label^="${forger.nickname}"] [data-avatar="spuz"]`)).toBeVisible();
  await expect(seats.locator(`li[aria-label^="${forger.nickname}"] [data-hat]`)).toHaveCount(0);
  await expect(seats.locator('li[aria-label^="You"] [data-hat="shades"]')).toBeVisible();
  const view = forger.page.getByRole("list", { name: "Players" });
  await expect(view.locator(`li[aria-label^="${owner.nickname}"] [data-hat="shades"]`)).toBeVisible({ timeout: 30_000 });
  await expect(view.locator('li[aria-label^="You"] [data-hat]')).toHaveCount(0);

  // Board Bay: the owner invites, the forger joins; each inbox chip shows the other's owned hat only
  const made = await owner.page.request.post("/api/v1/bay", { data: { game: "fourup", mode: "async" } });
  expect(made.ok(), await made.text()).toBe(true);
  const bay = await made.json();
  const join = await forger.page.request.post(`/api/v1/bay/${bay.id}/join`, { data: { code: bay.inviteCode } });
  expect(join.ok(), await join.text()).toBe(true);
  await forger.page.goto("/bay");
  await expect(forger.page.getByTestId("inbox-opponent").first().locator('[data-hat="shades"]')).toBeVisible({ timeout: 15_000 });
  await owner.page.goto("/bay");
  await expect(owner.page.getByTestId("inbox-opponent").first().locator('[data-avatar="spuz"]')).toBeVisible({ timeout: 15_000 });
  await expect(owner.page.getByTestId("inbox-opponent").first().locator("[data-hat]")).toHaveCount(0);

  await owner.ctx.close();
  await forger.ctx.close();
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`R4-H screens at ${label} (${size.width})`, async ({ browser }) => {
    const { owner, forger } = await ownerAndForger(browser, size);
    await forger.page.goto("/friends");
    await expect(forger.page.getByRole("region", { name: "Your friends" }).locator('[data-hat="shades"]')).toBeVisible({
      timeout: 15_000,
    });
    await forger.page.screenshot({ path: `docs/qa/screens/r4/R4-H-friends-${size.width}.png` });
    await noOverflow(forger.page);

    const made = await owner.page.request.post("/api/v1/bay", { data: { game: "fourup", mode: "async" } });
    const bay = await made.json();
    await forger.page.request.post(`/api/v1/bay/${bay.id}/join`, { data: { code: bay.inviteCode } });
    await forger.page.goto("/bay");
    await expect(forger.page.getByTestId("inbox-opponent").first().locator('[data-hat="shades"]')).toBeVisible({ timeout: 15_000 });
    await forger.page.screenshot({ path: `docs/qa/screens/r4/R4-H-bay-inbox-${size.width}.png` });
    await noOverflow(forger.page);

    await owner.ctx.close();
    await forger.ctx.close();
  });
