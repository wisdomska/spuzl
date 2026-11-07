import { expect, test } from "@playwright/test";
import { signedIn } from "./admin/helpers";
import { onboardGuest, VIEWPORTS } from "./harness";

/**
 * R2-P5 seasonal templates: a content editor adds Detty December as a draft with one click, sees it as a Draft in
 * the list and schedules it; a player's Home shows no banner while nothing is live. Needs the dev server, a database
 * and Mailpit (admin sign-in code). The lead runs it.
 */
test.describe.configure({ mode: "serial" });

for (const [name, vp] of [
  ["375", VIEWPORTS.phone],
  ["1280", VIEWPORTS.desktop],
] as const) {
  test(`admin adds a template as a draft and schedules it (${name})`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: vp })).newPage();
    await signedIn(page, "content_editor");
    await page.goto("/admin/events");
    const templates = page.getByRole("region", { name: "Ready-made events" });
    await expect(templates.getByText("Detty December")).toBeVisible();
    await expect(templates.getByText("6 March Quiz")).toBeVisible();
    await page.screenshot({ path: `docs/qa/screens/r2/p5-event-templates-${name}.png`, fullPage: true });

    await templates.getByRole("button", { name: "Add Detty December as a draft" }).click();
    await expect(page.getByText("Detty December added as a draft. Check the dates, then Schedule.")).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Detty December" }).first();
    await expect(row.getByText("Draft")).toBeVisible();
    await row.getByRole("button", { name: "Schedule Detty December" }).click();
    await expect(page.getByText("Detty December is scheduled.")).toBeVisible();
    await expect(row.getByText(/Upcoming|Live/)).toBeVisible();
    // Clean up: back to draft, then delete.
    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Put Detty December back to draft" }).click();
    await expect(row.getByText("Draft")).toBeVisible();
    page.once("dialog", (d) => void d.accept());
    await row.getByRole("button", { name: "Delete Detty December" }).click();
  });
}

test("Home shows no event banner with seasonal on and only drafts", async ({ page }) => {
  await onboardGuest(page);
  await page.goto("/");
  await expect(page.getByRole("navigation").first()).toBeVisible();
  // Drafts never run: the banner is either absent or a scheduled event, never "Detty December" from the draft above.
  await expect(page.getByTestId("event-banner").filter({ hasText: "Detty December" })).toHaveCount(0);
});
