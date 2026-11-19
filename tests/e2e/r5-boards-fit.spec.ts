import { expect, test, type Page } from "@playwright/test";
import { GAMES } from "@/lib/catalog";
import { seededBoardUrl, waitForBoard } from "./harness";

/**
 * Every live game's board fits the screen at every common size (owner, 19 Nov 2026: "some parts of the games are
 * cut out"): the page never scrolls sideways, nothing on the board pokes past its column, and no box around the
 * board clips it (a 6 x 5 Flowline lost its last column at 1646 x 909). Phones upright and sideways, small and
 * large laptops, a 1080p monitor.
 */
const SIZES = [
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 844, h: 390 },
  { w: 1024, h: 768 },
  { w: 1280, h: 800 },
  { w: 1440, h: 900 },
  { w: 1646, h: 909 },
  { w: 1920, h: 1080 },
];

/** What on the page is cut off or pokes out: a list of short descriptions (empty when the board fits). */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = window.innerWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${vw}`);
    const slot = document.querySelector("[data-shell-slot]");
    if (!slot) return out;
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""}.${(el.getAttribute("class") ?? "").slice(0, 50)}`;
    for (const el of slot.querySelectorAll<HTMLElement>("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      // A box that hides or scrolls its own overflow while its content is wider: part of the board is out of sight.
      // Text that is meant to shorten itself (truncate, line clamps) is not a board.
      const shortens = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none";
      // Text for screen readers only (sr-only: a 1 px box) is meant to be out of sight.
      if (el.clientWidth <= 1) continue;
      // A game's window onto a bigger map (Lost's fog) hides the rest of the map on purpose.
      if (el.hasAttribute("data-board-window")) continue;
      if (!shortens && /hidden|auto|scroll|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2)
        out.push(`${name(el)} hides ${el.scrollWidth - el.clientWidth}px of its content`);
    }
    // The board itself (a grid, a canvas) stays on screen.
    for (const el of slot.querySelectorAll<HTMLElement>('[role="grid"], canvas')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      if (r.left < -1 || r.right > vw + 1) out.push(`${name(el)} off screen: ${Math.round(r.left)} to ${Math.round(r.right)} of ${vw}`);
    }
    return out;
  });
}

for (const { id } of GAMES) {
  test(`${id} fits at every screen size`, async ({ page }) => {
    test.setTimeout(240_000);
    const problems: string[] = [];
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.goto(seededBoardUrl(id, "qa", "easy"));
      await waitForBoard(page, 90_000);
      // Let the height fit and any late measuring settle.
      await page.waitForTimeout(700);
      for (const p of await clipped(page)) problems.push(`${size.w} x ${size.h}: ${p}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
}
