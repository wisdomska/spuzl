import { expect, test } from "@playwright/test";
import { METRIC_BY_ID, type MetricId } from "@/lib/admin/metrics";
import { admin } from "../../api/helpers";
import { signedIn } from "./helpers";

/**
 * R2-ADMIN, admin Metrics page: the cards added by the admin cascade audit each show and export as CSV (audited).
 * Needs local Supabase with the 20261202 migrations applied and a dev server:
 * PW_BASE_URL=http://localhost:3203 pnpm playwright test tests/e2e/admin/r2-admin-metrics.spec.ts --project=desktop-dark
 */
test.skip(({ viewport }) => (viewport?.width ?? 0) < 800, "the admin console is desktop and tablet only");

const NEW_CARDS: MetricId[] = ["tap_warmth"];

test("analyst sees the new cards and exports each as CSV, audited", async ({ page }) => {
  const acct = await signedIn(page, "analyst");
  await page.goto("/admin/metrics");
  await expect(page.getByRole("heading", { name: "Metrics", exact: true })).toBeVisible();
  for (const id of NEW_CARDS) {
    const title = METRIC_BY_ID[id].title;
    const card = page.getByRole("region", { name: title, exact: true });
    await expect(card).toBeVisible();
    const download = page.waitForEvent("download");
    await card.getByRole("button", { name: `Export ${title} as CSV` }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(
      new RegExp(`^spuzl-${id.replace(/_/g, "-")}-\\d{4}-\\d{2}-\\d{2}-to-\\d{4}-\\d{2}-\\d{2}\\.csv$`),
    );
    const { data } = await admin()
      .from("audit_log")
      .select("target")
      .eq("actor_id", acct.userId)
      .eq("action", "metrics.export")
      .order("id", { ascending: false })
      .limit(1);
    expect(data?.[0]?.target).toBe(`metric:${id}`);
  }
  await page.screenshot({ path: "docs/qa/screens/r2/r2-admin-metrics-1280.png", fullPage: true });
});
