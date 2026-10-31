import { expect, test } from "@playwright/test";
import { crownfallRound, inPage, matchIdFrom, player, solveCrownfallInUi } from "./helpers";

/**
 * Two real players, two browser contexts, one Duel over Supabase Realtime: matchmaking, versus and
 * countdown, live opponent progress (never the board), a dropped connection and its return, round
 * end, match end and rematch.
 */
test("duel: two devices play a best of 3 in real time", async ({ browser }) => {
  const a = await player(browser, "duA_");
  const b = await player(browser, "duB_");

  // Entry sheet (M1): pick Crownfall, Quick Match.
  for (const p of [a, b]) {
    await p.page.goto("/duel");
    await expect(p.page.getByRole("dialog", { name: "Duel" })).toBeVisible();
    await p.page.getByRole("radio", { name: /Sixer|Crownfall/ }).click();
    await p.page.getByRole("option", { name: "Crownfall" }).click();
  }
  await a.page.getByRole("button", { name: /Quick Match/ }).click();
  await expect(a.page.getByRole("heading", { name: "Finding a rival" })).toBeVisible();
  await b.page.getByRole("button", { name: /Quick Match/ }).click();

  // Paired: both land on the same match and see the versus intro with each other's names.
  await a.page.waitForURL(/\/duel\?m=/, { timeout: 30_000 });
  await b.page.waitForURL(/\/duel\?m=/, { timeout: 30_000 });
  const id = matchIdFrom(a.page.url());
  expect(matchIdFrom(b.page.url())).toBe(id);
  await expect(a.page.getByText(b.nickname).first()).toBeVisible();
  await expect(b.page.getByText(a.nickname).first()).toBeVisible();

  // Round 1: the board unlocks after 3-2-1-SPUZL!. The strip never shows their board.
  await expect(a.page.getByText("Their board stays hidden")).toBeVisible({ timeout: 15_000 });
  await expect(b.page.getByText("Their board stays hidden")).toBeVisible();
  const view = (await inPage<{ difficulty: string; setNo: number }>(a.page, `/api/v1/matches/${id}`)).data;
  const r1 = crownfallRound(id, view.setNo, 1, view.difficulty);
  await a.page.waitForTimeout(500);
  // A places one crown: B's strip shows A's progress, computed by the server.
  await a.page.getByRole("button", { name: "Crown" }).click();
  await a.page.locator('[role="gridcell"]').nth(r1.crowns[0]).click();
  const oppBar = b.page.getByRole("progressbar", { name: `${a.nickname} progress` });
  await expect(oppBar).not.toHaveAttribute("aria-valuenow", "0", { timeout: 10_000 });
  await expect(b.page.locator('[role="gridcell"]')).toHaveCount(r1.n * r1.n); // B has their own board only
  // A finishes the round through the board.
  for (const i of r1.crowns.slice(1)) await a.page.locator('[role="gridcell"]').nth(i).click();
  await expect(a.page.getByRole("heading", { name: "Round to you" })).toBeVisible({ timeout: 15_000 });
  await expect(b.page.getByRole("heading", { name: `${a.nickname} took it` })).toBeVisible({ timeout: 15_000 });

  // Round 2: B drops out mid-round. A's clock pauses and A sees the reconnect window; B comes back.
  await expect(a.page.getByText("Their board stays hidden")).toBeVisible({ timeout: 20_000 });
  await b.context.setOffline(true);
  await expect(a.page.getByRole("heading", { name: `${b.nickname} lost signal` })).toBeVisible({ timeout: 20_000 });
  await expect(b.page.getByRole("alertdialog", { name: "You dropped out" })).toBeVisible({ timeout: 15_000 });
  await b.context.setOffline(false);
  await expect(a.page.getByText("Their board stays hidden")).toBeVisible({ timeout: 20_000 });
  await expect(b.page.getByRole("alertdialog", { name: "You dropped out" })).toBeHidden({ timeout: 20_000 });

  // A wins round 2: match over, 2-0, with a rating change for both.
  const r2 = crownfallRound(id, view.setNo, 2, view.difficulty);
  await solveCrownfallInUi(a.page, r2.crowns);
  await expect(a.page.getByRole("heading", { name: "You win 2-0" })).toBeVisible({ timeout: 20_000 });
  await expect(b.page.getByRole("heading", { name: `${a.nickname} wins 2-0` })).toBeVisible({ timeout: 20_000 });
  await expect(a.page.getByText(/^\+\d+$/).first()).toBeVisible();

  // Rematch: B asks, A sees the request, A accepts; both move to the same new match.
  await b.page.getByRole("button", { name: "Rematch" }).click();
  await expect(a.page.getByText(`${b.nickname} wants a rematch`)).toBeVisible({ timeout: 15_000 });
  await a.page.getByRole("button", { name: "Rematch" }).click();
  await a.page.waitForURL((u) => matchIdFrom(u.toString()) !== id, { timeout: 20_000 });
  await b.page.waitForURL((u) => matchIdFrom(u.toString()) !== id, { timeout: 20_000 });
  expect(matchIdFrom(a.page.url())).toBe(matchIdFrom(b.page.url()));

  await a.context.close();
  await b.context.close();
});

test("duel: leaving mid-match hands the win to the other device", async ({ browser }) => {
  const a = await player(browser, "lvA_");
  const b = await player(browser, "lvB_");
  await a.page.goto("/duel");
  await a.page.getByRole("button", { name: /Challenge a friend/ }).click();
  const code = (await a.page.getByRole("img", { name: /Room code/ }).getAttribute("aria-label"))!.replace(/Room code |\s/g, "");
  await b.page.goto(`/duel?code=${code.toLowerCase()}`);
  await a.page.waitForURL(/\/duel\?m=/, { timeout: 20_000 });
  await b.page.waitForURL(/\/duel\?m=/, { timeout: 20_000 });
  await expect(b.page.getByText("Their board stays hidden")).toBeVisible({ timeout: 15_000 });
  await b.page.getByRole("button", { name: "Back" }).click();
  await b.page.getByRole("button", { name: "Leave and lose" }).click();
  await expect(a.page.getByRole("heading", { name: /You win/ })).toBeVisible({ timeout: 15_000 });
  await expect(a.page.getByText(`${b.nickname} left the duel. Win counts.`)).toBeVisible();
  await a.context.close();
  await b.context.close();
});
