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
  fourup: {
    you: (winIn: number) => `You are the star. Win in ${winIn} drops.`,
    start: (winIn: number) => `Win in ${winIn} drops. Tap a column.`,
    boardLabel: (cols: number, rows: number) =>
      `Four Up board, ${cols} columns by ${rows} rows. Each column is a button; arrow keys move between columns.`,
    /** the whole column is one button: where the next disc lands, then what is in it, bottom up */
    column: (col: number, landsOn: number | null, discs: string[]) =>
      `Column ${col}. ${landsOn === null ? "Full" : `Drops to row ${landsOn}`}.${discs.length ? ` ${discs.join(", ")}.` : " Empty."}`,
    disc: (row: number, star: boolean, winning: boolean) => `Row ${row} ${star ? "star" : "ring"}${winning ? ", winning four" : ""}`,
    dropped: (col: number, row: number) => `Star disc in column ${col}, row ${row}`,
    block: (col: number, left: number) => `They block column ${col}. Win in ${left} more.`,
    blockAnnounce: (col: number, left: number) => `Ring disc in column ${col}. Win in ${left} more.`,
  },
  flinch: {
    tutorial: "Tap to arm, then tap the moment the pad says Tap!",
    intro: (total: number, penalty: number) => `Best of ${total}. Early taps cost ${penalty}.`,
    wait: "Wait",
    waitSmall: "Tap when it says Tap!",
    go: "Tap!",
    goSmall: "Now",
    armAnnounce: (round: number) => `Round ${round}. Wait for Tap!`,
    goAnnounce: "Tap!",
    ready: "Ready",
    readySmall: (round: number) => `Tap to start round ${round}`,
    nextSoon: "Next round starting. Tap to go now",
    score: "Score",
    tooSoon: "Too soon",
    tooSlow: "Too slow",
    falseStart: (penalty: number) => `Too soon. False start, minus ${penalty}.`,
    timeout: "Too slow. No points this round.",
    timeoutAnnounce: "Round timed out.",
    reaction: (ms: number, round: number, total: number) => `${ms} ms. Round ${round} of ${total}.`,
    reactionAnnounce: (ms: number, auto: boolean) => `${ms} milliseconds.${auto ? " Next round starts on its own." : ""}`,
    done: (best: number | null, score: number) => (best === null ? `Done. Score ${score}.` : `Best ${best} ms. Score ${score}.`),
  },
} as const;
