import { expect, test } from "@playwright/test";
import { crownfallRound, inPage, player, type Player } from "./helpers";

/**
 * Party Race with 8 browser contexts: room code join (lowercase), lobby presence and ready states,
 * the host leaving (host moves on), the live rail, simultaneous finishes and a consistent podium.
 */
test("party: 8 devices race, host leaves, everyone sees the same podium", async ({ browser }) => {
  test.setTimeout(300_000);
  const host = await player(browser, "phost_");
  await host.page.goto("/party");
  await host.page.getByRole("radio", { name: "Crownfall" }).click();
  await host.page.getByRole("radio", { name: "Easy" }).click();
  await host.page.getByRole("button", { name: "Open room" }).click();
  await host.page.waitForURL(/\/party\/[A-Z2-9]{4}$/);
  const code = host.page.url().split("/").pop()!;
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}$/);
  await expect(host.page.getByText("1 of 8 in")).toBeVisible();

  const guests: Player[] = [];
  for (let i = 0; i < 7; i++) guests.push(await player(browser, `pg${i}_`));
  for (const g of guests) {
    await g.page.goto(`/party/${code.toLowerCase()}`);
    await g.page.getByRole("button", { name: "Join" }).click();
    await expect(g.page.getByRole("heading", { name: "Party room" })).toBeVisible();
  }
  // Everyone sees everyone (server view, pushed over the channel).
  await expect(host.page.getByText("8 of 8 in")).toBeVisible({ timeout: 20_000 });
  await expect(host.page.getByRole("listitem", { name: new RegExp(`^${guests[6].nickname}, not ready`) })).toBeVisible();
  for (const g of guests) await g.page.getByRole("button", { name: "Ready" }).click();
  await expect(host.page.getByRole("button", { name: /Start.*8 of 8 ready/ })).toBeVisible({ timeout: 20_000 });

  // The host walks out of the lobby: the earliest joiner becomes host and gets the Start button.
  await host.page.getByRole("button", { name: "Leave room" }).click();
  await host.page.waitForURL(/\/party$/);
  const newHost = guests[0];
  await expect(newHost.page.getByRole("button", { name: /Start/ })).toBeVisible({ timeout: 20_000 });
  await expect(guests[3].page.getByText("7 of 8 in")).toBeVisible({ timeout: 20_000 });
  await newHost.page.getByRole("button", { name: /Start/ }).click();

  // Countdown, then the race rail with all seven racers on every device.
  for (const g of guests) await expect(g.page.getByRole("list", { name: "Race standings" })).toBeVisible({ timeout: 20_000 });
  const matchId = (await inPage<{ member: boolean; view: { id: string } }>(newHost.page, `/api/v1/rooms/${code}`)).data.view.id;
  const v = (await inPage<{ setNo: number; difficulty: string; games: string[]; roundStartedAt: number; serverNow: number }>(newHost.page, `/api/v1/matches/${matchId}`)).data;
  expect(v.games[0]).toBe("crownfall");
  await newHost.page.waitForTimeout(Math.max(0, v.roundStartedAt - v.serverNow) + 300);
  for (const g of guests) await expect(g.page.getByRole("list", { name: "Race standings" }).getByRole("listitem")).toHaveCount(7);

  // One racer plays through the board; the others' rails show that progress live.
  const r = crownfallRound(matchId, v.setNo, 1, v.difficulty);
  const racer = guests[1];
  await racer.page.getByRole("button", { name: "Crown" }).click();
  await racer.page.locator('[role="gridcell"]').nth(r.crowns[0]).click();
  await expect(guests[5].page.getByRole("listitem", { name: new RegExp(`${racer.nickname}, [1-9]\\d? percent`) })).toBeVisible({ timeout: 15_000 });

  // Everyone else submits the solution at the same instant: the server times them all once.
  await Promise.all(
    guests.filter((g) => g !== racer).map((g) => inPage(g.page, `/api/v1/matches/${matchId}/finish`, { round: 1, state: r.state, mistakes: 0 })),
  );
  for (const i of r.crowns.slice(1)) await racer.page.locator('[role="gridcell"]').nth(i).click();

  // Podium: every device agrees on the winner.
  const titles = new Set<string>();
  for (const g of guests) {
    const h = g.page.getByRole("heading", { name: /takes? it/ });
    await expect(h).toBeVisible({ timeout: 30_000 });
    const t = (await h.textContent())!;
    titles.add(t.startsWith("You take it") ? `${g.nickname} takes it` : t);
  }
  expect(titles.size).toBe(1);
  await expect(newHost.page.getByRole("button", { name: "Next game" })).toBeVisible();
  await expect(guests[2].page.getByText(/Waiting for .* to start the next game/)).toBeVisible();

  // TV mode shows the same room on a 1280 x 720 screen.
  const tv = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState: await newHost.context.storageState() });
  const tvPage = await tv.newPage();
  await tvPage.goto(`/party/${code}?view=tv`);
  await expect(tvPage.getByText("Join with")).toBeVisible();
  await expect(tvPage.getByText(code, { exact: true })).toBeVisible();

  await tv.close();
  await host.context.close();
  for (const g of guests) await g.context.close();
});
