import { expect, test } from "@playwright/test";
import { guest, uniq } from "../api/helpers";
import { guestContext } from "./harness";

/**
 * Owner, 11 Nov 2026: a Party room holds up to 10. A full room of 10 fits the lobby (five seats a row) and the race
 * standings on a 320 x 568 phone and a 390 x 844 phone, with no sideways scroll.
 *
 * Needs a server with a database (API_BASE and PW_BASE_URL on the same server).
 */
test.describe.configure({ mode: "serial" });

for (const vp of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
]) {
  test(`a room of 10 fits the lobby and the race at ${vp.width} x ${vp.height}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const host = await guestContext(browser, { viewport: vp });
    try {
      const made = await host.page.evaluate(async () => {
        const r = await fetch("/api/v1/rooms", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ game: "crownfall", difficulty: "easy", maxPlayers: 10 }),
        });
        return (await r.json()) as { code: string };
      });
      const others = [];
      for (let i = 0; i < 9; i++) {
        const g = await guest(uniq("ten"));
        expect((await g.api(`/api/v1/rooms/${made.code}/join`, { json: {} })).status).toBe(200);
        others.push(g);
      }
      await host.page.goto(`/party/${made.code}`);
      const seats = host.page.getByRole("list", { name: "Players" }).getByRole("listitem");
      await expect(seats).toHaveCount(10, { timeout: 20_000 });
      await expect(host.page.getByText("10 of 10 in")).toBeVisible();
      const sideways = () => host.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(await sideways()).toBeLessThanOrEqual(0);
      // Five seats a row: two rows.
      const tops = new Set(await seats.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top))));
      expect(tops.size).toBe(2);
      await host.page.screenshot({ path: `docs/qa/screens/r5/party-10-lobby-${vp.width}.png`, fullPage: true });

      for (const g of others) await g.api(`/api/v1/rooms/${made.code}/ready`, { json: { ready: true } });
      const start = host.page.getByRole("button", { name: /^Start(?! without)/ });
      await expect(start).toBeEnabled({ timeout: 20_000 });
      await start.click();
      await expect(host.page.getByRole("button", { name: "Show all 10" })).toBeVisible({ timeout: 30_000 });
      await host.page.waitForTimeout(6_000);
      await expect(host.page.getByRole("list", { name: "Race standings" }).getByRole("listitem")).toHaveCount(5);
      expect(await sideways()).toBeLessThanOrEqual(0);
      await host.page.screenshot({ path: `docs/qa/screens/r5/party-10-race-${vp.width}.png` });
    } finally {
      await host.ctx.close();
    }
  });
}
