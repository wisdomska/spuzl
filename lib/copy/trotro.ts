/** Player-facing copy for Trotro Jam (board, controls, hints). */

/**
 * Vehicle colours: --reg-N palette indexes (app/globals.css) and their names, as in Crownfall's regions.
 * Orange (reg-4) is left out: it reads too close to the trotro, which wears the Shape Shed world colour.
 */
const palette = [
  [0, "purple"],
  [1, "teal"],
  [2, "pink"],
  [3, "green"],
  [5, "blue"],
  [6, "red"],
  [7, "olive"],
  [8, "gold"],
  [9, "grey"],
] as const;
/** Each vehicle also wears a letter, so names never rely on colour alone. */
const LETTERS = "ABCDEFGHIJKLMNOP";
const tone = (i: number) => palette[(i - 1) % palette.length];

type Dir = "up" | "down" | "left" | "right";

export const TROTRO_COPY = {
  trotro: "the trotro",
  /** --reg-N index for vehicle i (1-based; 0 is the trotro) */
  colourIndex: (i: number) => tone(i)[0],
  letter: (i: number) => LETTERS[(i - 1) % LETTERS.length],
  vehicleName: (len: number, i: number) => `the ${tone(i)[1]} ${len === 3 ? "truck" : "car"} ${LETTERS[(i - 1) % LETTERS.length]}`,
  /** Hint sentences (games/trotro/logic.ts `explain`). One sentence each, no dashes. */
  hints: {
    driveOut: "The road is clear, so drive the trotro to the exit.",
    soThat: (who: string, dir: Dir, next: string, nextDir: Dir, isTrotro: boolean) =>
      isTrotro && nextDir === "right"
        ? `Move ${who} ${dir} to open the road for the trotro.`
        : `Move ${who} ${dir} so ${next} can slide ${nextDir}.`,
    plain: (who: string, dir: Dir, left: number) => `Move ${who} ${dir}; it is the first of ${left} moves at best.`,
  },
  moveLabel: (dir: Dir) => `Move ${dir}`,
  moveGroup: "Slide the selected vehicle",
  controls: { undo: "Undo", reset: "Reset", hint: "Hint" },
  start: (par: number) => `Par ${par}. Free the trotro: slide the others out of its way.`,
  tutorial: "Tap a car, then an arrow, or drag it along its lane.",
  tally: (moves: number, par: number) =>
    `${moves} ${moves === 1 ? "move" : "moves"}, ${moves <= par ? `par ${par}` : `${moves - par} over par`}.`,
  selected: (name: string) => `${cap(name)} selected. Use the arrows to slide it.`,
  noSelection: "Tap a car or truck first.",
  blocked: (name: string, dir: Dir) => `${cap(name)} cannot move ${dir} from here.`,
  moved: (name: string, dir: Dir, n: number) => `${cap(name)} moved ${dir} ${n} ${n === 1 ? "space" : "spaces"}.`,
  wrongAxis: (name: string, axis: "h" | "v") => `${cap(name)} only slides ${axis === "h" ? "left and right" : "up and down"}.`,
  reset: (par: number) => `Back to the start. Par ${par}.`,
  out: (moves: number, par: number) =>
    moves <= par
      ? `Trotro is out in ${moves} moves, on par. Next stop, Circle!`
      : `Trotro is out in ${moves} moves, ${moves - par} over par.`,
  cleared: (moves: number, par: number) => `The trotro left the station in ${moves} moves. Par ${par}.`,
  board: (par: number) => `Trotro Jam lot, 6 by 6, exit on the right of row 3, par ${par}`,
  exit: "Exit",
  cellLabel: (r: number, c: number, what: string) => `Row ${r + 1}, column ${c + 1}, ${what}`,
  cellEmpty: "empty",
  cellExit: "empty, exit lane",
  cellVehicle: (name: string, axis: "h" | "v", sel: boolean) =>
    `${name}, ${axis === "h" ? "slides left and right" : "slides up and down"}${sel ? ", selected" : ""}`,
} as const;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
