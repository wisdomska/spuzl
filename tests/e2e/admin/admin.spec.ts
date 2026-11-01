import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { admin, guest, uniq } from "../../api/helpers";
import { login, signedIn, totp } from "./helpers";

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
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Set up your authenticator" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Authenticator QR code" })).toBeVisible();
  // Password alone (AAL1) never opens the console.
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
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
  await expect(page.getByRole("heading", { name: "Authenticator code" })).toBeVisible();
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
  // No factor yet: enrolment is offered, but the role check refuses after it.
  const secret = (await page.getByTestId("totp-secret").textContent())!.trim();
  await page.getByLabel("Code").fill(totp(secret));
  await page.getByRole("button", { name: "Turn on and continue" }).click();
  await expect(page.getByText("This account has no admin role.")).toBeVisible();
  await page.goto("/admin/calendar");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("calendar to preview: real board, solve-check, play test and approve", async ({ page }) => {
  await signedIn(page, "content_editor");
  await expect(page.getByRole("heading", { name: "Content calendar" })).toBeVisible();
  await expect(page.getByText("Scheduled, solver verified")).toBeVisible();
  await page.getByRole("button", { name: "Next week" }).click();
  await page
    .getByLabel(/^Sixer .*: /)
    .first()
    .click();
  await expect(page.getByRole("heading", { name: /Sixer · / })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("grid")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Unique solution")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Verify accepts stored solution")).toBeVisible();
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
  await page.getByLabel("What is broken?").fill("e2e: duplicate givens");
  await page.getByRole("button", { name: "Confirm swap" }).click();
  await expect(page.getByText("Swapped. The new puzzle is live.")).toBeVisible({ timeout: 45_000 });
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
  await page.getByRole("link", { name: "Moderation" }).click();
  await page.getByRole("tab", { name: "Anti-cheat" }).click();
  await page
    .getByRole("button", { name: /Dusk 0:01/ })
    .first()
    .click();
  await expect(page.getByText("below human floor").first()).toBeVisible();
  await page.getByRole("button", { name: "Clear to boards" }).click();
  await expect(page.getByText(/cleared to the boards/)).toBeVisible();
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
  const payload = editor.getByLabel("Payload (JSON)");
  await payload.fill('{ "id": "x" }');
  await expect(editor.locator("#payload-issues li").first()).toBeVisible();
  const id = uniq("e2e-");
  await payload.fill(
    JSON.stringify({
      id,
      category: "Things in an e2e test",
      accept: ["test"],
      warm: [],
      clues: ["One", "Two", "Three", "Four", "Five"],
      tier: 1,
    }),
  );
  await expect(editor.getByText("Matches the Hunch format.")).toBeVisible();
  await editor.getByRole("button", { name: "Save draft" }).click();
  await editor.getByRole("button", { name: "Submit for review" }).click();
  await expect(editor.getByText("Waiting for a second person to review.")).toBeVisible();
  await expect(editor.getByRole("button", { name: "Approve" })).toHaveCount(0);

  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await signedIn(owner, "owner");
  await owner.goto("/admin/content");
  await owner.getByRole("button", { name: "Things in an e2e test" }).first().click();
  await owner.getByRole("button", { name: "Approve" }).click();
  await expect(owner.getByLabel("Schedule on")).toBeVisible();
  await editorCtx.close();
  await ownerCtx.close();
});

test("roles: the UI hides what a role cannot do and the server refuses the page", async ({ page }) => {
  await signedIn(page, "analyst");
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: "Live ops" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Audit log" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Moderation" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);
  await page.goto("/admin/moderation");
  await expect(page.getByText("Your role cannot open moderation.")).toBeVisible();
  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await page.getByLabel("Action starts with").fill("admin.");
  await expect(page.getByRole("cell", { name: /^admin\./ }).first()).toBeVisible();
});

test("tablet: calendar and live ops stay usable at 834 px, light theme", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  const acct = await import("./helpers").then((h) => h.adminSession("owner"));
  await login(page, acct, "light");
  await expect(page.getByRole("link", { name: "Calendar" })).toBeVisible();
  await page.goto("/admin/calendar");
  await expect(page.getByRole("heading", { name: "Content calendar" })).toBeVisible();
  await page.goto("/admin/liveops");
  await expect(page.getByText("D7 retention")).toBeVisible();
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(0);
});
