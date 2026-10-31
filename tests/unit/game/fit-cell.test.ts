import { describe, expect, it } from "vitest";
import { fitCell } from "@/components/game/useBoardSize";

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
