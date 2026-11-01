/** Player-facing copy for Buried (hints). */

/** A cell as the player reads it, 1-based. */
const cellAt = (row: number, col: number) => `row ${row}, column ${col}`;

export const BURIED_COPY = {
  cellAt,
  /** Server hint: where an unfound word starts, in the puzzle's own (unrotated) rows and columns. */
  hintStart: (word: string, row: number, col: number) => `${word} starts at ${cellAt(row, col)}.`,
};
