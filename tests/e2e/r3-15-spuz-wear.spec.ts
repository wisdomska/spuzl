import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { onboardGuest, tapCell, VIEWPORTS, waitForBoard } from "./harness";
import { solve, type CrownfallPuzzle } from "@/games/crownfall/logic";

/**
 * R3-15 (owner: "now that I've given mine shades, it should show everywhere"): a hat bought and worn in the Shop
 * shows on the player's Spuz on Home, on the result bar after a clear, and on the game-over card.
 * Needs the app with a database: it sets the test guest's Sparks through the service role (SUPABASE_SERVICE_ROLE_KEY).
 */

const setSparks = async (nickname: string, n: number) => {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { error } = await db.from("players").update({ sparks: n }).eq("nickname", nickname);
  if (error) throw error;
};

/** Onboards a guest, then buys and wears Shades through the real Shop API. */
async function guestInShades(page: Page) {
  const nick = await onboardGuest(page);
  await setSparks(nick, 1000);
  const buy = await page.request.post("/api/v1/shop/buy", { data: { itemId: "hat-shades", requestId: crypto.randomUUID() } });
  expect(buy.ok(), await buy.text()).toBe(true);
  const equip = await page.request.post("/api/v1/shop/equip", { data: { itemId: "hat-shades", equip: true } });
  expect(equip.ok(), await equip.text()).toBe(true);
  expect((await (await page.request.get("/api/v1/me")).json()).hat).toBe("shades");
  return nick;
}

const shades = (page: Page) => page.locator('[data-hat="shades"]');

/** Clears a free Crownfall board by tapping its solution (the puzzle comes from the attempt the page starts). */
async function clearFreeCrownfall(page: Page) {
  const started = page.waitForResponse((r) => r.url().endsWith("/api/v1/attempts") && r.request().method() === "POST");
  await page.goto("/play/crownfall?mode=free");
  const puzzle = (await (await started).json()).puzzle as CrownfallPuzzle;
  await waitForBoard(page);
  const sol = solve(puzzle)!;
  for (let r = 0; r < sol.length; r++) {
    await tapCell(page, r + 1, sol[r] + 1);
    await tapCell(page, r + 1, sol[r] + 1);
    if (r === 0) await page.waitForTimeout(6500); // above the human floor
  }
}

/** A finished Board Bay game: a match against the Practice bot, resigned through the API, then opened. */
async function finishedBayGame(page: Page) {
  const m = await page.request.post("/api/v1/bay", { data: { game: "fourup", mode: "async", bot: true } });
  const { id } = await m.json();
  const r = await page.request.post(`/api/v1/bay/${id}/action`, { data: { action: "resign" } });
  expect(r.ok(), await r.text()).toBe(true);
  await page.goto(`/bay/${id}`);
  return page.getByRole("alertdialog", { name: "You lost" });
}

test("the worn hat shows on Home, on the result bar and on the game-over card", async ({ page }) => {
  await guestInShades(page);

  await page.goto("/");
  const home = page.locator("section[aria-label='The Grid']");
  await expect(shades(page).first()).toBeVisible({ timeout: 15_000 });
  await expect(home.locator('[data-hat="shades"]')).toHaveCount(1);

  await clearFreeCrownfall(page);
  const bar = page.getByRole("status").filter({ hasText: "Cleared" });
  await expect(bar).toBeVisible({ timeout: 15_000 });
  await expect(bar.locator('[data-hat="shades"]')).toBeVisible();

  const card = await finishedBayGame(page);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card.locator('[data-hat="shades"]')).toBeVisible();
});

test("a guest with no hat shows none (and the default Spuz still draws)", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/");
  await expect(page.locator("section[aria-label='The Grid'] .spuz-root").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[data-hat]")).toHaveCount(0);
});

for (const [label, size] of Object.entries(VIEWPORTS))
  test(`screens at ${label} (${size.width})`, async ({ page }) => {
    await page.setViewportSize(size);
    await guestInShades(page);
    const noOverflow = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)).toBe(false);

    await page.goto("/");
    await expect(shades(page).first()).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `docs/qa/screens/r3/R3-15-home-${size.width}.png` });
    await noOverflow();

    await clearFreeCrownfall(page);
    await expect(page.getByRole("status").filter({ hasText: "Cleared" }).locator('[data-hat="shades"]')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `docs/qa/screens/r3/R3-15-result-${size.width}.png` });
    await noOverflow();

    const card = await finishedBayGame(page);
    await expect(card.locator('[data-hat="shades"]')).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: `docs/qa/screens/r3/R3-15-game-over-${size.width}.png` });
    await noOverflow();
  });
