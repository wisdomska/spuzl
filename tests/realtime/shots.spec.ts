import { test, type Page } from "@playwright/test";
import { admin, crownfallRound, inPage, player } from "./helpers";

/** Visual review captures (not assertions): SHOTS=1 pnpm playwright test -c tests/realtime/playwright.config.ts shots */
test.skip(!process.env.SHOTS, "visual captures run on demand");
test.setTimeout(300_000);

const OUT = process.env.SHOTS_DIR ?? "test-results/shots";
const theme = (process.env.SHOTS_THEME ?? "dark") as "dark" | "light";
const snap = (p: Page, name: string) => p.screenshot({ path: `${OUT}/${name}-${theme}.png` });

test("capture multiplayer screens", async ({ browser }) => {
  const a = await player(browser, "Ama_");
  const b = await player(browser, "Tunde_");
  for (const p of [a, b]) await p.context.addInitScript((t) => localStorage.setItem("spuzl.settings", JSON.stringify({ theme: t })), theme);

  // Party: lobby, race, podium, TV.
  const room = (
    await inPage<{ code: string; matchId: string }>(await go(a.page, "/party"), "/api/v1/rooms", { game: "crownfall", difficulty: "easy" })
  ).data;
  await b.page.goto(`/party/${room.code}`);
  await b.page.getByRole("button", { name: "Join" }).click();
  await a.page.goto(`/party/${room.code}`);
  await b.page.getByRole("button", { name: "Ready" }).click();
  await a.page.waitForTimeout(2500);
  await snap(a.page, "p1-lobby");
  await a.page.getByRole("button", { name: /Start/ }).click();
  await a.page.waitForTimeout(1200);
  await snap(a.page, "p-countdown");
  await a.page.waitForTimeout(3500);
  const v = (await inPage<{ setNo: number }>(a.page, `/api/v1/matches/${room.matchId}`)).data;
  const r = crownfallRound(room.matchId, v.setNo, 1, "easy");
  await a.page.getByRole("button", { name: "Crown" }).click();
  await a.page.locator('[role="gridcell"]').nth(r.crowns[0]).click();
  await a.page.waitForTimeout(1500);
  await snap(a.page, "p2-race");
  const tv = await browser.newContext({ viewport: { width: 1280, height: 720 }, storageState: await a.context.storageState() });
  const tvp = await tv.newPage();
  await tvp.goto(`/party/${room.code}?view=tv`);
  await tvp.waitForTimeout(3000);
  await tvp.screenshot({ path: `${OUT}/t1-tv-${theme}.png` });
  await inPage(b.page, `/api/v1/matches/${room.matchId}/finish`, { round: 1, state: r.state, mistakes: 0 });
  await inPage(a.page, `/api/v1/matches/${room.matchId}/finish`, { round: 1, state: r.state, mistakes: 1 });
  await a.page.waitForTimeout(3000);
  await snap(a.page, "p3-podium");
  await tv.close();

  // Duel vs a friend: versus, in match, round end, match end.
  await a.page.goto("/duel");
  await a.page.waitForTimeout(1500);
  await snap(a.page, "m1-entry");
  await a.page.getByRole("button", { name: /Challenge a friend/ }).click();
  const code = (await a.page.getByRole("img", { name: /Room code/ }).getAttribute("aria-label"))!.replace(/Room code |\s/g, "");
  await b.page.goto(`/duel?code=${code}`);
  await a.page.waitForURL(/\?m=/);
  const id = new URL(a.page.url()).searchParams.get("m")!;
  await a.page.waitForTimeout(700);
  await snap(a.page, "d2-versus");
  await a.page.waitForTimeout(5500);
  const dv = (await inPage<{ setNo: number; difficulty: string }>(a.page, `/api/v1/matches/${id}`)).data;
  const d1 = crownfallRound(id, dv.setNo, 1, dv.difficulty);
  const games = (await admin().from("matches").select("games").eq("id", id).single()).data!.games as string[];
  if (games[0] === "crownfall") {
    await b.page.getByRole("button", { name: "Crown" }).click();
    for (const i of d1.crowns.slice(0, 2)) await b.page.locator('[role="gridcell"]').nth(i).click();
  }
  await a.page.waitForTimeout(1500);
  await snap(a.page, "d3-in-match");
  await admin()
    .from("match_players")
    .update({ last_seen_at: new Date(Date.now() - 9000).toISOString() })
    .eq("match_id", id)
    .eq("player_id", b.id);
  await b.context.setOffline(true);
  await a.page.waitForTimeout(6000);
  await snap(a.page, "m3-disconnected");
  await b.context.setOffline(false);
  await a.page.waitForTimeout(4000);
  if (games[0] === "crownfall") {
    await inPage(b.page, `/api/v1/matches/${id}/finish`, { round: 1, state: d1.state, mistakes: 0 });
    await a.page.waitForTimeout(2000);
    await snap(a.page, "m2-round-end");
  }
  await inPage(a.page, `/api/v1/matches/${id}/leave`, {});
  await b.page.waitForTimeout(3500);
  await snap(b.page, "d4-match-end");

  // Board Bay against the Practice bot, and the inbox.
  const bay = (await inPage<{ id: string }>(a.page, "/api/v1/bay", { game: "chess", mode: "live", bot: true })).data;
  await a.page.goto(`/bay/${bay.id}`);
  await a.page.waitForTimeout(2500);
  await a.page.getByRole("gridcell", { name: "e2, white pawn" }).click();
  await a.page.getByRole("gridcell", { name: "e4, legal move" }).click();
  await a.page.waitForTimeout(2500);
  await snap(a.page, "b3-chess");
  await a.page.goto("/bay");
  await a.page.waitForTimeout(2500);
  await snap(a.page, "b7-inbox");
  await a.context.close();
  await b.context.close();
});

async function go(p: Page, path: string) {
  await p.goto(path);
  return p;
}
