/** Player-facing copy for Light Up (board, hints). */

const sides = (k: number) => (k === 1 ? "1 free side" : `${k} free sides`);
const lampsWord = (k: number) => (k === 1 ? "1 lamp" : `${k} lamps`);

export const LIGHTUP_COPY = {
  /** "row 2, column 3" (1-based in text) */
  at: (r: number, c: number) => `row ${r + 1}, column ${c + 1}`,
  /** Why an assumption fails (games/lightup/logic.ts lookahead). */
  why: {
    unlit: (cell: string) => `${cell} with no way to be lit`,
    number: (num: number, cell: string) => `the ${num} at ${cell} with the wrong number of lamps`,
    clash: "two lamps shining on each other",
  },
  /** Hint sentences (games/lightup/logic.ts `explain`). One sentence each, no dashes. */
  hints: {
    fill: (num: number, cell: string, need: number, had: number) =>
      had === 0
        ? `The ${num} at ${cell} has only ${sides(need)}, so ${need === 1 ? "it gets a lamp" : "they all get lamps"}.`
        : `The ${num} at ${cell} needs ${lampsWord(need)} more and has only ${sides(need)}, so ${need === 1 ? "it gets" : "they all get"} ${need === 1 ? "a lamp" : "lamps"}.`,
    full: (num: number, cell: string) =>
      num === 0
        ? `The 0 at ${cell} touches no lamps, so its sides stay dark.`
        : `The ${num} at ${cell} already has its ${num === 1 ? "lamp" : "lamps"}, so its other sides stay dark.`,
    only: (dark: string, from: string) => `Only ${from} can still light ${dark}, so the lamp goes there.`,
    onlySelf: (dark: string) => `Nothing else can still light ${dark}, so it needs a lamp of its own.`,
    tryLamp: (cell: string, why: string) => `A lamp at ${cell} would leave ${why}, so it stays dark.`,
    tryDark: (cell: string, why: string) => `Leaving ${cell} dark would leave ${why}, so it gets a lamp.`,
    wrongLamp: "This lamp does not belong here, so take it off.",
    wrongMark: "This X covers a cell that needs a lamp, so clear it.",
    reveal: (dark: string) => `Every other way to light ${dark} leads to a dead end, so the lamp goes here.`,
  },
  start: (lamps: number) => (lamps ? `${lamps} lamps placed.` : "Light every white cell. Lamps never shine on each other."),
  tutorial: "Tap a white cell for a lamp, again for an X, again to clear.",
  count: (lit: number, total: number) => `${lit} of ${total} cells lit`,
  clash: "Two lamps shine on each other.",
  overfull: (num: number) => `That ${num} has too many lamps around it.`,
  cleared: "Every cell is lit. Lights on!",
  board: (n: number) => `Light Up board, ${n} by ${n}`,
  cellLabel: (r: number, c: number, what: string) => `Row ${r + 1}, column ${c + 1}, ${what}`,
  cellState: {
    black: "black",
    number: (num: number) => `black, ${num}`,
    lamp: "lamp",
    mark: "marked dark",
    lit: "lit",
    dark: "dark",
    bad: ", breaks a rule",
  },
  controls: { undo: "Undo", lamp: "Lamp", mark: "Mark X", hint: "Hint" },
} as const;
