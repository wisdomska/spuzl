import { expect, test, type Browser, type Page } from "@playwright/test";
import { GAME_BY_ID } from "@/lib/catalog";
import { duelVsBot, keepFocus, onboardGuest, openTestBoard, partyRoom, tapCell, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-06 Visible rules. The game's one-line rule (`meta.rule`) shows under the title until the first move, then folds
 * away (instantly with reduced motion) and lives on at the top of the game menu. The screen-reader copy that
 * describes the board stays. The rule is there from the first paint: the board never moves down when it arrives.
 * Every mode: seeded boards (no database) for the layout checks, then free, level, Daily Five, Duel and Party.
 *
 * Screenshots: docs/qa/screens/r2/r2-06-<name>-<375|1280>.png. The live-mode tests need a server with a database.
 */
const shot = (page: Page, name: string, w: number) => page.screenshot({ path: `docs/qa/screens/r2/r2-06-${name}-${w}.png` });
const rule = (page: Page) => page.locator("[data-shell-rule]");
const CROWNFALL = GAME_BY_ID.crownfall.rule;

for (const [label, vp] of Object.entries(VIEWPORTS)) {
  test.describe(`at ${vp.width} px (${label})`, () => {
    test.use({ viewport: vp });

    test("the rule shows under the title until the first move, then lives in the menu", async ({ page }) => {
      await openTestBoard(page, "crownfall", "r2-06");
      await expect(rule(page)).toHaveText(CROWNFALL);
      // Next to the title: in the header's middle on a wide screen, right under the top bar on a phone.
      const head = (await page.locator("header").first().boundingBox())!;
      const line = (await rule(page).boundingBox())!;
      if (vp.width >= 900) expect(line.y + line.height).toBeLessThanOrEqual(head.y + head.height + 1);
      else expect(line.y).toBeGreaterThanOrEqual(head.y + head.height - 1);
      // The screen-reader text that describes the board is still there.
      await expect(page.locator("#rule-crownfall")).toHaveText(CROWNFALL);
      await expect(page.locator("main[data-shell-slot]")).toHaveAttribute("aria-describedby", "rule-crownfall");
      // No push: the board stays where it first painted.
      const board = page.locator("main[data-shell-slot]");
      const y0 = (await board.boundingBox())!.y;
      await page.waitForTimeout(800);
      expect((await board.boundingBox())!.y).toBe(y0);
      await shot(page, "before-move", vp.width);

      await tapCell(page, 1, 1);
      await expect(rule(page)).toHaveCount(0);
      // Collapsing only ever moves the board up, never down.
      expect((await board.boundingBox())!.y).toBeLessThanOrEqual(y0);
      await shot(page, "after-move", vp.width);

      await page.getByRole("button", { name: "Game menu" }).click();
      const inMenu = page.locator("[data-menu-rule]");
      await expect(inMenu).toContainText(CROWNFALL);
      await expect(page.getByRole("menu")).toBeVisible();
      await shot(page, "menu", vp.width);
    });

    test("reduced motion: the rule goes at once, no animation", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await openTestBoard(page, "crownfall", "r2-06-rm");
      await expect(rule(page)).toBeVisible();
      await tapCell(page, 2, 2);
      await expect(rule(page)).toHaveCount(0, { timeout: 150 });
    });
  });
}

test.describe("every mode shows the rule before the first move", () => {
  test.use({ viewport: VIEWPORTS.phone });

  test("free play, level mode and the Daily Five", async ({ page }) => {
    test.setTimeout(180_000);
    await keepFocus(page);
    await onboardGuest(page);
    for (const href of ["/play/dusk?mode=free", "/play/dusk?mode=level", "/play/crownfall?mode=level"]) {
      await page.goto(href);
      await waitForBoard(page);
      const id = new URL(href, "http://x").pathname.split("/")[2];
      await expect(rule(page), href).toHaveText(GAME_BY_ID[id].rule);
    }
    const five = (await (await page.request.get("/api/v1/daily-five")).json()) as { games: { game: string }[] };
    await page.goto(`/play/${five.games[0].game}?mode=five`);
    await waitForBoard(page);
    await expect(rule(page)).toHaveText(GAME_BY_ID[five.games[0].game].rule);
    await shot(page, "daily-five", 375);
  });

  test("Duel: the rule is up during the countdown", async ({ page }) => {
    test.setTimeout(120_000);
    await keepFocus(page);
    await onboardGuest(page);
    await duelVsBot(page);
    await expect(rule(page)).toHaveText(GAME_BY_ID.sixer.rule);
    await shot(page, "duel", 375);
  });

  test("Party: the rule is up for every player at round start", async ({ browser }) => {
    test.setTimeout(180_000);
    const { code, players } = await partyRoom(browser as Browser, 2);
    try {
      const [host, guest] = players;
      await host.page.evaluate(
        (c) =>
          fetch(`/api/v1/rooms/${c}/settings`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ game: "crownfall", difficulty: "easy" }),
          }),
        code,
      );
      await guest.page.getByRole("button", { name: /^Ready$/ }).click();
      // Start only once the host sees everyone ready (the room refuses a start while someone is still getting ready).
      await expect(host.page.getByText(/2 of 2 ready/)).toBeVisible({ timeout: 15_000 });
      await host.page.getByRole("button", { name: /^Start/ }).click();
      for (const p of players) await expect(rule(p.page)).toHaveText(CROWNFALL, { timeout: 15_000 });
      await shot(guest.page, "party", 375);
    } finally {
      for (const p of players) await p.ctx.close();
    }
  });
});
