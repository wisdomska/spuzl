import { expect, test } from "@playwright/test";
import { admin, guest, uniq } from "../../api/helpers";
import { signedIn } from "./helpers";

/**
 * R2-ADMIN, admin player detail and Overview: ratings with the Duel and Party rounds that moved them, recent Board
 * Games with their Ludo house rules, and the count of devices with push alerts on.
 * Needs local Supabase and a dev server:
 * PW_BASE_URL=http://localhost:3203 pnpm playwright test tests/e2e/admin/r2-admin-players.spec.ts --project=desktop-dark
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 800, "the admin console is desktop and tablet only");

test("player detail shows ratings, rank moves from Duels and Parties, and a Ludo match's house rules", async ({ page }) => {
  const db = admin();
  const g = await guest(uniq("e2r_"));
  const other = await guest(uniq("e2r2_"));
  await db.from("ratings").upsert({ player_id: g.userId, track: "logic", rating: 1033, games: 2 });
  await db.from("rank_contributions").insert({ player_id: g.userId, ref: `${crypto.randomUUID()}:1:1`, track: "logic", delta: 8 });
  const { data: m } = await db
    .from("board_matches")
    .insert({
      game_id: "ludo",
      mode: "async",
      status: "finished",
      players: [g.userId, other.userId],
      seats: 2,
      turn: 0,
      state: { opts: { homeKick: true } },
      seed: "e2e-house-rules",
      winner_id: g.userId,
      result: "all four home",
      created_by: g.userId,
    })
    .select("id")
    .single();

  await signedIn(page, "analyst");
  await page.goto(`/admin/players/${g.userId}`);
  await expect(page.getByRole("heading", { name: "Ratings" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "logic" }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rank from Duels and Parties" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "+8.0" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Board games" })).toBeVisible();
  await expect(page.locator("[data-house-rules]").first()).toHaveText("Home-kick");
  await page.screenshot({ path: "docs/qa/screens/r2/r2-admin-player-detail-1280.png", fullPage: true });
  await db.from("board_matches").delete().eq("id", m!.id);
});

test("Overview counts devices with push alerts on", async ({ page }) => {
  await signedIn(page, "moderator");
  await page.goto("/admin");
  await expect(page.getByText("Players with alerts on")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Players reached in the last 30 days")).toBeVisible();
});
