import { expect, test, type Page } from "@playwright/test";
import { GAME_BY_ID } from "@/lib/catalog";
import { keepFocus, onboardGuest, partyRoom, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-07 Practice round on the first open of a game, from any entry. A fresh guest (practice rounds kept: `guided`)
 * taps Continue to a ladder game (level mode, which used to skip it) and sees the practice round; the same from a
 * Library card, a deep link in level mode and a game vs the bot. No attempt is primed on the tap while the practice
 * round comes first. In a Party room the lobby offers "Practice first"; once the round starts, a 10-second How it
 * works card shows instead (it never blocks the race).
 *
 * Needs a server with a database (the lead runs it). Screenshots: docs/qa/screens/r2/r2-07-<name>-<375|1280>.png.
 */
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-07-${name}-${w}.png` });
const practice = (page: Page, name: string) => page.getByText(`First time playing ${name}?`);

/** Counts attempt starts (POST /api/v1/attempts) from now on. */
function countStarts(page: Page) {
  const n = { starts: 0 };
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/v1/attempts") n.starts++;
  });
  return n;
}

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`at ${vp.width} px (${label})`, () => {
    test.use({ viewport: vp });

    test("fresh guest: Continue to a ladder game opens the practice round, and nothing is primed", async ({ page }) => {
      test.setTimeout(120_000);
      await keepFocus(page);
      await onboardGuest(page, { guided: true });
      // Continue opens ladder games in level mode (R2-01): the Home card's link.
      const cont = page.locator('a[href*="?mode=level"]').first();
      await expect(cont).toBeVisible({ timeout: 30_000 });
      const href = (await cont.getAttribute("href"))!;
      const id = href.split("/")[2].split("?")[0];
      const starts = countStarts(page);
      await cont.click();
      await page.waitForURL(/mode=level/);
      await expect(practice(page, GAME_BY_ID[id].name)).toBeVisible({ timeout: 30_000 });
      // The guided round makes a primed attempt useless: none was started.
      expect(starts.starts).toBe(0);
      await shot(page, "continue", vp.width);
      // Skip: then the real level starts (one attempt now).
      await page.getByRole("button", { name: `Skip the ${GAME_BY_ID[id].name} practice round` }).click();
      await waitForBoard(page);
      await expect.poll(() => starts.starts).toBe(1);
      // Remembered: the next open goes straight in.
      await page.goto(href);
      await waitForBoard(page);
      await expect(practice(page, GAME_BY_ID[id].name)).toHaveCount(0);
    });

    test("fresh guest: a Library card opens the practice round", async ({ page }) => {
      test.setTimeout(120_000);
      await keepFocus(page);
      await onboardGuest(page, { guided: true });
      await page.goto("/library");
      await page.getByRole("searchbox").fill("dusk");
      await page.getByRole("button", { name: /^Dusk / }).click();
      const card = page.getByRole("dialog");
      await expect(card.getByRole("heading", { name: "Dusk" })).toBeVisible();
      const starts = countStarts(page);
      await card.getByRole("button", { name: "Play", exact: true }).click();
      await expect(practice(page, "Dusk")).toBeVisible({ timeout: 30_000 });
      expect(starts.starts).toBe(0);
      await shot(page, "library", vp.width);
    });
  });
}

test.describe("other entries", () => {
  test.use({ viewport: VIEWPORTS.phone });

  test("a deep link in level mode and a game vs the bot", async ({ page }) => {
    test.setTimeout(120_000);
    await keepFocus(page);
    await onboardGuest(page, { guided: true });
    await page.goto("/play/sixer?mode=level");
    await expect(practice(page, "Sixer")).toBeVisible({ timeout: 30_000 });
    await page.goto("/play/fourup/bot");
    await expect(practice(page, GAME_BY_ID.fourup.name)).toBeVisible({ timeout: 30_000 });
    await shot(page, "bot", 375);
    await page.getByRole("button", { name: `Skip the ${GAME_BY_ID.fourup.name} practice round` }).click();
    await waitForBoard(page);
  });

  test("Party: Practice first in the lobby, then How it works as the round starts", async ({ browser }) => {
    test.setTimeout(240_000);
    const { code, players } = await partyRoom(browser, 2, { host: { guided: true }, guests: { guided: true } });
    const [host, guest] = players;
    try {
      await host.page.evaluate(
        (c) =>
          fetch(`/api/v1/rooms/${c}/settings`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ game: "crownfall", difficulty: "easy" }),
          }),
        code,
      );
      // Before the round: the offer, and the practice round opens over the lobby and comes back to it.
      const offer = guest.page.getByRole("button", { name: "Practice Crownfall first" });
      await expect(offer).toBeVisible({ timeout: 15_000 });
      await shot(guest.page, "party-offer", 375);
      await offer.click();
      await expect(practice(guest.page, "Crownfall")).toBeVisible({ timeout: 30_000 });
      await guest.page.getByRole("button", { name: "Skip the Crownfall practice round" }).click();
      await expect(offer).toHaveCount(0); // learned now
      // The host never practised: the round starts and the How it works card shows instead, then closes.
      await guest.page.getByRole("button", { name: /^Ready$/ }).click();
      await host.page.getByRole("button", { name: /^Start/ }).click();
      const how = host.page.getByRole("region", { name: "How Crownfall works" });
      await expect(how).toBeVisible({ timeout: 15_000 });
      await expect(how).toContainText(GAME_BY_ID.crownfall.rule);
      await shot(host.page, "how-it-works", 375);
      await expect(guest.page.getByRole("region", { name: "How Crownfall works" })).toHaveCount(0);
      await expect(how).toHaveCount(0, { timeout: 15_000 }); // closes by itself after 10 s
    } finally {
      for (const p of players) await p.ctx.close();
    }
  });
});
