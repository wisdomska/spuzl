import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { onboardGuest } from "./harness";

/**
 * R4-10: an admin rule override (games.rule, Library page) reaches the Play page's meta description, the public game
 * page, How to play and llms-full.txt. The override is written with the service role (as the admin route does) and
 * put back afterwards. Static pages pick it up on their next rebuild: on a dev server at once; on a production build
 * after the admin route's revalidatePath, or the hourly revalidation, so those checks poll and are skipped when the
 * route is still the old file (PROD_STATIC=1).
 */
const env = Object.fromEntries(
  fs.existsSync(".env.local")
    ? fs
        .readFileSync(".env.local", "utf8")
        .split("\n")
        .filter((l) => l.includes("="))
        .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
    : [],
);
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
const RULE = "Place one crown in each row, column and colour; QA override r4-10.";

test.describe("R4-10 admin copy overrides", () => {
  test.skip(!SB_URL || !SERVICE, "needs the service role to set an override");
  const db = () => createClient(SB_URL!, SERVICE!, { auth: { persistSession: false } });
  let before: string | null = null;

  test.beforeAll(async () => {
    const { data } = await db().from("games").select("rule").eq("id", "crownfall").single();
    before = (data?.rule as string | null) ?? null;
    const { error } = await db().from("games").update({ rule: RULE }).eq("id", "crownfall");
    if (error) throw error;
  });
  test.afterAll(async () => {
    await db().from("games").update({ rule: before }).eq("id", "crownfall");
  });

  test("the Play page description carries the override", async ({ page }) => {
    await onboardGuest(page);
    // The server's Library cache lasts up to 30 s per instance.
    await expect
      .poll(
        async () => {
          await page.goto("/play/crownfall?mode=free");
          return page.locator('meta[name="description"]').getAttribute("content");
        },
        { timeout: 60_000, intervals: [2_000, 5_000, 10_000] },
      )
      .toBe(RULE);
  });

  test("the static pages and llms-full.txt carry it", async ({ page, request }) => {
    test.skip(process.env.PROD_STATIC === "1", "a production build keeps the old file until revalidated");
    await expect.poll(async () => (await (await request.get("/llms-full.txt")).text()).includes(RULE), { timeout: 60_000 }).toBe(true);
    await page.goto("/how-to-play");
    await expect(page.getByText(RULE)).toBeVisible();
    await page.goto("/games/crownfall");
    await expect(page.getByText(RULE).first()).toBeVisible();
  });
});
