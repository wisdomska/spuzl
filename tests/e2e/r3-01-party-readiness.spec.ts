import { expect, test } from "@playwright/test";
import { partyRoom } from "./harness";

/**
 * R3-01: Party Start readiness. The host's Start stays disabled until everyone present is ready, the lobby names who
 * is still getting ready, and "Start without them" starts with only the ready players: the others watch the set and
 * are back in on Run it back (the server enforces it; see tests/api/multiplayer.test.ts).
 *
 * Needs a server with a database (the lead runs it):
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r3-01-party-readiness.spec.ts --project=phone-375
 */
test.describe.configure({ mode: "serial" });

const start = /^Start(?! without)/;

test("Start waits for everyone; the lobby names who isn't ready; Start without them goes with the ready ones", async ({ browser }) => {
  test.setTimeout(180_000);
  const { players } = await partyRoom(browser, 3);
  const [host, ready, late] = players;
  try {
    // Nobody but the host is ready: Start is disabled and the waiting line names both guests.
    const startBtn = host.page.getByRole("button", { name: start });
    await expect(startBtn).toBeDisabled({ timeout: 15_000 });
    const waiting = host.page.getByTestId("lobby-waiting");
    await expect(waiting).toContainText(ready.nickname);
    await expect(waiting).toContainText(late.nickname);
    await expect(host.page.getByRole("button", { name: /^Start without them/ })).toHaveCount(0);

    // One guest gets ready: still disabled, the line names only the late one, and the host may start without them.
    await ready.page.getByRole("button", { name: /^Ready$/ }).click();
    await expect(waiting).not.toContainText(ready.nickname, { timeout: 15_000 });
    await expect(waiting).toContainText(late.nickname);
    await expect(startBtn).toBeDisabled();
    const without = host.page.getByRole("button", { name: /^Start without them/ });
    await expect(without).toBeVisible();
    const box = await without.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await host.page.screenshot({ path: "docs/qa/screens/r2/r3-01-lobby-waiting-375.png" });

    await without.click();
    // The race starts for the ready two; the late player watches and is told why.
    await expect(late.page.getByText("Started without you.", { exact: false })).toBeVisible({ timeout: 20_000 });
    await expect(host.page.getByTestId("lobby-waiting")).toHaveCount(0);
  } finally {
    for (const p of players) await p.ctx.close();
  }
});

test("everyone ready: Start opens and no Start without them shows", async ({ browser }) => {
  test.setTimeout(120_000);
  const { players } = await partyRoom(browser, 2);
  const [host, guest] = players;
  try {
    await guest.page.getByRole("button", { name: /^Ready$/ }).click();
    await expect(host.page.getByRole("button", { name: start })).toBeEnabled({ timeout: 15_000 });
    await expect(host.page.getByRole("button", { name: /^Start without them/ })).toHaveCount(0);
    await expect(host.page.getByText(/2 of 2 ready/)).toBeVisible();
  } finally {
    for (const p of players) await p.ctx.close();
  }
});
