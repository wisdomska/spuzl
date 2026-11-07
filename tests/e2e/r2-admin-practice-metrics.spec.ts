import { expect, test, type Page } from "@playwright/test";
import { keepFocus, onboardGuest, VIEWPORTS, waitForBoard } from "./harness";

/**
 * R2-ADMIN: practice rounds report to the admin Metrics page. A fresh guest opens Sixer (its practice round shows:
 * practice_start), skips it (practice_skip), and the real board follows; nothing else is sent for that round.
 * Needs a server with a database and 20261202000501 applied (the lead runs it).
 */
test.use({ viewport: VIEWPORTS.phone });

/** The first-party metric bodies posted from now on. */
function metrics(page: Page) {
  const sent: { name: string; game?: string }[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/v1/metrics") sent.push(r.postDataJSON());
  });
  return sent;
}

test("a practice round sends start, then skip, to the first-party metrics", async ({ page }) => {
  test.setTimeout(120_000);
  await keepFocus(page);
  await onboardGuest(page, { guided: true });
  const sent = metrics(page);
  await page.goto("/play/sixer?mode=free");
  await expect(page.getByText("First time playing Sixer?")).toBeVisible({ timeout: 30_000 });
  await expect.poll(() => sent.filter((m) => m.name === "practice_start").map((m) => m.game)).toEqual(["sixer"]);
  await page.getByRole("button", { name: "Skip the Sixer practice round" }).click();
  await waitForBoard(page);
  await expect
    .poll(() => sent.filter((m) => m.name.startsWith("practice_")).map((m) => m.name))
    .toEqual(["practice_start", "practice_skip"]);
});
