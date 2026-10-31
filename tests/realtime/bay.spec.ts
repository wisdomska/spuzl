import { expect, test } from "@playwright/test";
import { inPage, player } from "./helpers";

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
