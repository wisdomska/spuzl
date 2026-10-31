/**
 * Crownfall: one crown per row, column and colour region; crowns never touch, not even diagonally.
 * Prototype `analyze()` ported to N × N, plus a generator, a uniqueness solver and a grader.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { CROWNFALL_COPY } from "@/lib/copy/crownfall";

export interface CrownfallPuzzle {
  size: number;
  /** region index per cell, row-major, length size*size */
  regions: number[];
}
/** column of the crown in each row */
export type CrownfallSolution = number[];
/** 0 empty, 1 marked X, 2 crown; row-major */
export type CrownfallState = number[];

export const EMPTY = 0;
export const MARK = 1;
export const CROWN = 2;

export const SIZE_FOR: Record<Difficulty, number> = { easy: 5, medium: 6, hard: 7, expert: 8, mega: 9 };

export type RuleBreak = "row" | "column" | "region" | "touch";
export const RULE_COPY: Record<RuleBreak, string> = {
  row: "Two crowns in one row.",
  column: "Two crowns in one column.",
  region: "Two crowns in one colour.",
  touch: "Those crowns are touching corners. Give them space.",
};

export interface Analysis {
  crowns: number;
  /** indexes of cells involved in a broken rule */
  bad: Set<number>;
  rule: RuleBreak | null;
  message: string;
  clear: boolean;
}

/** Port of the prototype analyze(): validation and which rule message to show. */
export function analyze(p: CrownfallPuzzle, cells: CrownfallState): Analysis {
  const n = p.size;
  const cr: number[] = [];
  cells.forEach((v, i) => v === CROWN && cr.push(i));
  const bad = new Set<number>();
  let rule: RuleBreak | null = null;
  for (let x = 0; x < cr.length; x++) {
    for (let y = x + 1; y < cr.length; y++) {
      const a = cr[x],
        b = cr[y];
      const ra = Math.floor(a / n),
        ca = a % n,
        rb = Math.floor(b / n),
        cb = b % n;
      let why: RuleBreak | null = null;
      if (ra === rb) why = "row";
      else if (ca === cb) why = "column";
      else if (p.regions[a] === p.regions[b]) why = "region";
      else if (Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1) why = "touch";
      if (why) {
        bad.add(a);
        bad.add(b);
        rule ??= why;
      }
    }
  }
  return { crowns: cr.length, bad, rule, message: rule ? RULE_COPY[rule] : "", clear: cr.length === n && bad.size === 0 };
}

/* ---------------- Solver ---------------- */

/** Counts solutions up to `limit` with row-by-row backtracking and region/column/adjacency pruning. */
export function countSolutions(p: CrownfallPuzzle, limit = 2): number {
  const n = p.size;
  const colUsed = new Array<boolean>(n).fill(false);
  const regUsed = new Array<boolean>(n).fill(false);
  // Region sizes lets us prune: a region whose cells all lie in already-filled rows must be used.
  let count = 0;
  const placed: number[] = [];
  const rec = (r: number) => {
    if (count >= limit) return;
    if (r === n) {
      count++;
      return;
    }
    for (let c = 0; c < n; c++) {
      if (colUsed[c]) continue;
      const reg = p.regions[r * n + c];
      if (regUsed[reg]) continue;
      if (r > 0 && Math.abs(placed[r - 1] - c) <= 1) continue;
      colUsed[c] = true;
      regUsed[reg] = true;
      placed[r] = c;
      if (regionsStillReachable(p, r + 1, regUsed)) rec(r + 1);
      colUsed[c] = false;
      regUsed[reg] = false;
    }
  };
  rec(0);
  return count;
}

/** Every unused region must still have a cell in rows >= fromRow. */
function regionsStillReachable(p: CrownfallPuzzle, fromRow: number, regUsed: boolean[]): boolean {
  const n = p.size;
  const seen = new Array<boolean>(n).fill(false);
  for (let i = fromRow * n; i < n * n; i++) seen[p.regions[i]] = true;
  for (let g = 0; g < n; g++) if (!regUsed[g] && !seen[g]) return false;
  return true;
}

export function solve(p: CrownfallPuzzle): CrownfallSolution | null {
  const n = p.size;
  const out: number[] = [];
  const colUsed = new Array<boolean>(n).fill(false);
  const regUsed = new Array<boolean>(n).fill(false);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    for (let c = 0; c < n; c++) {
      const reg = p.regions[r * n + c];
      if (colUsed[c] || regUsed[reg] || (r > 0 && Math.abs(out[r - 1] - c) <= 1)) continue;
      colUsed[c] = regUsed[reg] = true;
      out[r] = c;
      if (rec(r + 1)) return true;
      colUsed[c] = regUsed[reg] = false;
    }
    return false;
  };
  return rec(0) ? out : null;
}

/* ---------------- Logical deduction (grader + hints) ---------------- */

interface Deduction {
  cell: number;
  value: typeof CROWN | typeof MARK;
  why: string;
}

/**
 * Finds one human-style deduction for the current marks:
 * 1. cells ruled out by an existing crown (row, column, region, neighbours)
 * 2. a row, column or region with exactly one open cell must hold the crown
 * 3. region confined to k rows/columns claims them (k = 1 only, keeps hints readable)
 */
export function nextDeduction(p: CrownfallPuzzle, cells: CrownfallState): Deduction | null {
  const n = p.size;
  const open = (i: number) => cells[i] === EMPTY;
  const blocked = new Set<number>();
  cells.forEach((v, i) => {
    if (v !== CROWN) return;
    const r = Math.floor(i / n),
      c = i % n;
    for (let j = 0; j < n * n; j++) {
      if (j === i) continue;
      const rj = Math.floor(j / n),
        cj = j % n;
      if (rj === r || cj === c || p.regions[j] === p.regions[i] || (Math.abs(rj - r) <= 1 && Math.abs(cj - c) <= 1)) blocked.add(j);
    }
  });
  for (const j of blocked) if (open(j)) return { cell: j, value: MARK, why: "A crown already covers this spot." };

  const groups: { cells: number[]; label: string }[] = [];
  for (let r = 0; r < n; r++) groups.push({ cells: Array.from({ length: n }, (_, c) => r * n + c), label: `row ${r + 1}` });
  for (let c = 0; c < n; c++) groups.push({ cells: Array.from({ length: n }, (_, r) => r * n + c), label: `column ${c + 1}` });
  for (let g = 0; g < n; g++) groups.push({ cells: p.regions.flatMap((reg, i) => (reg === g ? [i] : [])), label: "this colour" });
  for (const grp of groups) {
    if (grp.cells.some((i) => cells[i] === CROWN)) continue;
    const opens = grp.cells.filter(open);
    if (opens.length === 1) return { cell: opens[0], value: CROWN, why: `Only one spot left in ${grp.label}.` };
  }
  // Region confined to one row or column: other cells of that row/column cannot hold a crown.
  for (let g = 0; g < n; g++) {
    const rc = p.regions.flatMap((reg, i) => (reg === g && cells[i] !== MARK ? [i] : []));
    if (rc.some((i) => cells[i] === CROWN) || rc.length === 0) continue;
    const rows = new Set(rc.map((i) => Math.floor(i / n)));
    const cols = new Set(rc.map((i) => i % n));
    if (rows.size === 1) {
      const r = [...rows][0];
      for (let c = 0; c < n; c++) {
        const j = r * n + c;
        if (p.regions[j] !== g && open(j)) return { cell: j, value: MARK, why: `That colour lives only in row ${r + 1}.` };
      }
    }
    if (cols.size === 1) {
      const c = [...cols][0];
      for (let r = 0; r < n; r++) {
        const j = r * n + c;
        if (p.regions[j] !== g && open(j)) return { cell: j, value: MARK, why: `That colour lives only in column ${c + 1}.` };
      }
    }
  }
  return null;
}

/**
 * Difficulty 0..100: how far simple deductions get before a guess (or deeper reasoning) is needed,
 * scaled by board size.
 */
export function grade(p: CrownfallPuzzle): number {
  const n = p.size;
  const cells: CrownfallState = new Array(n * n).fill(EMPTY);
  let steps = 0;
  for (;;) {
    const d = nextDeduction(p, cells);
    if (!d) break;
    cells[d.cell] = d.value;
    steps++;
  }
  const crowns = cells.filter((v) => v === CROWN).length;
  const stuck = 1 - crowns / n; // share of the board that needs deeper reasoning
  const sizeBase = (n - 5) * 9; // 6 → 9, 10 → 45
  return Math.max(0, Math.min(100, Math.round(sizeBase + stuck * 55 + Math.min(10, steps / 10))));
}

/* ---------------- Generator ---------------- */

function placeCrowns(n: number, rng: Rng): number[] | null {
  const out: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const rec = (r: number): boolean => {
    if (r === n) return true;
    const cols = rng.shuffle(Array.from({ length: n }, (_, i) => i));
    for (const c of cols) {
      if (used[c] || (r > 0 && Math.abs(out[r - 1] - c) <= 1)) continue;
      used[c] = true;
      out[r] = c;
      if (rec(r + 1)) return true;
      used[c] = false;
    }
    return false;
  };
  return rec(0) ? out : null;
}

/** Grows one region per crown by random flood fill, preferring compact shapes. */
function growRegions(n: number, sol: number[], rng: Rng): number[] {
  const regions = new Array<number>(n * n).fill(-1);
  const frontier: number[][] = [];
  sol.forEach((c, r) => {
    regions[r * n + c] = r;
    frontier[r] = [r * n + c];
  });
  let remaining = n * n - n;
  while (remaining > 0) {
    // weighted pick: smaller regions grow a little more often, so sizes stay varied but not extreme
    const g = rng.int(0, n - 1);
    const f = frontier[g];
    if (!f.length) continue;
    const from = f[rng.int(0, f.length - 1)];
    const r = Math.floor(from / n),
      c = from % n;
    const nbrs = [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && regions[a * n + b] === -1);
    if (!nbrs.length) {
      f.splice(f.indexOf(from), 1);
      continue;
    }
    const [a, b] = nbrs[rng.int(0, nbrs.length - 1)];
    regions[a * n + b] = g;
    f.push(a * n + b);
    remaining--;
  }
  return regions;
}

/**
 * Repairs non-uniqueness: while a second solution exists, move one of its crown cells into a
 * neighbouring region of the intended solution, which kills that alternative. Keeps regions connected.
 */
function tighten(n: number, regions: number[], sol: number[], rng: Rng, budget: number): boolean {
  for (let k = 0; k < budget; k++) {
    const alt = findAlternative({ size: n, regions }, sol);
    if (!alt) return true;
    // a row where the alternative differs
    const rows = alt.map((c, r) => (c !== sol[r] ? r : -1)).filter((r) => r >= 0);
    const r = rows[rng.int(0, rows.length - 1)];
    const cell = r * n + alt[r];
    const own = regions[cell];
    if (sol.some((c, rr) => rr * n + c === cell)) continue;
    const nbrRegs = [
      [r - 1, alt[r]],
      [r + 1, alt[r]],
      [r, alt[r] - 1],
      [r, alt[r] + 1],
    ]
      .filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n)
      .map(([a, b]) => regions[a * n + b])
      .filter((g) => g !== own);
    if (!nbrRegs.length) continue;
    const target = nbrRegs[rng.int(0, nbrRegs.length - 1)];
    regions[cell] = target;
    if (!connected(n, regions, own)) regions[cell] = own;
  }
  return !findAlternative({ size: n, regions }, sol);
}

function findAlternative(p: CrownfallPuzzle, sol: number[]): number[] | null {
  const n = p.size;
  const out: number[] = [];
  const colUsed = new Array<boolean>(n).fill(false);
  const regUsed = new Array<boolean>(n).fill(false);
  const rec = (r: number): boolean => {
    if (r === n) return out.some((c, i) => c !== sol[i]);
    for (let c = 0; c < n; c++) {
      const reg = p.regions[r * n + c];
      if (colUsed[c] || regUsed[reg] || (r > 0 && Math.abs(out[r - 1] - c) <= 1)) continue;
      colUsed[c] = regUsed[reg] = true;
      out[r] = c;
      if (regionsStillReachable(p, r + 1, regUsed) && rec(r + 1)) return true;
      colUsed[c] = regUsed[reg] = false;
    }
    return false;
  };
  return rec(0) ? out.slice() : null;
}

function connected(n: number, regions: number[], g: number): boolean {
  const cells = regions.flatMap((x, i) => (x === g ? [i] : []));
  if (!cells.length) return false;
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const i = stack.pop()!;
    const r = Math.floor(i / n),
      c = i % n;
    for (const [a, b] of [
      [r - 1, c],
      [r + 1, c],
      [r, c - 1],
      [r, c + 1],
    ]) {
      const j = a * n + b;
      if (a >= 0 && b >= 0 && a < n && b < n && regions[j] === g && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === cells.length;
}

/** Relabels regions in reading order so equal shapes always render the same colours. */
function normalise(regions: number[]): { regions: number[]; map: Map<number, number> } {
  const map = new Map<number, number>();
  const out = regions.map((g) => {
    if (!map.has(g)) map.set(g, map.size);
    return map.get(g)!;
  });
  return { regions: out, map };
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<CrownfallPuzzle, CrownfallSolution> {
  const n = SIZE_FOR[difficulty];
  for (let attempt = 0; attempt < 400; attempt++) {
    const sol = placeCrowns(n, rng);
    if (!sol) continue;
    const regions = growRegions(n, sol, rng);
    if (!tighten(n, regions, sol, rng, n * 6)) continue;
    const { regions: norm } = normalise(regions);
    const puzzle = { size: n, regions: norm };
    if (countSolutions(puzzle, 2) !== 1) continue;
    return { puzzle, solution: sol, grade: grade(puzzle) };
  }
  throw new Error(`crownfall: could not generate a unique ${n}x${n} puzzle`);
}

/* ---------------- Verification ---------------- */

export function verify(p: CrownfallPuzzle, sol: CrownfallSolution, state: CrownfallState): VerifyResult {
  const n = p.size;
  if (!Array.isArray(state) || state.length !== n * n || state.some((v) => v !== EMPTY && v !== MARK && v !== CROWN)) {
    return { ok: false, progress: 0, reason: "malformed state" };
  }
  const a = analyze(p, state);
  const progress = progressOf(p, sol, state);
  if (!a.clear) return { ok: false, progress, reason: a.rule ?? "incomplete" };
  // A valid layout must equal the unique solution; anything else means the puzzle data was tampered with.
  const match = sol.every((c, r) => state[r * n + c] === CROWN);
  return match ? { ok: true, progress: 1 } : { ok: false, progress, reason: "valid but not the scheduled solution" };
}

/** Correct crowns / size. Wrong crowns do not count, so progress never leaks positions. */
function progressOf(p: CrownfallPuzzle, sol: CrownfallSolution, state: CrownfallState): number {
  const n = p.size;
  const a = analyze(p, state);
  const correct = sol.filter((c, r) => state[r * n + c] === CROWN && !a.bad.has(r * n + c)).length;
  return correct / n;
}

/* ---------------- Hint engine ---------------- */

export type ExplainKind = "wrong-crown" | "wrong-mark" | "last-spot" | "line-in-region" | "region-in-line" | "empties-unit" | "reveal";

export interface Explained {
  cell: number;
  /** what the player should put in `cell`: a crown, an X, or EMPTY to clear a wrong mark */
  value: typeof CROWN | typeof MARK | typeof EMPTY;
  kind: ExplainKind;
  text: string;
}

interface Unit {
  kind: "row" | "column" | "region";
  index: number;
  cells: number[];
}

/**
 * Finds the next real deduction for a player's state, with a one sentence reason. Cells ruled out only
 * because they share a row, column or region with a crown, or touch one, are treated as already gone and
 * are never offered as a hint on their own. Steps, first match wins:
 * 1. a row, column or region with one possible spot left: crown it
 * 2. a row or column whose possible spots all sit in one region: that region's other spots are out
 * 3. a region whose possible spots all sit in one row or column: that line's other spots are out
 * 4. a spot whose crown would leave some row, column or region with no possible spot: it is out
 * Assumes every crown and X in `cells` agrees with a solution (`hint` fixes wrong ones first).
 */
export function explainNext(p: CrownfallPuzzle, cells: CrownfallState): Explained | null {
  const n = p.size;
  const H = CROWNFALL_COPY.hints;
  const colour = (g: number) => CROWNFALL_COPY.regionName(g);
  const lineName = (u: Unit) => (u.kind === "row" ? CROWNFALL_COPY.row(u.index) : CROWNFALL_COPY.column(u.index));
  const rowOf = (i: number) => Math.floor(i / n);
  const colOf = (i: number) => i % n;
  const conflicts = (a: number, b: number) =>
    rowOf(a) === rowOf(b) ||
    colOf(a) === colOf(b) ||
    p.regions[a] === p.regions[b] ||
    (Math.abs(rowOf(a) - rowOf(b)) <= 1 && Math.abs(colOf(a) - colOf(b)) <= 1);

  const crowns: number[] = [];
  cells.forEach((v, i) => v === CROWN && crowns.push(i));
  const possible = new Array<boolean>(n * n).fill(false);
  for (let i = 0; i < n * n; i++) possible[i] = cells[i] === EMPTY && !crowns.some((c) => conflicts(c, i));

  const units: Unit[] = [];
  for (let r = 0; r < n; r++) units.push({ kind: "row", index: r, cells: Array.from({ length: n }, (_, c) => r * n + c) });
  for (let c = 0; c < n; c++) units.push({ kind: "column", index: c, cells: Array.from({ length: n }, (_, r) => r * n + c) });
  for (let g = 0; g < n; g++) units.push({ kind: "region", index: g, cells: p.regions.flatMap((reg, i) => (reg === g ? [i] : [])) });
  const open = units.filter((u) => !u.cells.some((i) => cells[i] === CROWN));
  const spots = (u: Unit) => u.cells.filter((i) => possible[i]);

  // 1. Last possible spot in a row, column or region.
  for (const u of open) {
    const s = spots(u);
    if (s.length === 1) {
      const text = u.kind === "region" ? H.lastSpotRegion(colour(u.index)) : H.lastSpotLine(lineName(u));
      return { cell: s[0], value: CROWN, kind: "last-spot", text };
    }
  }

  // 2. A row or column that can only hold its crown inside one region claims that region.
  for (const u of open) {
    if (u.kind === "region") continue;
    const s = spots(u);
    const regs = new Set(s.map((i) => p.regions[i]));
    if (regs.size !== 1) continue;
    const g = [...regs][0];
    const out = p.regions.findIndex((reg, i) => reg === g && possible[i] && !u.cells.includes(i));
    if (out >= 0) return { cell: out, value: MARK, kind: "line-in-region", text: H.lineInRegion(lineName(u), colour(g)) };
  }

  // 3. A region confined to one row or column claims that line.
  for (const u of open) {
    if (u.kind !== "region") continue;
    const s = spots(u);
    if (!s.length) continue;
    for (const kind of ["row", "column"] as const) {
      const at = kind === "row" ? rowOf : colOf;
      if (new Set(s.map(at)).size !== 1) continue;
      const line: Unit = { kind, index: at(s[0]), cells: [] };
      const out = Array.from({ length: n }, (_, k) => (kind === "row" ? line.index * n + k : k * n + line.index)).find(
        (i) => possible[i] && p.regions[i] !== u.index,
      );
      if (out !== undefined)
        return { cell: out, value: MARK, kind: "region-in-line", text: H.regionInLine(colour(u.index), lineName(line)) };
    }
  }

  // 4. A crown here would leave another row, column or region with nowhere to go.
  for (let x = 0; x < n * n; x++) {
    if (!possible[x]) continue;
    let emptied: Unit | undefined;
    for (const u of open) {
      if (u.cells.includes(x)) continue;
      if (spots(u).every((i) => conflicts(x, i))) {
        if (u.kind === "region") {
          emptied = u;
          break;
        }
        emptied ??= u;
      }
    }
    if (emptied) {
      const text = emptied.kind === "region" ? H.emptiesRegion(colour(emptied.index)) : H.emptiesLine(lineName(emptied));
      return { cell: x, value: MARK, kind: "empties-unit", text };
    }
  }
  return null;
}

export function hint(p: CrownfallPuzzle, sol: CrownfallSolution, given: CrownfallState | undefined): Hint | null {
  const e = explainHint(p, sol, given);
  return e && { target: e.cell, text: e.text };
}

/** `hint` with the suggested value and deduction kind (used by tests and any richer hint UI). */
export function explainHint(p: CrownfallPuzzle, sol: CrownfallSolution, given: CrownfallState | undefined): Explained | null {
  const n = p.size;
  const H = CROWNFALL_COPY.hints;
  // Hints can be asked for before the first move: treat a missing state as the empty board.
  const state = Array.isArray(given) && given.length === n * n ? given : new Array<number>(n * n).fill(EMPTY);
  const isSolution = (i: number) => sol[Math.floor(i / n)] === i % n;
  // Deductions are only sound on a consistent board: fix a wrong crown, then an X on a crown spot.
  for (let i = 0; i < n * n; i++) {
    if (state[i] === CROWN && !isSolution(i)) return { cell: i, value: EMPTY, kind: "wrong-crown", text: H.wrongCrown };
  }
  for (let i = 0; i < n * n; i++) {
    if (state[i] === MARK && isSolution(i)) return { cell: i, value: EMPTY, kind: "wrong-mark", text: H.wrongMark };
  }
  const d = explainNext(p, state);
  if (d) return d;
  // No simple deduction: reveal the crown of the most constrained unsolved row. The puzzle is unique, so
  // every other spot in that row really does lead to a dead end.
  let best = -1,
    bestSpots = Infinity;
  for (let r = 0; r < n; r++) {
    const i = r * n + sol[r];
    if (state[i] === CROWN) continue;
    const spots = Array.from({ length: n }, (_, c) => r * n + c).filter((j) => state[j] === EMPTY).length;
    if (spots < bestSpots) {
      best = r;
      bestSpots = spots;
    }
  }
  if (best < 0) return null;
  return { cell: best * n + sol[best], value: CROWN, kind: "reveal", text: H.reveal(CROWNFALL_COPY.row(best)) };
}

const logic: GameLogic<CrownfallPuzzle, CrownfallSolution, CrownfallState> = {
  id: "crownfall",
  generate,
  countSolutions,
  verify,
  progress: progressOf,
  hint,
};
export default logic;
