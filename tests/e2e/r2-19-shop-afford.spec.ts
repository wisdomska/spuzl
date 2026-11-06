import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, VIEWPORTS } from "./harness";
import { SHOP_TABS, canAfford, tabOf } from "@/lib/meta";
import type { ShopRes } from "@/lib/client/social";

/**
 * R2-19 Shop: items the player's Sparks cover carry a "Can afford" badge, and "you can afford this" is in the item's
 * accessible name. Purchase rules are unchanged: the server still decides (an item over budget is refused).
 * Needs the app with the local database (it sets the test guest's Sparks with psql, like lab-games.spec.ts).
 */

const SPARKS = 300;
const setSparks = (nickname: string, n: number) =>
  execSync(
    `PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -qc "update players set sparks = ${n} where nickname = '${nickname}'"`,
  );
const shop = async (page: Page): Promise<ShopRes> => (await page.request.get("/api/v1/shop")).json();
const affordable = (s: ShopRes) =>
  s.items.filter((i) =>
    canAfford(
      { price: i.price, owned: i.owned, unlockLevel: i.unlockLevel, consumable: i.type === "freeze" || i.type === "hint_pack" },
      s.sparks,
      s.level,
      s.freezesHeld,
      i.type === "freeze",
    ),
  );

test("the badge marks exactly the items within the Sparks balance, in their accessible names", async ({ page }) => {
  const nick = await onboardGuest(page);
  setSparks(nick, SPARKS);
  const s = await shop(page);
  expect(s.sparks).toBe(SPARKS);
  const yes = new Set(affordable(s).map((i) => i.id));
  expect(yes.size, "the seed has something under 300 Sparks").toBeGreaterThan(0);

  await page.goto("/shop");
  for (const tab of SHOP_TABS) {
    const tabItems = s.items.filter((i) => tabOf(i.type) === tab.id);
    if (!tabItems.length) continue;
    await page.getByRole("tab", { name: tab.label }).click();
    const list = page.getByRole("listbox", { name: "Items" });
    for (const i of tabItems) {
      const option = list.getByRole("option", { name: new RegExp(`^${i.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first();
      if (yes.has(i.id)) {
        await expect(option, i.name).toHaveAccessibleName(/you can afford this/);
        await expect(option.locator("[data-afford]")).toBeVisible();
      } else {
        await expect(option, i.name).not.toHaveAccessibleName(/you can afford this/);
        await expect(option.locator("[data-afford]")).toHaveCount(0);
      }
    }
  }
});

test("the server still refuses an item over budget (no rule moved to the badge)", async ({ page }) => {
  const nick = await onboardGuest(page);
  setSparks(nick, 0);
  const s = await shop(page);
  const pricey = s.items.find((i) => i.price > 0 && !i.owned && (i.unlockLevel === null || i.unlockLevel <= s.level));
  test.skip(!pricey, "no priced item in the seed");
  const r = await page.request.post("/api/v1/shop/buy", { data: { itemId: pricey!.id, requestId: crypto.randomUUID() } });
  expect(r.ok()).toBe(false);
  expect((await shop(page)).sparks).toBe(0);
  await page.goto("/shop");
  await expect(page.locator("[data-afford]")).toHaveCount(0);
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`screens at ${label} (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size);
    const nick = await onboardGuest(page);
    setSparks(nick, SPARKS);
    await page.goto("/shop");
    await expect(page.locator("[data-afford]").first()).toBeVisible();
    await page.screenshot({ path: `docs/qa/screens/r2/R2-19-shop-${size.width}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
