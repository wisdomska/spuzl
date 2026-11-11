import { expect, test, type Page } from "@playwright/test";
import { admin } from "../../api/helpers";
import { onboardGuest, waitForBoard } from "../harness";
import { signedIn } from "./helpers";

/**
 * Game state (owner request, 11 Nov 2026): the owner switches a game On, In testing or Off on the admin Games page.
 * In testing: a guest no longer sees it in All games or can open it; the signed-in admin can play it. Off: nobody can.
 * Back On: everyone plays it again. Every switch is audited.
 * Needs local Supabase with 20261212010101 applied and a dev server reading settings without a cache
 * (development, or SETTINGS_CACHE_MS=0). It flips a shared game, so run it with --workers=1:
 * PW_BASE_URL=http://localhost:3203 pnpm playwright test tests/e2e/admin/r6-game-state.spec.ts --project=desktop-dark --workers=1
 * Screenshots: docs/qa/screens/r2/r6-game-state-<name>-1280.png.
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 800, "the admin console is desktop and tablet only");
test.describe.configure({ mode: "serial" });

const GAME = "sixer";
const NAME = "Sixer";

const row = (page: Page, id: string) => page.locator(`[data-meta-row="${id}"]`);
async function openRow(page: Page, id: string) {
  const r = row(page, id);
  if ((await r.getAttribute("open")) === null) await r.locator("summary").first().click();
  return r;
}
const status = async () => (await admin().from("games").select("status").eq("id", GAME).single()).data?.status;

/** Picks a state on the game's row (confirming when players would lose it) and waits for the database. */
async function setState(page: Page, label: "On" | "In testing" | "Off", stored: string) {
  await page.goto("/admin/library");
  await page.getByRole("searchbox", { name: "Find a game" }).fill(NAME);
  const r = await openRow(page, GAME);
  await r
    .getByRole("radiogroup", { name: `Who can play ${NAME}` })
    .getByRole("radio", { name: label, exact: true })
    .click();
  if (label !== "On") {
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(`Players will no longer see or play ${NAME}`);
    await dialog.getByRole("button", { name: label === "Off" ? "Switch off" : "Put in testing" }).click();
  }
  await expect.poll(status, { timeout: 15_000 }).toBe(stored);
  await expect(row(page, GAME)).toHaveAttribute("data-state", label === "On" ? "on" : label === "Off" ? "off" : "testing");
}

async function guestSees(guest: Page, visible: boolean) {
  await guest.goto("/library");
  await expect(guest.getByRole("heading", { name: "All games" })).toBeVisible();
  await guest.getByRole("searchbox").fill(NAME);
  await expect(guest.getByRole("link", { name: new RegExp(`^${NAME} `) })).toHaveCount(visible ? 1 : 0);
}

async function opens(p: Page, yes: boolean) {
  await p.goto(`/play/${GAME}?mode=free`);
  if (yes) await waitForBoard(p, 45_000);
  else await expect(p.getByRole("heading", { name: "This page could not be found." })).toBeVisible({ timeout: 30_000 });
}

test.afterAll(async () => {
  await admin().from("games").update({ status: "live", versus: true }).eq("id", GAME);
});

test("In testing hides a game from guests but the admin can play it; Off hides it from everyone; On brings it back", async ({
  page,
  browser,
}) => {
  test.setTimeout(300_000);
  await admin().from("games").update({ status: "live" }).eq("id", GAME);
  const acct = await signedIn(page, "owner");
  // The admin also needs a player session to play (a guest profile in the same browser; the admin session is its own).
  await onboardGuest(page);

  const guestCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const guest = await guestCtx.newPage();
  await onboardGuest(guest);
  try {
    await guestSees(guest, true);

    // In testing.
    await setState(page, "In testing", "testing");
    await expect(row(page, GAME).locator("[data-try-it]")).toBeVisible();
    await page.screenshot({ path: "docs/qa/screens/r2/r6-game-state-testing-1280.png" });
    await guestSees(guest, false);
    await opens(guest, false);
    await opens(page, true);

    // Off.
    await setState(page, "Off", "off");
    await guestSees(guest, false);
    await opens(guest, false);
    await opens(page, false);

    // Back On.
    await setState(page, "On", "live");
    await guestSees(guest, true);
    await opens(guest, true);

    // The state filter counts and finds it.
    await page.goto("/admin/library");
    const filter = page.getByRole("tablist", { name: "Show" });
    await filter.getByRole("tab", { name: /^On/ }).click();
    await page.getByRole("searchbox", { name: "Find a game" }).fill(NAME);
    await expect(row(page, GAME)).toBeVisible();
    await filter.getByRole("tab", { name: /^Off/ }).click();
    await expect(row(page, GAME)).toHaveCount(0);

    const { data: log } = await admin()
      .from("audit_log")
      .select("detail")
      .eq("actor_id", acct.userId)
      .eq("action", "game_state.update")
      .eq("target", `game:${GAME}`)
      .order("id", { ascending: true });
    expect((log ?? []).map((l) => (l.detail as { state?: { after?: string } }).state?.after)).toEqual(["testing", "off", "on"]);
    // The Activity log reads it as a sentence.
    await page.goto("/admin/audit");
    await expect(page.getByText(`put ${NAME} in testing (only the team can open it)`).first()).toBeVisible();
  } finally {
    await guestCtx.close();
  }
});
