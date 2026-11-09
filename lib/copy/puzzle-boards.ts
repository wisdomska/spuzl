/**
 * Player-facing copy added in the gameplay UX pass (9 Nov) for the Puzzles world boards that keep most of their
 * older wording inline (Weave, Flowline, Pairup). Same voice as `lib/copy/index.ts`: short, warm, plain.
 */
const SIDE = ["above", "right", "below", "left"] as const;

export const puzzleBoards = {
  weave: {
    /** read after a cell's name: where walls block the path (sides 0 up, 1 right, 2 down, 3 left) */
    walls: (sides: number[]) => (sides.length ? `, wall ${sides.map((d) => SIDE[d]).join(" and ")}` : ""),
  },
  flowline: {
    /** every plant has water but the board is not done yet: some pipe is dry or has an open end */
    plantsDone: (dry: number, leaks: number) =>
      leaks > 0
        ? `Every plant is wet. Now close the open ends: ${leaks} ${leaks === 1 ? "pipe leaks" : "pipes leak"}.`
        : `Every plant is wet. Now join the last ${dry} dry ${dry === 1 ? "pipe" : "pipes"} too.`,
    /** spoken name addition for a plant that has water */
    watered: "watered",
  },
} as const;
