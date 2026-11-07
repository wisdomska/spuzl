import { expect, test } from "@playwright/test";
import { partyRoom, runAxe, VIEWPORTS } from "./harness";

/**
 * R2-P5 big-screen Party view: the host turns on Big-screen view in Room settings; a browser with no account opens
 * /party/<code>/tv and sees the room (code, nicknames, standings), read only: no chat, no inputs. Closed rooms say
 * so. Needs the dev server and a database. The lead runs it.
 */
test.describe.configure({ mode: "serial" });

test("host opens the room to the big screen; a signed-out TV watches it read only", async ({ browser }) => {
  const { code, players } = await partyRoom(browser, 2);
  const host = players[0].page;

  for (const [name, vp] of [
    ["375", VIEWPORTS.phone],
    ["1280", VIEWPORTS.desktop],
  ] as const) {
    const tv = await (await browser.newContext({ viewport: vp })).newPage();
    await tv.goto(`/party/${code}/tv`);
    // A normal room starts closed to watchers.
    await expect(tv.getByRole("heading", { name: "This room isn't on the big screen" })).toBeVisible({ timeout: 15_000 });
    await tv.screenshot({ path: `docs/qa/screens/r2/p5-party-tv-closed-${name}.png` });
    await tv.context().close();
  }

  await host.getByRole("button", { name: "Room settings" }).click();
  const sw = host.getByRole("switch", { name: "Big-screen view" });
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await expect(host.getByText(new RegExp(`/party/${code}/tv`))).toBeVisible();
  await host.screenshot({ path: "docs/qa/screens/r2/p5-party-tv-switch-375.png" });

  for (const [name, vp] of [
    ["375", VIEWPORTS.phone],
    ["1280", VIEWPORTS.desktop],
  ] as const) {
    const tv = await (await browser.newContext({ viewport: vp })).newPage();
    await tv.goto(`/party/${code}/tv`);
    const frame = tv.getByTestId("party-tv");
    // <main> holds only a fixed full-screen frame (its own box is 0 × 0), so wait on what the frame shows.
    await expect(frame.getByText(code).first()).toBeVisible({ timeout: 15_000 });
    await expect(frame.getByRole("list", { name: "Standings" })).toContainText(players[1].nickname);
    // Read only: nothing to type in, no chat.
    await expect(tv.locator("input, textarea")).toHaveCount(0);
    await expect(tv.getByRole("button", { name: /chat/i })).toHaveCount(0);
    expect(await runAxe(tv)).toEqual([]);
    await tv.screenshot({ path: `docs/qa/screens/r2/p5-party-tv-${name}.png` });
    await tv.context().close();
  }
});
