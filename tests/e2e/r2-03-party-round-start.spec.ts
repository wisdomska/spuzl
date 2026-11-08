import { expect, test, type Page } from "@playwright/test";
import { partyRoom } from "./harness";
import { QUICK_PHRASES } from "@/lib/multiplayer/chat";

/**
 * R2-03: Party round start. When the host starts a round every open sheet closes (Chat first of all), Duel's
 * 3-2-1-SPUZL! countdown runs over the board, and the board takes no input until the round really starts. Chat
 * stays shut while the race runs, so a message never covers the board. Results: "Next game (2 of 3)" is the primary
 * action until the set ends, then "Run it back"; standings are in rank order with "You" marked.
 *
 * Needs a server with a database (the lead runs it):
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r2-03-party-round-start.spec.ts --project=phone-375
 */
test.describe.configure({ mode: "serial" });

type Player = Awaited<ReturnType<typeof partyRoom>>["players"][number];

const countdown = (page: Page) => page.getByTestId("round-countdown");
const chatSheet = (page: Page) => page.getByRole("dialog", { name: "Chat" });

/** The host picks Crownfall (a grid board, so a frozen tap can be checked), through the room's own settings API. */
async function pickCrownfall(host: Page, code: string) {
  const status = await host.evaluate(
    (c) =>
      fetch(`/api/v1/rooms/${c}/settings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: "crownfall", difficulty: "easy" }),
        credentials: "same-origin",
      }).then((r) => r.status),
    code,
  );
  expect(status).toBe(200);
}

async function everyoneReady(players: Player[]) {
  for (const g of players.slice(1)) {
    await g.page.getByRole("button", { name: /^Ready$/ }).click();
    await expect(g.page.getByRole("button", { name: /Ready\. Waiting for the host/ })).toBeVisible({ timeout: 15_000 });
  }
}

async function matchIdOf(page: Page, code: string): Promise<string> {
  return page.evaluate(
    (c) =>
      fetch(`/api/v1/rooms/${c}`)
        .then((r) => r.json())
        .then((d) => d.view.id as string),
    code,
  );
}

for (const n of [2, 8]) {
  test(`partyRoom(${n}): starting a round closes Chat, shows the countdown and freezes the board until SPUZL!`, async ({ browser }) => {
    test.setTimeout(n * 60_000);
    const { code, players } = await partyRoom(browser, n);
    const [host, ...guests] = players;
    try {
      await pickCrownfall(host.page, code);
      await everyoneReady(players);

      // A guest has Chat open (from the lobby's Chat button) when the host starts.
      const reader = guests[0].page;
      await reader.getByRole("button", { name: /^Chat/ }).click();
      await expect(chatSheet(reader)).toBeVisible();
      await host.page.getByRole("button", { name: /^Start(?! without)/ }).click();

      // Every player at once: the countdown runs over the board and no sheet is open.
      await Promise.all(players.map((p) => expect(countdown(p.page)).toBeVisible({ timeout: 10_000 })));
      await Promise.all(players.map((p) => expect(chatSheet(p.page)).toHaveCount(0)));
      await expect(countdown(reader)).toContainText(/(5|4|3|2|1|SPUZL!)/);

      // Frozen: a tap on a cell during the countdown does nothing (the scrim takes it; the board is locked anyway).
      const cell = reader.getByRole("gridcell").first();
      await expect(cell).toBeAttached();
      const before = await cell.getAttribute("aria-label");
      const box = await cell.boundingBox();
      if (box && (await countdown(reader).isVisible())) await reader.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await expect(chatSheet(reader)).toHaveCount(0);
      await expect(countdown(reader)).toBeHidden({ timeout: 10_000 });
      expect(await cell.getAttribute("aria-label")).toBe(before);

      // After SPUZL! the same tap counts.
      await cell.click();
      await expect.poll(() => cell.getAttribute("aria-label")).not.toBe(before);

      // A chat message mid-race never opens a sheet or pops up over the board.
      const id = await matchIdOf(host.page, code);
      await host.page.evaluate(
        (m) =>
          fetch(`/api/v1/matches/${m}/chat`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ quick: 0 }),
            credentials: "same-origin",
          }),
        id,
      );
      await reader.waitForTimeout(6_000); // past the chat's 5 s safety poll
      await expect(chatSheet(reader)).toHaveCount(0);
      await expect(reader.getByText(QUICK_PHRASES[0])).toHaveCount(0);
    } finally {
      for (const p of players) await p.ctx.close();
    }
  });
}

test("results: Next game (2 of 3) is primary until the set ends, then Run it back; standings in rank order", async ({ browser }) => {
  test.setTimeout(240_000);
  const { code, players } = await partyRoom(browser, 2);
  const [host, guest] = players;
  try {
    await pickCrownfall(host.page, code);
    await everyoneReady(players);
    await host.page.getByRole("button", { name: /^Start(?! without)/ }).click();

    for (let game = 1; game <= 3; game++) {
      // Everyone skips the game once it has started: it ends at once, and the results show.
      for (const p of players) {
        await expect(countdown(p.page)).toBeHidden({ timeout: 15_000 });
        await p.page.getByRole("button", { name: "Skip this round" }).click();
        await p.page.getByRole("group", { name: "Skip this round?" }).getByRole("button", { name: "Skip" }).click();
      }
      const actions = host.page.getByTestId("party-results-actions");
      await expect(actions).toBeVisible({ timeout: 20_000 });
      const buttons = actions.getByRole("button");
      const first = buttons.first();
      if (game < 3) {
        await expect(first).toHaveText(`Next game (${game + 1} of 3)`);
        await expect(first).toHaveAttribute("data-tone", "primary");
        await expect(actions.getByRole("button", { name: "Run it back" })).toHaveAttribute("data-tone", "secondary");
        await expect(guest.page.getByRole("status").filter({ hasText: `start game ${game + 1} of 3` })).toBeVisible();
      } else {
        await expect(first).toHaveText("Run it back");
        await expect(first).toHaveAttribute("data-tone", "primary");
        await expect(actions.getByRole("button", { name: "Leave" })).toHaveAttribute("data-tone", "secondary");
        await expect(actions.getByRole("button", { name: /Next game/ })).toHaveCount(0);
      }
      // Rank order, with "You" marked, on both screens.
      for (const p of players) {
        const standings = p.page.getByRole("list", { name: "Standings" }).getByRole("listitem");
        await expect(standings.first()).toHaveAttribute("aria-label", /^1\. /);
        await expect(standings.nth(1)).toHaveAttribute("aria-label", /^2\. /);
        await expect(p.page.getByRole("list", { name: "Standings" }).getByText("You", { exact: true })).toBeVisible();
      }
      if (game < 3) await first.click();
    }
  } finally {
    for (const p of players) await p.ctx.close();
  }
});
