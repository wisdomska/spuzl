/**
 * Azonto Steps rules shared by the board and the logic (R2-P5, lab game). Pure, no secrets: the sequence is shown
 * to the player anyway.
 *
 * Azonto is a Ghanaian dance whose moves mime everyday things. The four moves here are among the best known: ironing
 * clothes, a phone call, washing, and boxing. Each move has a name, an arrow, a key and a shape, so it never rests
 * on colour alone.
 */
export const MOVES = 4;

export interface MoveDef {
  /** the move's id (copy keys, data attributes) */
  id: "iron" | "phone" | "wash" | "box";
  /** arrow key and the arrow drawn on its pad */
  arrow: "left" | "up" | "right" | "down";
  /** number key */
  key: string;
  /** shape drawn on its pad (Phosphor icon), so a move reads without colour */
  shape: "square" | "circle" | "triangle" | "diamond";
}

/** Pad order (2 × 2): Iron and Phone call on top, Wash and Boxing below. */
export const MOVE_DEFS: readonly MoveDef[] = [
  { id: "iron", arrow: "left", key: "1", shape: "square" },
  { id: "phone", arrow: "up", key: "2", shape: "circle" },
  { id: "wash", arrow: "right", key: "3", shape: "triangle" },
  { id: "box", arrow: "down", key: "4", shape: "diamond" },
];

const ARROW_KEYS: Record<string, number> = { ArrowLeft: 0, ArrowUp: 1, ArrowRight: 2, ArrowDown: 3 };

/** The move a key press stands for (1 to 4, or an arrow key), or null. */
export function moveForKey(key: string): number | null {
  if (Object.hasOwn(ARROW_KEYS, key)) return ARROW_KEYS[key];
  const n = MOVE_DEFS.findIndex((m) => m.key === key);
  return n >= 0 ? n : null;
}

/** Count-in beats before each demonstration (a soft tick on each, Beat Tap style). */
export const COUNT_IN = 2;
/**
 * The shortest honest run takes longer than this: the count-in and one demonstrated move at the quickest beat
 * (500 ms each), then one move back. It is the catalogue's fast-solve floor (`minTimeMs`).
 */
export const MIN_RUN_MS = 1500;
/** The run ends if the player waits this long between moves. */
export const IDLE_MS = 6000;
/** Nobody reacts to a demonstrated move faster than this (the shared reflex floor). */
export const TAP_FLOOR_MS = 100;

export interface AzontoPuzzle {
  /** move index per step */
  seq: number[];
  /** length of the first round */
  start: number;
  /** one beat of the demonstration, ms (at least 500: nothing pulses faster than 2 Hz) */
  beatMs: number;
  /** how long a move stays lit in the demonstration */
  onMs: number;
}

/** The sequence is shown to the player, so there is no secret. */
export type AzontoSolution = null;

export interface AzontoRound {
  /** [move, ms since the round's input opened] */
  taps: [number, number][];
}

export interface AzontoState {
  rounds: AzontoRound[];
}
