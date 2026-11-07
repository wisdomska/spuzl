/** Player-facing copy for Azonto Steps (games/azonto, R2-P5 lab game). Short, warm, plain. */
import type { MoveDef } from "@/games/azonto/rules";

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** Each move's name, as Azonto dancers call it, and what it mimes. */
export const MOVE_NAME: Record<MoveDef["id"], string> = {
  iron: "Iron",
  phone: "Phone call",
  wash: "Wash",
  box: "Boxing",
};
export const ARROW_NAME: Record<MoveDef["arrow"], string> = {
  left: "left arrow",
  up: "up arrow",
  right: "right arrow",
  down: "down arrow",
};

export const azonto = {
  pad: "Azonto moves",
  stage: "Spuz's dance floor",
  start: "Start",
  resume: "Resume",
  watch: "Watch",
  yourTurn: "Your turn",
  runOver: "Run over",
  /** a pad button's accessible name: "Iron, left arrow, key 1" */
  moveLabel: (name: string, arrow: string, key: string, lit: boolean) => `${name}, ${arrow}, key ${key}${lit ? ", now" : ""}`,
  keysHint: "Keys 1 to 4 or the arrows",
  ready: "Ready",
  paused: "Paused",
  best: (n: number) => `Best ${n}`,
  status: (done: number, total: number) => `Your turn, ${done} of ${total}`,
  sequence: (len: number, round: number) => `Sequence of ${len}, round ${round}`,
  /** Spuz's move bubble while dancing (reduced motion shows only this, highlighted) */
  nowMove: (name: string) => `${name}!`,
  idle: "Spuz is ready to dance",
  intro: "Press Start, watch Spuz dance, then repeat the moves.",
  introTutorial: "Watch Spuz dance a move, then tap the same move. One more each round.",
  watchRound: (round: number, n: number) => `Watch Spuz. Round ${round}, ${n} ${plural(n, "move")}.`,
  watchSay: (round: number, n: number) => `Round ${round}. Watch ${n} ${plural(n, "move")}.`,
  turn: (k: number, n: number) => `Your turn, ${k} of ${n}`,
  turnSay: (n: number) => `Your turn. Repeat ${n} ${plural(n, "move")}.`,
  moveSay: (name: string, k: number, n: number) => `${name}, ${k} of ${n}`,
  roundDone: (n: number) => `${n} ${plural(n, "move")}. One more next round.`,
  wrong: (expected: string, best: number) => `It was ${expected}. You repeated ${best} ${plural(best, "move")}.`,
  slow: (best: number) => `Too slow. You repeated ${best} ${plural(best, "move")}.`,
  full: (n: number) => `The whole dance! ${n} moves.`,
  over: (best: number) => `Run over. Longest sequence ${best}.`,
} as const;
