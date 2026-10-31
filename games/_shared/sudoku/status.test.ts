import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import { analyze, generateSudoku } from "./logic";
import { statusLine } from "./status";

describe("sudoku status line", () => {
  const g = generateSudoku(createRng("status"), "easy", 6);
  const givens = g.puzzle.givens.filter(Boolean).length;

  it("counts the player's entries as well as the givens", () => {
    const values = g.puzzle.givens.slice();
    const empty = values.findIndex((v) => v === 0);
    values[empty] = g.solution[empty];
    expect(statusLine(analyze(g.puzzle, values), 36)).toEqual({ text: `${givens + 1} of 36 placed`, tone: "info", icon: "grid-nine" });
  });

  it("shows a broken rule instead of the count while it stands", () => {
    const values = g.puzzle.givens.slice();
    const empty = values.findIndex((v) => v === 0);
    const row = Math.floor(empty / 6);
    const clash = values.slice(row * 6, row * 6 + 6).find(Boolean)!;
    values[empty] = clash;
    const line = statusLine(analyze(g.puzzle, values), 36);
    expect(line.tone).toBe("danger");
    expect(line.text).not.toMatch(/placed/);
  });

  it("says cleared when the board is solved", () => {
    expect(statusLine(analyze(g.puzzle, g.solution.slice()), 36).tone).toBe("success");
  });
});
