import { describe, expect, it } from "vitest";
import { boardBox, fitRow, SHORT_H } from "@/components/game/useBoardSize";
import { FULL_KEYS_H, LADDER_ROWS, ladderHeight, MAX_ROW, PHONE_ROW, rungsLayout, SHORT_ROW } from "@/games/rungs/layout";

describe("fitRow (Remix tiles, Oware pits)", () => {
  it("shares the width between n tiles, within min and max", () => {
    expect(fitRow(760, 5, 12, 24, 48, 112)).toBe(112);
    expect(fitRow(600, 5, 12, 24, 48, 112)).toBe(105);
    expect(fitRow(200, 7, 6, 0, 44, 64)).toBe(44); // never under the touch minimum
    expect(fitRow(366, 6, 8, 24, 44, 56)).toBe(50); // Oware on a 390 px phone (was 48)
  });
});

describe("Rungs ladder", () => {
  it("phones keep 44 px rows and the full keyboard on tall screens", () => {
    const l = rungsLayout(boardBox(390, 900), 900);
    expect(l).toMatchObject({ row: PHONE_ROW, compactKeys: false, maxW: 400 });
  });

  it("short and mid phones get the compact keyboard; 375 x 667 also 40 px rows", () => {
    expect(rungsLayout(boardBox(390, 844), 844)).toMatchObject({ row: PHONE_ROW, compactKeys: true });
    expect(rungsLayout(boardBox(375, 667), 667)).toMatchObject({ row: SHORT_ROW, compactKeys: true });
    expect(SHORT_H).toBeLessThan(FULL_KEYS_H);
    // The drag step is one row and its gap.
    const l = rungsLayout(boardBox(375, 667), 667);
    expect(l.pitch).toBe(l.row + l.gap);
  });

  it("is the hero on a laptop: the ladder fills the height under the top bar with bigger clues", () => {
    // The owner's 1326 x 645 laptop: was 44 px rows and 13 px clues in a 560 px box.
    const box = boardBox(1326, 645);
    const l = rungsLayout(box, 645);
    expect(l.row).toBeGreaterThan(60);
    expect(l.clue).toBeGreaterThanOrEqual(16);
    expect(ladderHeight(l)).toBeLessThanOrEqual(box.h);
    expect(l.compactKeys).toBe(false);
  });

  it("caps rows on a big desktop and never overflows the height", () => {
    for (const [w, h] of [
      [1024, 768],
      [1280, 720],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      const box = boardBox(w, h);
      const l = rungsLayout(box, h);
      expect(l.row, `${w}x${h}`).toBeLessThanOrEqual(MAX_ROW);
      expect(l.row, `${w}x${h}`).toBeGreaterThanOrEqual(PHONE_ROW);
      expect(ladderHeight(l), `${w}x${h}`).toBeLessThanOrEqual(box.h);
      expect(l.maxW).toBeLessThanOrEqual(box.w);
    }
    expect(LADDER_ROWS).toBe(7);
  });
});
