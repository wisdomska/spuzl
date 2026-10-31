import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import { CROWN, EMPTY, explainHint, explainNext, generate, hint, MARK, verify, type CrownfallPuzzle, type ExplainKind } from "./logic";

const empty = (n: number) => new Array<number>(n * n).fill(EMPTY);

/** True when `i` is already ruled out by an existing crown (same row, column, region, or touching). */
function coveredByCrown(p: CrownfallPuzzle, s: number[], i: number) {
  const n = p.size;
  return s.some((v, c) => {
    if (v !== CROWN || c === i) return false;
    const [rc, cc, ri, ci] = [Math.floor(c / n), c % n, Math.floor(i / n), i % n];
    return rc === ri || cc === ci || p.regions[c] === p.regions[i] || (Math.abs(rc - ri) <= 1 && Math.abs(cc - ci) <= 1);
  });
}

describe("crownfall hints", () => {
  it("row confined to one region: the region's other cells are out", () => {
    // Row 5 is all orange (region 4), so orange's cells in row 4 cannot hold its crown.
    const p = { size: 5, regions: [0, 0, 1, 1, 1, 0, 2, 2, 1, 1, 0, 2, 3, 3, 1, 4, 4, 3, 3, 1, 4, 4, 4, 4, 4] };
    expect(explainNext(p, empty(5))).toEqual({
      cell: 15,
      value: MARK,
      kind: "line-in-region",
      text: "Row 5 can only hold its crown in the orange region, so the orange region's other cells are out.",
    });
  });

  it("region confined to one column: that column's other cells are out", () => {
    const p = { size: 5, regions: [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 2, 2, 3, 3, 4, 4, 2, 3, 3, 4, 4, 2, 2, 3] };
    expect(explainNext(p, empty(5))).toEqual({
      cell: 15,
      value: MARK,
      kind: "region-in-line",
      text: "The purple region fits only in column 1, so column 1's other cells are out.",
    });
  });

  it("last spot in a region: crown it", () => {
    const p = { size: 5, regions: [0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 2, 2, 3, 3, 4, 4, 2, 3, 3, 4, 4, 2, 2, 3] };
    const s = empty(5);
    s[0] = MARK;
    s[5] = MARK;
    expect(explainNext(p, s)).toMatchObject({
      cell: 10,
      value: CROWN,
      text: "The purple region has only one spot left, so its crown goes here.",
    });
  });

  it("a crown that would empty a region is ruled out", () => {
    // Purple is an L in the top-left corner; a crown at row 2, column 2 would touch all of it.
    const p = { size: 5, regions: [0, 0, 1, 1, 1, 0, 2, 2, 1, 3, 2, 2, 3, 3, 3, 4, 2, 4, 4, 3, 4, 4, 4, 3, 3] };
    const e = explainNext(p, empty(5));
    expect(e?.kind).toBe("empties-unit");
    expect(e?.value).toBe(MARK);
    expect(e?.text).toMatch(/^A crown here would leave .+ with no room, so this cell is out\.$/);
  });

  it("never wastes a hint on a cell an existing crown already rules out", () => {
    const g = generate(createRng("hint-trivial"), "medium");
    const n = g.puzzle.size;
    const s = empty(n);
    s[g.solution[0]] = CROWN; // row 1's crown, leaving its row, column, region and neighbours unmarked
    const e = explainHint(g.puzzle, g.solution, s)!;
    expect(coveredByCrown(g.puzzle, s, e.cell)).toBe(false);
  });

  it("fixes wrong crowns and wrong X marks before deducing", () => {
    const g = generate(createRng("hint-fix"), "easy");
    const n = g.puzzle.size;
    const s = empty(n);
    const crownSpot = g.solution[2] + 2 * n;
    s[crownSpot] = MARK;
    expect(explainHint(g.puzzle, g.solution, s)).toMatchObject({ cell: crownSpot, value: EMPTY, kind: "wrong-mark" });
    const wrong = g.solution[0] === 0 ? 1 : 0;
    s[wrong] = CROWN;
    expect(explainHint(g.puzzle, g.solution, s)).toMatchObject({ cell: wrong, value: EMPTY, kind: "wrong-crown" });
  });

  it("on 10 seeded boards, following hints solves the board with sound, non-trivial, one sentence steps", () => {
    const diffs: Difficulty[] = ["easy", "medium", "hard", "expert", "mega"];
    const seen = new Set<ExplainKind>();
    for (let k = 0; k < 10; k++) {
      const g = generate(createRng(`hint-board:${k}`), diffs[k % diffs.length]);
      const n = g.puzzle.size;
      const s = empty(n);
      for (let step = 0; step < n * n * 2 && !verify(g.puzzle, g.solution, s).ok; step++) {
        const e = explainHint(g.puzzle, g.solution, s);
        expect(e).not.toBeNull();
        const { cell, value, kind, text } = e!;
        seen.add(kind);
        const isCrown = g.solution[Math.floor(cell / n)] === cell % n;
        expect(value === CROWN).toBe(isCrown);
        expect(s[cell]).toBe(EMPTY);
        expect(coveredByCrown(g.puzzle, s, cell)).toBe(false);
        // one sentence, no dashes, names colours from the palette, never a region number
        expect(text).toMatch(/^[A-Z][^.]*\.$/);
        expect(text).not.toMatch(/[-–—]/);
        expect(text).not.toMatch(/region \d/);
        if (kind === "reveal") expect(text).toMatch(/^Every other spot in row \d+ leads to a dead end, so its crown goes here\.$/);
        expect(hint(g.puzzle, g.solution, s)).toEqual({ target: cell, text });
        s[cell] = value;
      }
      expect(verify(g.puzzle, g.solution, s).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, s)).toBeNull();
    }
    expect(seen.has("last-spot")).toBe(true);
    expect(seen.has("line-in-region") || seen.has("region-in-line")).toBe(true);
  }, 60_000);
});
