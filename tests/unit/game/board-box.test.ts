import { describe, expect, it } from "vitest";
import {
  boardBox,
  cellSize,
  fitCell,
  isWide,
  wideCell,
  SLOT_PAD,
  WIDE_ASIDE,
  WIDE_ASIDE_NARROW,
  WIDE_HEIGHT,
  wideAside,
  WIDE_GAP,
  WIDE_GUTTER,
  WIDE_MAX,
  WIDE_SHELL_MAX,
  WIDE_TOP,
  WIDE_BOTTOM,
} from "@/components/game/useBoardSize";
import { columnWidth } from "@/games/fourup/Board";

const DESKTOP = [
  [1280, 800],
  [1440, 900],
  [1024, 768],
] as const;
const SINGLE = [
  [768, 1024],
  [375, 667],
  [390, 844],
  [320, 568],
  [932, 430], // a big phone on its side: wide but short, keeps the single column
] as const;

describe("the two-column shell on wide screens", () => {
  it("starts at 900 x 600 (laptops, desktops, landscape tablets), never on phones or portrait tablets", () => {
    for (const [w, h] of DESKTOP) expect(isWide(w, h), `${w}x${h}`).toBe(true);
    for (const [w, h] of SINGLE) expect(isWide(w, h), `${w}x${h}`).toBe(false);
  });

  it("keeps the CSS copies of the shell width in step (multiplayer Screen, Board Bay, loading frames)", () => {
    // max-w-[1384px] min-[1280px]:max-w-[1424px] and w-[320px] min-[1280px]:w-[360px] in the class names.
    expect(WIDE_SHELL_MAX).toBe(1424);
    expect(WIDE_GUTTER * 2 + WIDE_MAX + SLOT_PAD * 2 + WIDE_GAP + WIDE_ASIDE_NARROW).toBe(1384);
    expect(WIDE_ASIDE_NARROW).toBe(320);
  });

  it("narrows the side panel to 320 px under 1280 px wide, 360 px from there", () => {
    expect(wideAside(1024)).toBe(WIDE_ASIDE_NARROW);
    expect(wideAside(1279)).toBe(WIDE_ASIDE_NARROW);
    expect(wideAside(1280)).toBe(WIDE_ASIDE);
    expect(wideAside(1920)).toBe(WIDE_ASIDE);
  });

  it("makes the board the hero: the whole height under the top bar, the column beside a compact panel", () => {
    expect(WIDE_SHELL_MAX).toBe(WIDE_GUTTER * 2 + WIDE_MAX + SLOT_PAD * 2 + WIDE_GAP + WIDE_ASIDE);
    expect(boardBox(1280, 800)).toEqual({ wide: true, w: 816, h: 800 - WIDE_TOP - SLOT_PAD - WIDE_BOTTOM, side: 692 });
    expect(boardBox(1440, 900)).toEqual({ wide: true, w: 960, h: 792, side: 792 }); // was 720
    expect(boardBox(1024, 768)).toEqual({ wide: true, w: 600, h: 660, side: 600 }); // was 560
    // The owner's laptop (1326 x 645) and a 1366 x 768 laptop: height-bound, the whole height.
    expect(boardBox(1326, 645).side).toBe(645 - WIDE_TOP - SLOT_PAD - WIDE_BOTTOM);
    expect(boardBox(1366, 768).side).toBe(660);
    // A 1920 x 1080 desktop reaches the largest board (about 89 % of the height), never small in the middle.
    expect(boardBox(1920, 1080)).toMatchObject({ w: WIDE_MAX, side: WIDE_MAX });
    for (const [w, h] of [...DESKTOP, [1326, 645], [1366, 768], [1920, 1080]] as const) {
      const b = boardBox(w, h);
      // The board column, the gap, the side panel and the gutters fit across: no sideways scroll.
      expect(WIDE_GUTTER * 2 + b.w + SLOT_PAD * 2 + WIDE_GAP + wideAside(w), `${w}x${h}`).toBeLessThanOrEqual(w);
      // A square board stays inside 90 % of the height and under the top bar.
      expect(b.side).toBeLessThanOrEqual(Math.floor(h * WIDE_HEIGHT));
      expect(WIDE_TOP + SLOT_PAD + b.side + WIDE_BOTTOM).toBeLessThanOrEqual(h);
      // At least 80 % of the height (the old cap) whenever the column allows it.
      expect(b.side, `${w}x${h}`).toBeGreaterThanOrEqual(Math.min(b.w, b.h, Math.floor(h * 0.8)));
    }
  });

  it("keeps phones as they were", () => {
    expect(boardBox(375, 667)).toMatchObject({ wide: false, w: 351 });
    expect(boardBox(390, 844)).toMatchObject({ wide: false, w: 366 });
    expect(boardBox(768, 1024)).toMatchObject({ wide: false, w: 536 });
  });
});

describe("boards grow on wide screens", () => {
  // Chess (puzzle, vs bot and Board Bay): 8 x 8, no gaps; was capped at 48 px (384 px board).
  it("Chess: 85 px squares at 1280 x 800 (680 px board, was 624), 96 at 1440 x 900, 73 at 1024 x 768", () => {
    expect(cellSize(1280, 800, 8, 0, 10, 48)).toBe(85);
    expect(cellSize(1440, 900, 8, 0, 10, 48)).toBe(96);
    expect(cellSize(1024, 768, 8, 0, 10, 48)).toBe(73);
    expect(cellSize(1280, 800, 8, 0, 0, 48)).toBe(86);
  });

  it("never under 44 px targets on the desktop viewports for every square board up to 9 x 9", () => {
    for (const [w, h] of DESKTOP)
      for (let n = 4; n <= 9; n++) expect(cellSize(w, h, n, 2, 12, 48), `${n} at ${w}x${h}`).toBeGreaterThanOrEqual(44);
  });

  it("keeps a tall board inside the height", () => {
    // Twins 4 x 6 (rows x cols swapped would overflow): rows bound the cell.
    const c = cellSize(1280, 800, 4, 8, 12, 76, 6);
    expect(6 * c + 5 * 8 + 12).toBeLessThanOrEqual(boardBox(1280, 800).h);
  });

  it("caps cells at twice the phone cap", () => {
    expect(wideCell(1440, 900, 3, 0, 60)).toBe(120);
  });

  it("Nine (fitCell with the height): grows past the phone's 56 px cap on a laptop", () => {
    expect(fitCell(1280, 9, 14, 40, 56, 560, 800)).toBe(75);
    // Without the height (old callers) the phone rule stands.
    expect(fitCell(1280, 9, 14, 40, 56)).toBe(56);
  });

  it("Four Up: columns grow to fill the column and the height", () => {
    expect(columnWidth(1280)).toBe(60);
    expect(columnWidth(1280, 800)).toBe(113);
    expect(6 * columnWidth(1280, 800) + 12).toBeLessThanOrEqual(boardBox(1280, 800).h);
    expect(7 * columnWidth(1024, 768) + 12).toBeLessThanOrEqual(boardBox(1024, 768).w);
  });
});
