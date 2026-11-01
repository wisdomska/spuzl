import { test } from "@playwright/test";
import { onboardGuest, waitForBoard } from "./harness";

/** After screenshots for docs/qa/QA_REPORT.md: every main screen at the project's viewport. Run with SCREENS=1. */
test.skip(!process.env.SCREENS, "screenshots on demand");

const PAGES: [string, string, boolean?][] = [
  ["home", "/"],
  ["library", "/library"],
  ["world-logic", "/world/logic"],
  ["play-crownfall", "/play/crownfall?mode=free", true],
  ["play-nine", "/play/nine?mode=free", true],
  ["play-dusk", "/play/dusk?mode=free", true],
  ["play-quads", "/play/quads?mode=free", true],
  ["play-fourup", "/play/fourup?mode=free", true],
  ["bot-chess", "/play/chess/bot", true],
  ["duel", "/duel"],
  ["party", "/party"],
  ["friends", "/friends"],
  ["leagues", "/leagues"],
  ["shop", "/shop"],
  ["me", "/me"],
  ["quests", "/quests"],
  ["settings", "/settings"],
];

test("after screenshots", async ({ page }, info) => {
  test.setTimeout(300_000);
  await page.goto("/welcome");
  await page.screenshot({ path: `docs/qa/screens/after/${info.project.name}/welcome.png` });
  await onboardGuest(page);
  for (const [name, path, board] of PAGES) {
    await page.goto(path);
    if (board) await waitForBoard(page).catch(() => undefined);
    else await page.waitForLoadState("networkidle");
    await page.waitForTimeout(700);
    await page.screenshot({ path: `docs/qa/screens/after/${info.project.name}/${name}.png` });
  }
});
