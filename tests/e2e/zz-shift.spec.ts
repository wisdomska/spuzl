import { expect, test } from "@playwright/test";
import { onboardGuest, waitForHydration } from "./harness";
test("library ctrl-click debug", async ({ page, context }) => {
  test.setTimeout(120_000);
  await onboardGuest(page);
  await page.addInitScript(() => {
    const w = window as unknown as { __log: string[] };
    w.__log = [];
    for (const t of ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "auxclick"]) {
      window.addEventListener(t, (e) => {
        const m = e as MouseEvent;
        const el = m.target as Element;
        w.__log.push(`${t}@cap ${el?.tagName}${el?.closest?.("a")?.getAttribute("href") ?? ""} ctrl=${m.ctrlKey} meta=${m.metaKey} btn=${m.button}`);
        setTimeout(() => w.__log.push(`${t} later prevented=${e.defaultPrevented}`), 0);
      }, true);
    }
  });
  await page.goto("/library");
  const row = page.getByRole("link", { name: /^Crownfall Puzzles/ });
  await expect(row).toBeVisible();
  await waitForHydration(row);
  const pages: string[] = [];
  context.on("page", (p) => pages.push("page"));
  await row.click({ modifiers: ["ControlOrMeta"] });
  await page.waitForTimeout(3000);
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  console.log(`RESULT pages=${pages.length} url=${page.url()} dialog=${await page.getByRole("dialog").count()}\n  ${log.join("\n  ")}`);
  expect(pages.length).toBe(1);
});
