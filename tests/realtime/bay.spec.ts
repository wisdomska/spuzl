import { expect, test } from "@playwright/test";
import { admin, inPage, player } from "./helpers";

/**
 * Board Bay live chess between two devices: invite link, the shared board on both screens,
 * server rejection of an illegal move (the board does not change anywhere), legal moves arriving
 * in real time, a draw offer, and resignation.
 */
test("bay: live chess on two devices, illegal moves rejected by the server", async ({ browser }) => {
  const a = await player(browser, "bayA_");
  const b = await player(browser, "bayB_");

  // A opens a live game from the inbox sheet and gets an invite link.
  await a.page.goto("/bay");
  await a.page.getByRole("button", { name: "New game with a friend" }).click();
  await a.page.getByRole("radio", { name: "Live, 5 min clocks" }).click();
  await a.page.getByRole("button", { name: "Invite a friend" }).click();
  await a.page.waitForURL(/\/bay\/[0-9a-f-]{36}$/);
  const id = a.page.url().split("/").pop()!;
  const invite = (await inPage<{ inviteCode: string }>(a.page, `/api/v1/bay/${id}`)).data.inviteCode;

  await b.page.goto(`/bay/${id}?join=${invite}`);
  await b.page.getByRole("button", { name: "Join" }).click();
  await expect(b.page.getByRole("grid", { name: "Chess board, live" })).toBeVisible();
  await expect(a.page.getByRole("grid", { name: "Chess board, live" })).toBeVisible({ timeout: 20_000 });
  await expect(a.page.getByRole("timer", { name: /Your clock 0?5:00|Your clock 04:5\d/ })).toBeVisible();

  // An illegal move sent straight to the API is refused, and nothing moves on either board.
  const bad = await inPage<{ error: string }>(a.page, `/api/v1/bay/${id}/move`, { ply: 0, move: "e2e5" });
  expect(bad.status).toBe(422);
  expect(bad.data.error).toBe("illegal_move");
  const outOfTurn = await inPage<{ error: string }>(b.page, `/api/v1/bay/${id}/move`, { ply: 0, move: "e7e5" });
  expect(outOfTurn.data.error).toBe("not_your_turn");
  await expect(a.page.getByRole("gridcell", { name: "e2, white pawn" })).toBeVisible();
  await expect(b.page.getByRole("gridcell", { name: "e2, white pawn" })).toBeVisible();
  // The board itself only offers legal squares: e5 is not a target for the e2 pawn.
  await a.page.getByRole("gridcell", { name: "e2, white pawn" }).click();
  await expect(a.page.getByRole("gridcell", { name: "e4, legal move" })).toBeVisible();
  await expect(a.page.getByRole("gridcell", { name: "e5, legal move" })).toHaveCount(0);

  // Legal move through the board: B sees it arrive.
  await a.page.getByRole("gridcell", { name: "e4, legal move" }).click();
  await expect(b.page.getByRole("gridcell", { name: "e4, white pawn" })).toBeVisible({ timeout: 15_000 });
  await b.page.getByRole("gridcell", { name: "e7, black pawn" }).click();
  await b.page.getByRole("gridcell", { name: "e5, legal move" }).click();
  await expect(a.page.getByRole("gridcell", { name: "e5, black pawn" })).toBeVisible({ timeout: 15_000 });

  // Draw offer reaches the other device; B declines. Then A resigns and B sees the result.
  await a.page.getByRole("button", { name: "Draw" }).click();
  await expect(b.page.getByText(/offers a draw/)).toBeVisible({ timeout: 15_000 });
  await b.page.getByRole("button", { name: "Decline" }).click();
  await a.page.getByRole("button", { name: "Resign" }).click();
  await expect(b.page.getByText(/You won\. They resigned\./)).toBeVisible({ timeout: 15_000 });
  await expect(a.page.getByRole("button", { name: "Rematch" })).toBeVisible();

  await a.context.close();
  await b.context.close();
});

/**
 * Board Bay Play live: two devices that don't know each other find each other through matchmaking (one from
 * the Chess card on the World page, one from a link), land on the same live board at once, and a move made on
 * one device shows up on the other.
 */
test("bay: play live finds an opponent and the first move arrives in real time", async ({ browser }) => {
  // Only this test's players wait for live chess.
  await admin().from("board_queue").delete().eq("game_id", "chess").is("match_id", null);
  const a = await player(browser, "liveA_");
  const b = await player(browser, "liveB_");

  await a.page.goto("/world/board");
  await a.page.getByRole("link", { name: "Chess: play live against another player" }).click();
  await expect(a.page.getByRole("heading", { name: "Finding an opponent" })).toBeVisible();

  await b.page.goto("/bay?live=chess");
  await b.page.waitForURL(/\/bay\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  await a.page.waitForURL(/\/bay\/[0-9a-f-]{36}$/, { timeout: 20_000 });
  const id = a.page.url().split("/").pop()!;
  expect(b.page.url().split("/").pop()).toBe(id);
  await expect(a.page.getByRole("grid", { name: "Chess board, live" })).toBeVisible();
  await expect(b.page.getByRole("grid", { name: "Chess board, live" })).toBeVisible();

  // A coin decides who has white; whoever it is moves first, and the other device sees it.
  const v = (await inPage<{ rated: boolean; players: { id: string }[] }>(a.page, `/api/v1/bay/${id}`)).data;
  expect(v.rated).toBe(true);
  const [white, black] = v.players[0].id === a.id ? [a, b] : [b, a];
  await expect(white.page.getByRole("timer", { name: /Your clock 0?5:00|Your clock 04:5\d/ })).toBeVisible();
  await white.page.getByRole("gridcell", { name: "e2, white pawn" }).click();
  await white.page.getByRole("gridcell", { name: "e4, legal move" }).click();
  await expect(black.page.getByRole("gridcell", { name: "e4, white pawn" })).toBeVisible({ timeout: 15_000 });

  // The search is over for both: polling the queue answers with the same match while it is on.
  const q = await inPage<{ status: string; matchId?: string }>(black.page, "/api/v1/bay/queue");
  expect(q.data).toMatchObject({ status: "matched", matchId: id });

  await a.context.close();
  await b.context.close();
});
