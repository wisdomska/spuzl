import { expect, test, type Page } from "@playwright/test";
import { GAME_BY_ID } from "@/lib/catalog";
import { admin } from "../../api/helpers";
import { signedIn } from "./helpers";

/**
 * R2-ADMIN, admin Library page: each game's icon as a preview, its one-line rule and card copy overrides (validated,
 * audited, read by the game shell and the world page), and the practice board preview.
 * Needs local Supabase with 20261202000101 applied and a dev server:
 * PW_BASE_URL=http://localhost:3203 pnpm playwright test tests/e2e/admin/r2-admin-library.spec.ts --project=desktop-dark
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 800, "the admin console is desktop and tablet only");

const row = (page: Page, id: string) => page.locator(`[data-meta-row="${id}"]`);
const RULE = "Sun and moon in every row and column, never three alike in a line.";

test.afterAll(async () => {
  await admin().from("games").update({ rule: null, blurb: null }).eq("id", "dusk");
});

test("content editor overrides Dusk's rule and card copy; the game shell and world page show it; it is audited", async ({ page }) => {
  const acct = await signedIn(page, "content_editor");
  await page.goto("/admin/library");
  await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
  // Icons: every row previews the game's tile.
  await expect(row(page, "dusk").getByRole("img", { name: "Dusk icon" })).toBeVisible();

  await row(page, "dusk").getByText("Rule and card copy").click();
  const rule = row(page, "dusk").getByLabel("One-line rule", { exact: true });
  await expect(rule).toHaveValue(GAME_BY_ID.dusk.rule);
  // Validation as you type: over 130 characters cannot be saved.
  await rule.fill("x".repeat(131));
  await expect(row(page, "dusk").getByText("The rule must be at most 130 characters (now 131)")).toBeVisible();
  await expect(rule).toHaveAttribute("aria-invalid", "true");
  await rule.fill(RULE);
  await expect(row(page, "dusk").getByText(`${RULE.length} of 130`)).toBeVisible();
  await rule.press("Enter");
  await expect(row(page, "dusk").getByText("Changed")).toBeVisible();
  await row(page, "dusk").getByLabel("Card copy", { exact: true }).fill("Light and dark, side by side.");
  await row(page, "dusk").getByLabel("Card copy", { exact: true }).press("Enter");
  await page.screenshot({ path: "docs/qa/screens/r2/r2-admin-library-copy-1280.png" });

  const { data: log } = await admin()
    .from("audit_log")
    .select("detail")
    .eq("actor_id", acct.userId)
    .eq("action", "game_meta.update")
    .eq("target", "game:dusk")
    .order("id", { ascending: false })
    .limit(2);
  expect(JSON.stringify(log)).toContain(RULE);

  // Players: the public metadata carries both, and the rule line on the board shows it (seeded board, no account).
  const pub = await (await page.request.get("/api/v1/games/meta")).json();
  expect(pub.dusk).toMatchObject({ rule: RULE, blurb: "Light and dark, side by side." });
  await page.goto("/dev/board/dusk?seed=r2-admin&d=easy");
  await expect(page.locator("[data-shell-rule]")).toHaveText(RULE, { timeout: 15_000 });

  // Use default puts the catalog's copy back.
  await page.goto("/admin/library");
  await row(page, "dusk").getByText("Rule and card copy").click();
  await row(page, "dusk").getByRole("button", { name: "Use default" }).first().click();
  await expect(row(page, "dusk").getByLabel("One-line rule", { exact: true })).toHaveValue(GAME_BY_ID.dusk.rule);
});

test("practice board preview: the real board, read only, with Show solution and the Settings switch state", async ({ page }) => {
  await signedIn(page, "content_editor");
  await page.goto("/admin/library");
  const preview = row(page, "crownfall").locator("[data-practice-preview]");
  await preview.getByText("Practice board").click();
  await expect(preview.getByText("Practice round on")).toBeVisible({ timeout: 15_000 });
  await expect(preview.getByText(GAME_BY_ID.crownfall.name)).toBeVisible();
  // Read only: no Play test (no stored puzzle to verify against), but the solution can be shown.
  await expect(preview.getByRole("button", { name: "Play test" })).toHaveCount(0);
  await preview.getByRole("button", { name: "Show solution" }).click();
  await expect(preview.getByRole("button", { name: "Hide solution" })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: "docs/qa/screens/r2/r2-admin-practice-preview-1280.png" });
});

test("roles: a moderator cannot open the Library page (content.read)", async ({ page }) => {
  await signedIn(page, "moderator");
  await page.goto("/admin/library");
  await expect(page.getByText("Your role cannot open Library metadata.")).toBeVisible();
});
