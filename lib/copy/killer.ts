/** Player-facing copy for Killer Sums (games/killer). Board copy is shared with Sixer and Nine in lib/copy/sudoku.ts. */
export const killer = {
  title: "Killer Sums",
  blurb: "Sudoku with sums in dotted cages",
  rule: "1 to 6 (or 1 to 9) once in every row, column and box. Each dotted cage adds to its total, with no repeats.",
} as const;

/** Hint reasons (one sentence each), built by games/killer/logic.ts on the server. */
export const killerHints = {
  wrong: (d: number) => `This ${d} does not belong here.`,
  single: (sum: number) => `A 1-cell cage of ${sum} can only be ${sum}.`,
  lastCell: (sum: number, d: number) => `This cage adds to ${sum}, so its last cell is ${d}.`,
  onlySet: (cells: number, sum: number, digits: string, d: number) =>
    `The ${cells}-cell cage of ${sum} must be ${digits}, and only ${d} fits here.`,
  onlySetNow: (cells: number, sum: number, digits: string, d: number) =>
    `With its row, column and box, the ${cells}-cell cage of ${sum} can only be ${digits}, so this is ${d}.`,
  onlyFits: (d: number) => `Only ${d} fits here.`,
  withCage: (d: number, sum: number) => `Only ${d} fits here once the cage of ${sum} and its row, column and box are counted.`,
  onlySpot: (d: number, where: string) => `This is the only spot for ${d} in ${where}.`,
  thisBox: "this box",
  cageNeeds: (sum: number, d: number) => `The cage of ${sum} needs a ${d}, and this is the only spot for it.`,
  reveal: (d: number) => `Try ${d} here.`,
} as const;
