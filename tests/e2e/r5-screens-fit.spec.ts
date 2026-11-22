import { expect, test, type Page } from "@playwright/test";
import { onboardGuest } from "./harness";

/**
 * Every main screen fits at every common size (owner, 22 Nov 2026: check the screens, not only the game boards):
 * the page never scrolls sideways, nothing pokes past the screen's edge, and no box clips what it holds. Phones
 * upright and sideways (the installed app can turn since 1.72), tablets both ways, small and large laptops and a
 * 1080p monitor. Game boards have their own check (r5-boards-fit.spec.ts).
 */
const SIZES = [
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 844, h: 390 },
  { w: 820, h: 1180 },
  { w: 1180, h: 820 },
  { w: 1366, h: 768 },
  { w: 1536, h: 864 },
  { w: 1920, h: 1080 },
];

const SCREENS = ["/", "/library", "/duel", "/party", "/bay", "/leagues", "/friends", "/shop", "/me", "/settings", "/quests"];
const PUBLIC = ["/about", "/how-to-play", "/privacy"];

/** What is cut off or pokes out (empty when the screen fits). */
async function clipped(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = window.innerWidth;
    const doc = document.documentElement;
    if (doc.scrollWidth > vw + 1) out.push(`page scrolls sideways: ${doc.scrollWidth} > ${vw}`);
    const name = (el: Element) =>
      `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? `[${el.getAttribute("aria-label")!.slice(0, 30)}]` : ""}.${(el.getAttribute("class") ?? "").slice(0, 50)}`;
    /**
     * Inside a box that scrolls sideways on purpose (a rail of chips, a carousel): the rest is a swipe away. A box
     * that hides or clips instead is no excuse: what pokes past it is cut off.
     */
    const inScroller = (el: Element) => {
      for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
        const o = getComputedStyle(n).overflowX;
        if (o === "auto" || o === "scroll") return true;
      }
      return false;
    };
    for (const el of document.body.querySelectorAll<HTMLElement>("*")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.clientWidth <= 1) continue;
      if (el.closest("[aria-hidden='true'], [data-board-window]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Off the screen's side, and not inside something that scrolls or clips sideways by design.
      if ((r.right > vw + 1 || r.left < -1) && !inScroller(el) && cs.position !== "fixed")
        out.push(`${name(el)} pokes out: ${Math.round(r.left)} to ${Math.round(r.right)} of ${vw}`);
      // A box that hides overflow while its content is wider (a scrolling rail is meant to scroll, so only
      // hidden or clip count; text that shortens itself with an ellipsis or a line clamp is fine).
      const shortens = cs.textOverflow === "ellipsis" || cs.webkitLineClamp !== "none";
      if (!shortens && /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && el.children.length > 0)
        out.push(`${name(el)} hides ${el.scrollWidth - el.clientWidth}px of its content`);
    }
    return [...new Set(out)].slice(0, 8);
  });
}

test("every main screen fits at every size", async ({ page }) => {
  test.setTimeout(900_000);
  await onboardGuest(page);
  const problems: string[] = [];
  for (const path of [...SCREENS, ...PUBLIC]) {
    for (const size of SIZES) {
      await page.setViewportSize({ width: size.w, height: size.h });
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(400);
      for (const p of await clipped(page)) problems.push(`${path} at ${size.w} x ${size.h}: ${p}`);
    }
  }
  expect(problems, problems.join("\n")).toEqual([]);
});
