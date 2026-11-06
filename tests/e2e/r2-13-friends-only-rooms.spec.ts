import { expect, test, type Browser, type Page } from "@playwright/test";
import { onboardGuest, openPartyRoom, type Age } from "./harness";

/**
 * R2-13: an under-16 host's Party room and friend duel are friends only. A stranger with the code gets a clear
 * message and "Request to join"; the host sees the request in the lobby (realtime) and lets them in or says no.
 * Two players in two browser contexts. Needs the dev server and a database, with the admin setting
 * "rooms.under16FriendsOnly" at its default (on). The lead runs it.
 */
test.describe.configure({ mode: "serial" });

async function player(browser: Browser, age: Age): Promise<{ page: Page; nick: string }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const nick = await onboardGuest(page, age);
  return { page, nick };
}

/** The host makes a friend duel from /duel; returns its 4-character code (read from the code's accessible name). */
async function hostDuel(page: Page): Promise<string> {
  await page.goto("/duel");
  await page
    .getByRole("region", { name: "Duel" })
    .getByRole("button", { name: /Challenge a friend/ })
    .click();
  const code = page.getByRole("img", { name: /^Room code / });
  await expect(code).toBeVisible({ timeout: 15_000 });
  return ((await code.getAttribute("aria-label")) ?? "").replace("Room code ", "").replace(/ /g, "");
}

test("party: a stranger asks to join an under-16 host's room, the host lets them in from the lobby", async ({ browser }) => {
  const host = await player(browser, "13-15");
  const guest = await player(browser, "18+");
  const code = await openPartyRoom(host.page);
  await expect(host.page.getByText("Friends only. Anyone else has to ask, and you decide.")).toBeVisible();

  await guest.page.goto(`/party/${code}`);
  await expect(guest.page.getByRole("heading", { name: /friends only/i })).toBeVisible();
  await expect(guest.page.getByRole("button", { name: /^Join$/ })).toHaveCount(0);
  await guest.page.getByRole("button", { name: "Request to join" }).click();
  await expect(guest.page.getByRole("heading", { name: "Request sent" })).toBeVisible();

  // The request reaches the host's lobby on the room channel (the slow poll is 15 s; allow for it as a fallback).
  const card = host.page.getByRole("region", { name: "1 player wants to join" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText(guest.nick)).toBeVisible();
  await card.getByRole("button", { name: `Let ${guest.nick} in` }).click();
  await expect(card).toBeHidden();

  // The asker joins on their own once approved, and the host sees them in the room.
  await expect(guest.page.getByRole("heading", { name: "Party room" })).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("list", { name: "Players" }).getByText(guest.nick)).toBeVisible({ timeout: 15_000 });
});

test("party: the host says no, and the asker is told plainly and stays out", async ({ browser }) => {
  const host = await player(browser, "13-15");
  const guest = await player(browser, "18+");
  const code = await openPartyRoom(host.page);
  await guest.page.goto(`/party/${code}`);
  await guest.page.getByRole("button", { name: "Request to join" }).click();
  const card = host.page.getByRole("region", { name: "1 player wants to join" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: `Say no to ${guest.nick}` }).click();
  await expect(guest.page.getByRole("heading", { name: "Not this time" })).toBeVisible({ timeout: 15_000 });
  await expect(host.page.getByRole("list", { name: "Players" }).getByText(guest.nick)).toHaveCount(0);
});

test("duel: a stranger with the code asks, the 15-year-old host approves, and the duel starts", async ({ browser }) => {
  const host = await player(browser, "13-15");
  const guest = await player(browser, "18+");
  const code = await hostDuel(host.page);

  await guest.page.goto(`/duel?code=${code}`);
  await expect(guest.page.getByRole("heading", { name: /friends only/i })).toBeVisible({ timeout: 15_000 });
  await guest.page.getByRole("button", { name: "Request to join" }).click();
  await expect(guest.page.getByRole("heading", { name: "Request sent" })).toBeVisible();

  const card = host.page.getByRole("region", { name: "1 player wants to join" });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByRole("button", { name: `Let ${guest.nick} in` }).click();

  await guest.page.waitForURL(/\/duel\?m=/, { timeout: 20_000 });
  await host.page.waitForURL(/\/duel\?m=/, { timeout: 20_000 });
});

test("a 16+ host's party room stays open to anyone with the code", async ({ browser }) => {
  const host = await player(browser, "16-17");
  const guest = await player(browser, "18+");
  const code = await openPartyRoom(host.page);
  await guest.page.goto(`/party/${code}`);
  await expect(guest.page.getByRole("button", { name: "Request to join" })).toHaveCount(0);
  await guest.page.getByRole("button", { name: /^Join$/ }).click();
  await expect(guest.page.getByRole("heading", { name: "Party room" })).toBeVisible({ timeout: 15_000 });
});
