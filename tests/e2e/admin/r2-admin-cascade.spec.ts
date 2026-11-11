import { expect, test, type Page } from "@playwright/test";
import { CONTENT } from "@/games/quads/content";
import { packToJson } from "@/lib/admin/quads-pack";
import { SETTINGS } from "@/lib/game-settings/schema";
import { admin } from "../../api/helpers";
import { signedIn } from "./helpers";

/**
 * R2-ADMIN: the round 2 admin screens that shipped without an admin E2E (docs/qa/ADMIN_CASCADE_R2.md): the round 2
 * settings on Game settings (helper text, range checks), the Daily Five scheduler (export, lock and unlock, audited),
 * the join-request log (moderators export it, audited; analysts are refused) and the moderation queue's Daily Five
 * filter. Needs local Supabase and a dev server:
 * PW_BASE_URL=http://localhost:3203 pnpm playwright test tests/e2e/admin/r2-admin-cascade.spec.ts --project=desktop-dark
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 800, "the admin console is desktop and tablet only");

const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const lastAction = async (actor: string, action: string) =>
  (
    await admin()
      .from("audit_log")
      .select("action, target")
      .eq("actor_id", actor)
      .eq("action", action)
      .order("id", { ascending: false })
      .limit(1)
  ).data?.[0];

async function settingRow(page: Page, label: string) {
  // The label is the row's h3: h3, then its title line, then the text column, then the row with the control.
  const row = page.getByRole("heading", { name: label, exact: true, level: 3 }).locator("xpath=ancestor::div[3]");
  await expect(row).toBeVisible();
  return row;
}

test("Game settings: every round 2 setting shows with its helper text, and ranges are checked", async ({ page }) => {
  await signedIn(page, "owner");
  await page.goto("/admin/settings");
  // Plain labels on the page; the setting keys only under Technical details.
  for (const key of [
    "prompts.alertsTriggers",
    "prompts.alertsCooldownDays",
    "prompts.lowDataThresholdMs",
    "party.countdownSeconds",
    "dailyFive.resetHour",
    "dailyFive.difficulty",
    "dailyFive.world.logic",
    "dailyFive.bonus.board",
    "rooms.under16FriendsOnly",
    "practice.disabled",
  ] as const) {
    await expect(page.getByRole("heading", { name: SETTINGS[key].label, exact: true, level: 3 })).toBeVisible();
    await expect(page.getByText(key, { exact: true })).toBeHidden();
  }
  const countdown = await settingRow(page, SETTINGS["party.countdownSeconds"].label);
  await countdown.getByText("Technical details").click();
  await expect(countdown.getByText("party.countdownSeconds", { exact: true })).toBeVisible();
  await expect(countdown.getByText(/The number every Duel round and Party game counts down from/)).toBeVisible();
  const input = countdown.getByRole("textbox");
  await input.fill("9");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(countdown.getByText("Must be a whole number from 2 to 5.")).toBeVisible();
  await expect(countdown.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.screenshot({ path: "docs/qa/screens/r2/r2-admin-settings-1280.png", fullPage: true });
});

test("Daily Five planner: download the plan, lock and unlock a day, each audited", async ({ page }) => {
  const acct = await signedIn(page, "content_editor");
  await page.goto("/admin/daily-five");
  await expect(page.getByRole("heading", { name: "Daily Five" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByText("Download or upload a plan").click();
  await page.getByRole("button", { name: "Download the plan" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);
  await expect.poll(async () => (await lastAction(acct.userId, "daily_five.export"))?.action).toBe("daily_five.export");

  const day = page.getByTestId(`d5-day-${tomorrow()}`);
  await expect(day).toBeVisible({ timeout: 20_000 });
  await day.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(day.getByText("Locked", { exact: true })).toBeVisible();
  await expect.poll(async () => (await lastAction(acct.userId, "daily_five.lock"))?.target).toBe(`daily_five:${tomorrow()}`);
  await day.getByRole("button", { name: "Unlock" }).click();
  await expect(day.getByText("Open", { exact: true })).toBeVisible();
  await expect.poll(async () => (await lastAction(acct.userId, "daily_five.unlock"))?.target).toBe(`daily_five:${tomorrow()}`);
});

test("join-request log: a moderator exports it as CSV (audited); an analyst cannot open it", async ({ page, browser }) => {
  const acct = await signedIn(page, "moderator");
  await page.goto("/admin/join-requests");
  await expect(page.getByRole("heading", { name: "Join requests" })).toBeVisible();
  await expect(page.getByText(/No chat is kept/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download list (CSV)" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.csv$/);
  await expect.poll(async () => (await lastAction(acct.userId, "joinlog.export"))?.target).toBe("join_requests");

  const other = await browser.newPage();
  await signedIn(other, "analyst");
  await other.goto("/admin/join-requests");
  await expect(other.getByText("Your role cannot open join requests.")).toBeVisible();
  await other.close();
});

test("moderation: the flagged scores tab filters to the Daily Five", async ({ page }) => {
  await signedIn(page, "moderator");
  await page.goto("/admin/moderation?tab=flagged");
  const source = page.getByRole("combobox", { name: "Games" });
  await expect(source).toBeVisible();
  await source.selectOption("five");
  await expect(page).toHaveURL(/source=five/);
});

test("Quads packs: a bad pack lists its problems and saves nothing; a good one becomes drafts, audited", async ({ page }) => {
  const acct = await signedIn(page, "content_editor");
  await page.goto("/admin/content?game=quads");
  const tools = page.getByRole("region", { name: "Quads packs" });
  await expect(tools).toBeVisible({ timeout: 20_000 });
  await tools.getByRole("button", { name: "Add from a Quads pack" }).click();
  await tools.getByLabel("Paste a Quads pack").fill('{"app":"spuzl","kind":"quads","puzzles":[{}]}');
  await tools.getByRole("button", { name: "Import as drafts" }).click();
  await expect(tools.getByText("Fix these and import again. Nothing was saved.")).toBeVisible();

  await tools.getByLabel("Paste a Quads pack").fill(packToJson(CONTENT.slice(0, 1)));
  await tools.getByRole("button", { name: "Import as drafts" }).click();
  await expect(tools.getByText("Imported 1 puzzle as drafts.")).toBeVisible();
  await expect.poll(async () => (await lastAction(acct.userId, "content.import"))?.target).toBe("content:quads");
  await admin().from("content_items").delete().eq("author_id", acct.userId).eq("notes", "Imported from a Quads pack");
});
