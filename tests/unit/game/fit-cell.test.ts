import { describe, expect, it, vi } from "vitest";
import { fitCell, fitStep, shellContentBottom } from "@/components/game/useBoardSize";
import { columnWidth } from "@/games/fourup/Board";
import { MIN_STAGE_HEIGHT, stageHeight } from "@/phaser/layout";

// Nine: 9 cells, 6 one-px gaps, 2 two-px box lines, 2 px frame each side = 14 px overhead.
const NINE = 14;

describe("fitCell", () => {
  it("keeps Nine cells at 40 px from 375 px wide, within the screen", () => {
    for (const vw of [375, 390, 414]) {
      const cell = fitCell(vw, 9, NINE, 40, 56);
      expect(cell).toBeGreaterThanOrEqual(40);
      expect(9 * cell + NINE).toBeLessThanOrEqual(vw);
    }
  });

  it("goes below the floor only under 375 px, and still fits", () => {
    for (const vw of [320, 360]) {
      const cell = fitCell(vw, 9, NINE, 40, 56);
      expect(cell).toBeLessThan(40);
      expect(cell).toBeGreaterThanOrEqual(24);
      expect(9 * cell + NINE).toBeLessThanOrEqual(vw);
    }
    expect(fitCell(320, 9, NINE, 40, 56)).toBe(34);
  });

  it("uses the roomy fit and the cap on wide screens", () => {
    expect(fitCell(1280, 9, NINE, 40, 56)).toBe(56);
    expect(fitCell(1280, 9, NINE, 40, 48)).toBe(48);
    expect(fitCell(375, 6, 14, 44, 56)).toBe(54); // Sixer
  });
});

describe("phone fit", () => {
  it("Light Up 10 x 10 uses the board padding: 36 px cells at 375, 30 at 320, never wider than the screen", () => {
    // 1 px gaps and 3 px padding: 9 + 6 = 15 px overhead.
    expect(fitCell(375, 10, 15, 44, 56)).toBe(36);
    expect(fitCell(320, 10, 15, 44, 56)).toBe(30);
    for (const vw of [320, 360, 375, 390, 414]) expect(10 * fitCell(vw, 10, 15, 44, 56) + 15).toBeLessThanOrEqual(vw);
  });

  it("Four Up columns stay 40 px or wider at 320 and the board fits the screen", () => {
    for (const vw of [320, 360, 375, 390, 414, 1280]) {
      const col = columnWidth(vw);
      expect(col).toBeGreaterThanOrEqual(44);
      expect(7 * col + 12).toBeLessThanOrEqual(vw);
    }
    expect(columnWidth(320)).toBe(44);
    expect(columnWidth(1280)).toBe(60);
  });

  it("fitStep shrinks just enough, never under the floor, and grows back only with a target", () => {
    // Nine: 9 rows, 40 px cells, the pad 40 px past the fold: 5 px off each cell.
    expect(fitStep(40, 40, 30, 9, 40, true)).toBe(35);
    expect(fitStep(40, 40, 30, 9, 400, true)).toBe(30);
    expect(fitStep(35, 40, 30, 9, -5, true)).toBe(35); // fits, no room for a whole step
    expect(fitStep(35, 40, 30, 9, -40, true)).toBe(39);
    expect(fitStep(35, 40, 30, 9, -400, true)).toBe(40);
    expect(fitStep(35, 40, 30, 9, -400, false)).toBe(35); // whole-page mode only shrinks
    expect(fitStep(341, 341, 200, 1, 129, false)).toBe(212); // Rage at 320 x 568
    expect(fitStep(20, 20, 30, 1, 10, false)).toBe(20); // an ideal under the floor stays
  });

  it("shellContentBottom ends at the last shell zone, without the tool bar's auto margin", () => {
    const zone = (bottom: number, marginTop: string) => ({ getBoundingClientRect: () => ({ bottom }), marginTop });
    const feedback = zone(500, "0px");
    const tools = zone(667, "40px"); // a roomy screen: the tool bar is pinned 40 px below the feedback line
    const shell = { querySelectorAll: () => [feedback, tools] };
    const board = { closest: (s: string) => (s === "[data-shell]" ? shell : null) } as unknown as HTMLElement;
    vi.stubGlobal("getComputedStyle", (el: { marginTop: string }) => ({ marginTop: el.marginTop }));
    try {
      expect(shellContentBottom(board)).toBe(627);
      // Outside a shell (or a shell with no zones) there is nothing to measure.
      expect(shellContentBottom({ closest: () => null } as unknown as HTMLElement)).toBeNull();
      const empty = { closest: () => ({ querySelectorAll: () => [] }) } as unknown as HTMLElement;
      expect(shellContentBottom(empty)).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("Nine's 28 px floor fits a 320 x 568 phone's grid inside the screen width", () => {
    expect(9 * 28 + NINE).toBeLessThanOrEqual(320 - 36);
  });

  it("Rage Ridge keeps a playable canvas when it gives height back", () => {
    const ideal = stageHeight(284, { w: 320, h: 568 });
    expect(MIN_STAGE_HEIGHT).toBeLessThan(ideal);
    expect(MIN_STAGE_HEIGHT).toBeGreaterThanOrEqual(200);
  });
});
