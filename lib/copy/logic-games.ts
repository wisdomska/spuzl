/**
 * Player-facing copy for the Logic Lab style boards touched in the frictionless-play pass
 * (Dusk, Four Up, Flinch). Same voice as `lib/copy/index.ts`: short, warm, plain.
 */
export const logicGames = {
  dusk: {
    howTo: "Tap for a sun, double-tap for a moon. Tap again to clear.",
    fixed: "That one is fixed. It came with the puzzle.",
    cleared: "Balanced. Board cleared.",
    clearedAnnounce: "Board cleared.",
    filled: (filled: number, total: number) => `${filled} of ${total} filled`,
    boardLabel: (n: number) => `Dusk board, ${n} by ${n}. Space cycles a cell; S places a sun, M a moon, Delete clears.`,
    cellPrefix: (row: number, col: number) => `Row ${row}, column ${col}`,
    mark: { sun: "sun", moon: "moon", empty: "empty" },
    given: "given",
    breaksRule: "breaks a rule",
    /** "=" and "×" edge constraints, read with the cell they touch */
    link: (same: boolean, dir: "right" | "left" | "above" | "below") =>
      `${same ? "equals" : "is opposite to"} the cell ${dir === "right" || dir === "left" ? `to the ${dir}` : dir}`,
  },
} as const;
