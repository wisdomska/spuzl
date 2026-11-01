import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { onboardGuest, waitForBoard } from "./harness";

/** QA checklist: axe-core with zero serious or critical violations on the main screens. */
const SCREENS: { path: string; ready?: (p: import("@playwright/test").Page) => Promise<unknown> }[] = [
  { path: "/" },
  { path: "/library" },
  { path: "/play/crownfall?mode=free", ready: (p) => waitForBoard(p) },
  { path: "/play/nine?mode=free", ready: (p) => waitForBoard(p) },
  { path: "/play/dusk?mode=free", ready: (p) => waitForBoard(p) },
  { path: "/play/quads?mode=free", ready: (p) => waitForBoard(p) },
  { path: "/duel" },
  { path: "/party" },
  { path: "/friends" },
  { path: "/leagues" },
  { path: "/shop" },
  { path: "/me" },
  { path: "/settings" },
  { path: "/quests" },
];

test("axe: no serious or critical violations on the main screens", async ({ page }, info) => {
  test.setTimeout(240_000);
  await onboardGuest(page);
  const report: string[] = [];
  for (const s of SCREENS) {
    await page.goto(s.path);
    if (s.ready) await s.ready(page);
    else await page.waitForLoadState("networkidle");
    await page.waitForTimeout(600);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    for (const v of bad)
      report.push(
        `${s.path}: ${v.id} (${v.impact}) ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(" | ")}`,
      );
  }
  if (report.length) console.log(`[${info.project.name}]\n${report.join("\n")}`);
  expect(report).toEqual([]);
});
