import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, guest, uniq } from "../../api/helpers";
import { login, loginCode, signedIn } from "./helpers";
import { pickOption } from "../pick";

/**
 * Admin console flows (FR-AD-01 to FR-AD-08). Desktop first, so the phone projects skip.
 * Needs local Supabase and a dev server: PW_BASE_URL=http://localhost:3203 pnpm playwright test tests/e2e/admin --project=desktop-dark
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 800, "the admin console is desktop and tablet only");

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test("first sign-in enrols TOTP, then every visit needs the code; admin pages are noindex", async ({ page }) => {
  const db = admin();
  const email = `${uniq("first")}@admin.test`;
  const password = randomBytes(18).toString("base64url");
  const { data } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  await db.from("admins").insert({ user_id: data.user!.id, role: "owner", email });

  await page.goto("/admin/calendar");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Email or password is wrong.")).toBeVisible();
  await page.getByLabel("Password").fill(password);
  const since = Date.now();
  await page.getByRole("button", { name: "Continue" }).click();

  // Password alone never opens the console: a 6-digit code is emailed (no authenticator app).
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto("/admin/calendar");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.getByText("That code didn't work.")).toBeVisible();
  await page.getByLabel("Code").fill(await loginCode(email, since));
  await page.getByRole("button", { name: "Verify" }).click();
  // Owners land on the Overview.
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const { data: row } = await db.from("admins").select("totp_enrolled").eq("user_id", data.user!.id).single();
  expect(row!.totp_enrolled).toBe(true);

  // Sign out, sign back in: straight to the code step.
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.goto("/admin/liveops");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("players and non-admin accounts never reach the console", async ({ page }) => {
  const db = admin();
  const email = `${uniq("nobody")}@admin.test`;
  const password = randomBytes(18).toString("base64url");
  await db.auth.admin.createUser({ email, password, email_confirm: true });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
  // The role check refuses right after the password; no code is sent to non-admins.
  await expect(page.getByText("This account has no admin role.")).toBeVisible();
  await page.goto("/admin/calendar");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("calendar to preview: real board, solve-check, play test and approve", async ({ page }) => {
  await signedIn(page, "content_editor");
  await expect(page.getByRole("heading", { name: "Daily calendar" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Next week" }).click();
  await page
    .getByLabel(/^Sixer .*: /)
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /Sixer · / })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("grid")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Only one correct answer")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Our answer checker accepts the answer")).toBeVisible();
  await page.getByRole("button", { name: "Show solution" }).click();
  await page.getByRole("button", { name: "Play test" }).click();
  await expect(page.getByRole("button", { name: "Restart test" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Publish" }).getByText("Daily number")).toBeVisible();
  const approve = page.getByRole("button", { name: /^Approve/ });
  if (await approve.isEnabled()) await approve.click();
  await expect(page.getByRole("button", { name: "Approved" })).toBeVisible({ timeout: 30_000 });
});

test("emergency Swap Daily keeps the old puzzle as swapped_from", async ({ page }) => {
  const date = day(3);
  const before = (await admin().from("dailies").select("puzzle_id").eq("game_id", "sixer").eq("date", date).single()).data!;
  await signedIn(page, "owner");
  await page.goto(`/admin/calendar/sixer/${date}`);
  await page.getByRole("button", { name: "Swap Daily" }).click();
  await page.getByLabel(/What is broken\?/).fill("e2e: duplicate givens");
  await page.getByRole("button", { name: "Swap it now" }).click();
  await expect(page.getByText("Swapped. Players now get the new puzzle.")).toBeVisible({ timeout: 45_000 });
  const after = (await admin().from("dailies").select("puzzle_id, swapped_from").eq("game_id", "sixer").eq("date", date).single()).data!;
  expect(after.swapped_from).toBe(before.puzzle_id);
  expect(after.puzzle_id).not.toBe(before.puzzle_id);
});

test("moderation: clear a flagged score and rename a reported nickname", async ({ page }) => {
  const target = await guest(uniq("e2e_"));
  const reporter = await guest(uniq("e2r_"));
  const db = admin();
  const { data: a } = await db
    .from("attempts")
    .insert({
      player_id: target.userId,
      game_id: "dusk",
      mode: "free",
      status: "flagged",
      time_ms: 1200,
      flag_reason: "below human floor",
      finished_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  await db.from("reports").insert({ reporter_id: reporter.userId, target_type: "nickname", target_id: target.userId, reason: "nickname" });

  await signedIn(page, "moderator");
  await page.getByRole("link", { name: "Reports" }).click();
  await page.getByRole("tab", { name: "Suspicious scores" }).click();
  await page
    .getByRole("button", { name: /Dusk 0:01/ })
    .first()
    .click();
  await expect(page.getByText("below human floor").first()).toBeVisible();
  await page.getByRole("button", { name: "Let it count" }).click();
  await expect(page.getByText(/score allowed/)).toBeVisible();
  expect((await db.from("attempts").select("status").eq("id", a!.id).single()).data!.status).toBe("cleared");

  await page.getByRole("tab", { name: "Nicknames" }).click();
  const row = page.getByRole("button", {
    name: new RegExp(`Nickname "${(await db.from("players").select("nickname").eq("id", target.userId).single()).data!.nickname}"`),
  });
  await row.click();
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByText(/renamed to Puzzler\d{4}/)).toBeVisible();
});

test("content editor: draft with schema validation, second person approves", async ({ browser }) => {
  const editorCtx = await browser.newContext();
  const editor = await editorCtx.newPage();
  await signedIn(editor, "content_editor");
  await editor.goto("/admin/content");
  await editor.getByRole("button", { name: "New item" }).click();
  const payload = editor.getByLabel("Contents (JSON format)");
  await payload.fill('{ "id": "x" }');
  await expect(editor.locator("#payload-issues li").first()).toBeVisible();
  const id = uniq("e2e-");
  // The editor opens on Quickfire (a live game; Hunch, the old default, is retired).
  await payload.fill(
    JSON.stringify({
      cat: "world",
      level: 1,
      q: `Things in an e2e test ${id}`,
      answer: "Yes",
      wrong: ["No", "Maybe", "Later"],
      source: "QA",
    }),
  );
  await expect(editor.getByText("Looks right for Quickfire.")).toBeVisible();
  await editor.getByRole("button", { name: "Save draft" }).click();
  await editor.getByRole("button", { name: "Send for review" }).click();
  await expect(editor.getByText("Waiting for a second person to review.")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Approve" })).toHaveCount(0);

  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await signedIn(owner, "owner");
  await owner.goto("/admin/content");
  await owner
    .getByRole("button", { name: new RegExp(`Things in an e2e test ${id}`) })
    .first()
    .click();
  await owner.getByRole("button", { name: "Approve" }).click();
  await expect(owner.getByLabel("Players get it on")).toBeVisible();
  await editorCtx.close();
  await ownerCtx.close();
});

test("roles: the UI hides what a role cannot do and the server refuses the page", async ({ page }) => {
  await signedIn(page, "analyst");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Live now" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Activity log" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Reports" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);
  await page.goto("/admin/moderation");
  await expect(page.getByText("Your role can't open reports.")).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Activity log", level: 1 })).toBeVisible();
  // Plain filters: the team's sign-in rows read as sentences, with the raw action under Technical details.
  await pickOption(page, "Type of change", "Team and sign-in");
  await expect(page).toHaveURL(/type=team/);
  await expect(page.getByText(/set up their sign-in codes|to the team/).first()).toBeVisible();
  await page.getByText("Technical details").first().click();
  await expect(page.getByText(/^admin\./).first()).toBeVisible();
});

test("tablet: calendar and live ops stay usable at 834 px, light theme", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  const acct = await import("./helpers").then((h) => h.adminSession("owner"));
  await login(page, acct, "light");
  // Below 1024 px the grouped menu sits behind the Menu button.
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Daily calendar" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto("/admin/calendar");
  await expect(page.getByRole("heading", { name: "Daily calendar" })).toBeVisible();
  await page.goto("/admin/liveops");
  await expect(page.getByText("Came back a week later")).toBeVisible();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});
