import { expect, test } from "@playwright/test";
import { guestContext, keepFocus } from "./harness";

/**
 * R3-08: score races in Party. The host's game picker lists the score games (Quickfire, Emoji Hits...) marked
 * "Points" while the admin setting "party.scoreRaces" is on (default on); a room opened with one starts like any
 * race, and the countdown and the race rail say most points wins. The server judging and placing is covered by
 * tests/api/r3-08-score-races.test.ts.
 *
 * Needs a server with a database (the lead runs it):
 *   PW_BASE_URL=http://localhost:3400 pnpm exec playwright test tests/e2e/r3-08-party-score-race.spec.ts --project=phone-375
 */
test.describe.configure({ mode: "serial" });

test("the host picks Quickfire as a score race; the round says most points wins", async ({ browser }) => {
  test.setTimeout(180_000);
  const host = await guestContext(browser);
  const guest = await guestContext(browser);
  try {
    await keepFocus(host.page);
    await host.page.goto("/party");
    await host.page
      .getByRole("group", { name: "Filter games by world" })
      .getByRole("button", { name: /^Words & Quiz/ })
      .click();
    const quickfire = host.page.getByRole("radio", { name: "Quickfire, most points wins" });
    await expect(quickfire).toBeVisible();
    await expect(host.page.getByRole("radio", { name: "Emoji Hits, most points wins" })).toBeVisible();
    await quickfire.click();
    await expect(quickfire).toHaveAttribute("aria-checked", "true");
    await host.page.screenshot({ path: "docs/qa/screens/r2/r3-08-picker-375.png" });
    await host.page.getByRole("button", { name: /^Open room/ }).click();
    await host.page.waitForURL(/\/party\/[A-Z0-9]{4}/, { timeout: 30_000 });
    const code = new URL(host.page.url()).pathname.split("/").pop()!;
    await expect(host.page.getByText(/Quickfire, 3 games/)).toBeVisible();

    await guest.page.goto(`/party/${code}`);
    await guest.page.getByRole("button", { name: /^Join$/ }).click();
    await guest.page.getByRole("button", { name: /^Ready$/ }).click();
    await host.page.getByRole("button", { name: /^Start(?! without)/ }).click();
    await expect(guest.page.getByText(/Most points wins!/)).toBeVisible({ timeout: 15_000 });
    await expect(guest.page.getByText("Most points wins", { exact: true })).toBeVisible({ timeout: 20_000 });
    await guest.page.screenshot({ path: "docs/qa/screens/r2/r3-08-race-375.png" });
  } finally {
    await host.ctx.close();
    await guest.ctx.close();
  }
});
