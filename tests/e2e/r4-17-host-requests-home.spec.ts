import { expect, test } from "@playwright/test";
import { guestContext, openPartyRoom } from "./harness";

/**
 * R4-17: a 15-year-old Party host who left the lobby for Home still hears about requests to join their friends-only
 * room: a card on Home names the asker and the room, with Let in and Say no. Letting them in from Home works like
 * the lobby (the asker joins by themselves). Home polls every 20 s. Needs the app with a database (the lead runs it).
 */

test("a host on Home lets a waiting player in, and the player joins the room", async ({ browser }) => {
  const host = await guestContext(browser, { age: "13-15" });
  const asker = await guestContext(browser, { age: "18+" });
  const code = await openPartyRoom(host.page);
  await host.page.goto("/");

  await asker.page.goto(`/party/${code}`);
  await asker.page.getByRole("button", { name: "Request to join" }).click();
  await expect(asker.page.getByRole("heading", { name: "Request sent" })).toBeVisible();

  const card = host.page.getByTestId("host-requests");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await expect(card.getByRole("heading", { name: "Someone wants to join your room" })).toBeVisible();
  await expect(card.getByText(asker.nickname)).toBeVisible();
  await expect(card.getByText(`wants to join room ${code}`)).toBeVisible();
  await expect(card.getByRole("link", { name: `Back to room ${code}` })).toHaveAttribute("href", `/party/${code}`);
  await host.page.screenshot({ path: "docs/qa/screens/r4/r4-17-home-card-375.png" });
  await card.getByRole("button", { name: `Let ${asker.nickname} in` }).click();
  await expect(card).toBeHidden({ timeout: 10_000 });

  await expect(asker.page.getByRole("heading", { name: "Party room" })).toBeVisible({ timeout: 15_000 });
  await host.ctx.close();
  await asker.ctx.close();
});

test("saying no from Home tells the asker plainly", async ({ browser }) => {
  const host = await guestContext(browser, { age: "13-15" });
  const asker = await guestContext(browser, { age: "18+" });
  const code = await openPartyRoom(host.page);
  await host.page.goto("/");
  await asker.page.goto(`/party/${code}`);
  await asker.page.getByRole("button", { name: "Request to join" }).click();
  const card = host.page.getByTestId("host-requests");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: `Say no to ${asker.nickname}` }).click();
  await expect(asker.page.getByRole("heading", { name: "Not this time" })).toBeVisible({ timeout: 15_000 });
  await host.ctx.close();
  await asker.ctx.close();
});

test("16+ players never see the card", async ({ browser }) => {
  const adult = await guestContext(browser, { age: "18+" });
  await adult.page.goto("/");
  await adult.page.waitForTimeout(1_500);
  await expect(adult.page.getByTestId("host-requests")).toHaveCount(0);
  await adult.ctx.close();
});
