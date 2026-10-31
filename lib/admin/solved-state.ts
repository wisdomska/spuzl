/**
 * Turns a stored solution into the final board state a player would submit, so the solve-check can run the
 * game's own verify() against the stored answer key (FR-AD-02). Pure: no server or React imports.
 * Games missing here fall back to submitting the solution itself (many games verify that shape directly);
 * if that is refused too, the check asks for a Play test, which verifies a real board state on the server.
 */
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
