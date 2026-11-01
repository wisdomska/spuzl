/**
 * Turns a stored solution into the final board state a player would submit, so the solve-check can run the
 * game's own verify() against the stored answer key (FR-AD-02). Pure: no server or React imports.
 * Games missing here fall back to submitting the solution itself (many games verify that shape directly);
 * if that is refused too, the check asks for a Play test, which verifies a real board state on the server.
 */
import { turnsTo } from "@/games/flowline/logic";
import { answer as hiloAnswer, CALLS as HILO_CALLS } from "@/games/hilo/logic";
import {
  AIM_SWEET,
  METER_MAX,
  POWER_SWEET,
  meterAt,
  type KickInput,
  type PenaltyPuzzle,
  type PenaltySolution,
} from "@/games/penalty/logic";
import { LAMP, EMPTY } from "@/games/lightup/logic";
import { defence, type DaraPuzzle, type DaraSolution, type PuzzleMove } from "@/games/dara/logic";
import { steps as daraSteps } from "@/games/dara/rules";
import { HUMAN_FLOOR_MS } from "@/games/_shared/reflex";

/**
 * Penalty King: per kick, aim for the corner sweet spot away from the keeper's dive and hit the power sweet
 * spot. Tap times are the first moments (past the human floor) the seeded meters read those values.
 */
function penaltyShots(p: PenaltyPuzzle, s: PenaltySolution): { kicks: KickInput[] } {
  const firstAt = (period: number, target: number, from: number, to: number) => {
    let best = from,
      gap = Infinity;
    for (let t = from; t <= to; t++) {
      const d = Math.abs(meterAt(t, period) - target);
      if (d < gap) {
        best = t;
        gap = d;
        if (d === 0) break;
      }
    }
    return best;
  };
  const kicks = p.kicks.map((k, i) => {
    // dive 0 is left: shoot right; dive 2 is right: shoot left; a keeper who stays loses either corner
    const aim = s.dives[i] === 0 ? METER_MAX - AIM_SWEET : AIM_SWEET;
    const aimAt = firstAt(k.aimPeriod, aim, HUMAN_FLOOR_MS, Math.floor(p.kickMs / 2));
    const powerAt = firstAt(k.powerPeriod, POWER_SWEET, HUMAN_FLOOR_MS, p.kickMs - aimAt);
    return { aimAt, powerAt };
  });
  return { kicks };
}

/** Beat Tap: every beat tapped inside the Perfect window, with a human-sized scatter (a dead-even run reads as scripted). */
const BEAT_SCATTER = [-24, 12, -6, 30, -18, 4, 22, -30, 8, -12];

/**
 * Dara: the one first step, their scripted defence (three2 puzzles), then the three, taking an allowed stone.
 * The same replay verify runs, so no bot-vs-bot play is needed: every puzzle is a short forced line.
 */
function daraLine(p: DaraPuzzle, s: DaraSolution): { moves: PuzzleMove[] } {
  const b = p.board.slice();
  const move = (from: number, to: number) => {
    b[to] = b[from];
    b[from] = 0;
  };
  const takeFrom = () => (p.goal === "block" ? s.takes[0] : b.findIndex((v) => v === 2));
  const first: PuzzleMove = { from: s.from, to: s.to };
  move(s.from, s.to);
  if (p.goal !== "three2") return { moves: [{ ...first, take: takeFrom() }] };
  const reply = defence(b);
  if (!reply) throw new Error("no defence");
  move(reply.from, reply.to);
  const finish = daraSteps(b, 1).find((x) => x.three);
  if (!finish) throw new Error("no finishing three");
  move(finish.from, finish.to);
  const take = b.findIndex((v) => v === 2);
  return { moves: [first, { from: finish.from, to: finish.to, take }] };
}

type Adapter = (puzzle: unknown, solution: unknown) => unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const sudoku: Adapter = (_p, s: any) => ({ values: (s as number[]).slice(), notes: new Array((s as number[]).length).fill(0) });

export const SOLVED_STATE: Record<string, Adapter> = {
  crownfall: (p: any, s: any) => {
    const n = p.size as number;
    const cells = new Array(n * n).fill(0);
    (s as number[]).forEach((c, r) => (cells[r * n + c] = 2));
    return cells;
  },
  sixer: sudoku,
  nine: sudoku,
  pixl: (_p, s: any) => (s as number[]).map((v) => (v ? 1 : 2)),
  tripwire: (p: any) => {
    const mines = new Set<number>(p.mines);
    return Array.from({ length: p.w * p.h }, (_, i) => (mines.has(i) ? 2 : 1));
  },
  quilt: (_p, s: any) => s,
  flowline: (p: any, s: any) => (p.tiles as number[]).map((t, i) => turnsTo(t, s[i])),
  deadon: (_p, s: any) => ({ steps: s.steps }),
  coil: (_p, s: any) => ({ found: s.paths }),
  quads: (_p, s: any) => ({ guesses: s.groups.map((g: { words: string[] }) => g.words) }),
  minicross: (_p, s: any) => ({ cells: s.grid }),
  rungs: (_p, s: any) => ({
    answers: (s.display as number[]).map((w) => s.words[w]),
    order: [1, 2, 3, 4, 5].map((w) => (s.display as number[]).indexOf(w)),
    caps: [s.words[0], s.words[6]],
  }),
  seven: (_p, s: any) => ({ found: s.words }),
  buried: (_p, s: any) => ({ found: s.placements.map((x: { cells: number[] }) => x.cells) }),
  remix: (_p, s: any) => ({ answers: s.words }),
  hunch: (_p, s: any) => ({ opened: 1, guesses: [s.accept[0]] }),
  quickfire: (_p, s: any) => ({ answers: (s.correct as number[]).map((pick) => ({ pick, ms: 4000 })) }),
  five: (_p, s: any) => ({ guesses: [s.answer] }),
  // every title found on the first try, a few seconds in
  emojihits: (_p, s: any) => ({ rounds: (s.answers as string[][]).map((a) => ({ tries: [a[0]], ms: 4000 })) }),
  killer: sudoku,
  lightup: (p: any, s: any) => {
    const cells = new Array((p.size as number) ** 2).fill(EMPTY);
    for (const i of s.lamps as number[]) cells[i] = LAMP;
    return cells;
  },
  // every call right
  hilo: (_p, s: any) => ({ calls: Array.from({ length: HILO_CALLS }, (_, i) => hiloAnswer(s.values, i)) }),
  penalty: (p: any, s: any) => penaltyShots(p, s),
  beattap: (p: any) => ({ taps: (p.beats as number[]).map((b, i) => b + BEAT_SCATTER[i % BEAT_SCATTER.length]), done: true }),
  dara: (p: any, s: any) => daraLine(p, s),
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Candidate solved states for a game, most specific first. */
export function solvedStates(gameId: string, puzzle: unknown, solution: unknown): { via: string; state: unknown }[] {
  const out: { via: string; state: unknown }[] = [];
  const a = SOLVED_STATE[gameId];
  if (a) {
    try {
      out.push({ via: "adapter", state: a(puzzle, solution) });
    } catch {
      /* malformed stored solution: verify will fail on the fallback and say so */
    }
  }
  if (solution !== null && solution !== undefined) out.push({ via: "solution", state: solution });
  return out;
}
