import { expect, test } from "@playwright/test";
import { guestContext } from "./harness";

/**
 * Owner, 14 Nov 2026: "if I select party mode and change the players to 4, some of the board games can be made
 * available as well". At 4 players the Party host picker offers Board games (Ludo); picking it opens a live Ludo
 * game for 4 with a code to share. At 5 the board games go away.
 *
 * Needs a server with a database.
 */
test("a Party for 4 can open Ludo for 4", async ({ browser }, info) => {
  test.setTimeout(120_000);
  const host = await guestContext(browser, { viewport: { width: 390, height: 844 } });
  try {
    const page = host.page;
    await page.goto("/party?host=1");
    const size = page.locator("#room-size");
    await size.fill("5");
    await expect(page.getByRole("button", { name: /^Board games/i })).toHaveCount(0);
    await size.fill("4");
    await page.getByRole("button", { name: /^Board games/i }).click();
    await expect(page.locator("[data-party-board]")).toHaveCount(1);
    await page.locator('[data-party-board="ludo"]').click();
    await expect(page.getByText("4 players", { exact: true })).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Difficulty" })).toHaveCount(0);
    await page.screenshot({ path: info.outputPath("party-board-4.png") });
    await page.getByRole("button", { name: "Open Ludo for 4" }).click();
    await page.waitForURL(/\/bay\/[0-9a-f-]+/, { timeout: 30_000 });
    const id = page.url().split("/bay/")[1].split("?")[0];
    const v = await page.evaluate(
      async (m) => (await (await fetch(`/api/v1/bay/${m}`)).json()) as { game: string; seats: number; mode: string },
      id,
    );
    expect([v.game, v.seats, v.mode]).toEqual(["ludo", 4, "live"]);
    // The waiting game shows its code to share with the other three.
    await expect(page.getByText(/^[A-Z0-9]{4}$/).first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: info.outputPath("party-board-ludo-invite.png") });
  } finally {
    await host.ctx.close();
  }
});
