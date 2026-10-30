/**
 * Chess Daily and Free play: "Find the mate. White to move." Mate in 1 to 3.
 *
 * Puzzles are generated from random sparse positions, then proven with the full-rules generator
 * (engine.ts) and an exhaustive mate search (solver.ts): the mate is forced against every defence,
 * there is no shorter mate, and exactly one first move works. Later moves accept any move that keeps
 * the forced mate (the uniqueness promise is about the first move only, as on every puzzle site).
 * Black's replies are the longest defence, computed identically on client and server.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";
import {
  BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE,
  attacked, colOf, fromUci, inCheck, isCapture, isCheckmate, kingSquare, legalMoves, make, parseFen, rowOf, san, sqName, toFen, typeOf, uci,
  type Move, type Position,
} from "./engine";
import { bestDefence, defenderLost, mateIn, matingMoves } from "./solver";

export interface ChessPuzzle {
  /** start position, always white to move */
  fen: string;
  /** moves for white to deliver mate */
  mateIn: number;
}
export interface ChessSolution {
  /** main line in UCI, white and black alternating, ending in mate */
  line: string[];
}
/** White's moves so far, in UCI */
export interface ChessState {
  moves: string[];
}

export const MATE_FOR: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 2, expert: 3, mega: 3 };

export const COPY = {
  mate: "Checkmate.",
  notMate: "Not mate. The king slips out.",
  pick: "Tap a white piece to pick it up.",
  picked: "Piece picked up. Dots are legal squares, rings are captures.",
} as const;

/* ---------------- Replay ---------------- */

export interface Ply {
  uci: string;
  san: string;
  white: boolean;
}
export interface Replay {
  pos: Position;
  plies: Ply[];
  /** white moves accepted so far */
  good: number;
  mated: boolean;
  /** index into state.moves of the first move that does not keep the forced mate, or -1 */
  wrongAt: number;
  /** a submitted move was illegal or malformed */
  illegal: boolean;
}

/**
 * Plays white's moves with black's longest defence in between. A white move counts as good when
 * black is mated within the moves left. Stops at the first illegal or losing move.
 */
export function replay(p: ChessPuzzle, moves: readonly string[]): Replay {
  let pos = parseFen(p.fen);
  const plies: Ply[] = [];
  let good = 0;
  for (let i = 0; i < moves.length; i++) {
    const m = typeof moves[i] === "string" ? fromUci(pos, moves[i]) : null;
    if (!m || pos.turn !== WHITE) return { pos, plies, good, mated: false, wrongAt: i, illegal: true };
    const left = p.mateIn - i - 1;
    const after = make(pos, m);
    plies.push({ uci: uci(m), san: san(pos, m), white: true });
    if (left < 0 || !defenderLost(after, left)) return { pos: after, plies, good, mated: false, wrongAt: i, illegal: false };
    good++;
    pos = after;
    if (isCheckmate(pos)) return { pos, plies, good, mated: true, wrongAt: -1, illegal: false };
    const r = bestDefence(pos, left)!;
    plies.push({ uci: uci(r), san: san(pos, r), white: false });
    pos = make(pos, r);
  }
  return { pos, plies, good, mated: false, wrongAt: -1, illegal: false };
}

/* ---------------- Solver API ---------------- */

/** First moves that force mate within mateIn. A valid puzzle has exactly one. */
export function countSolutions(p: ChessPuzzle, limit = 2): number {
  return Math.min(limit, matingMoves(parseFen(p.fen), p.mateIn).length);
}

/** Main line: the unique first move, longest defence, then the first mating continuation. */
export function solveLine(p: ChessPuzzle): string[] | null {
  let pos = parseFen(p.fen);
  const line: string[] = [];
  for (let left = p.mateIn; left > 0; left--) {
    const m = matingMoves(pos, left)[0];
    if (!m) return null;
    line.push(uci(m));
    pos = make(pos, m);
    if (isCheckmate(pos)) return line;
    const r = bestDefence(pos, left - 1);
    if (!r) return null;
    line.push(uci(r));
    pos = make(pos, r);
  }
  return null;
}

/* ---------------- Grader ---------------- */

/** 0..100: mate length dominates; quiet first moves, sacrifices and busy boards add difficulty. */
export function grade(p: ChessPuzzle, line: string[]): number {
  const pos = parseFen(p.fen);
  const first = fromUci(pos, line[0])!;
  const after = make(pos, first);
  const quiet = !inCheck(after) && !isCapture(pos, first);
  // sacrifice: the moved piece can be taken straight away
  const sac = typeOf(after.b[first.to]) !== PAWN && attacked(after.b, first.to, BLACK);
  const pieces = pos.b.reduce((n, x) => n + (x ? 1 : 0), 0);
  const options = legalMoves(pos).length;
  const base = [0, 8, 38, 68][p.mateIn];
  return Math.min(100, Math.round(base + (quiet ? 12 : 0) + (sac ? 6 : 0) + Math.min(6, pieces / 2) + Math.min(6, options / 6)));
}

/* ---------------- Generator ---------------- */

interface Recipe {
  attackers: number[][];
  blackExtras: number;
  whitePawns: number;
  quietFirst?: boolean;
}
const RECIPES: Record<Difficulty, Recipe> = {
  easy: { attackers: [[ROOK], [QUEEN], [ROOK, KNIGHT], [QUEEN, BISHOP], [ROOK, BISHOP]], blackExtras: 1, whitePawns: 2 },
  medium: { attackers: [[ROOK, ROOK], [QUEEN, KNIGHT], [QUEEN, ROOK], [ROOK, BISHOP], [QUEEN, BISHOP]], blackExtras: 2, whitePawns: 2 },
  hard: { attackers: [[QUEEN, KNIGHT], [ROOK, BISHOP], [QUEEN, ROOK], [ROOK, KNIGHT], [QUEEN, BISHOP]], blackExtras: 2, whitePawns: 3, quietFirst: true },
  expert: { attackers: [[QUEEN, ROOK], [QUEEN, KNIGHT], [ROOK, ROOK], [QUEEN, BISHOP], [ROOK, KNIGHT, BISHOP]], blackExtras: 2, whitePawns: 2 },
  mega: { attackers: [[QUEEN, ROOK, KNIGHT], [QUEEN, ROOK, BISHOP], [ROOK, ROOK, BISHOP], [QUEEN, KNIGHT, BISHOP]], blackExtras: 3, whitePawns: 3 },
};

/** A random, legal, white-to-move position with black's king tucked near an edge. */
export function samplePosition(rng: Rng, r: Recipe): Position | null {
  const b = new Int8Array(64);
  const free = (sq: number) => !b[sq];
  const place = (pc: number, squares: number[]) => {
    const opts = squares.filter(free);
    if (!opts.length) return -1;
    const sq = rng.pick(opts);
    b[sq] = pc;
    return sq;
  };
  const all = Array.from({ length: 64 }, (_, i) => i);
  const edge = all.filter((s) => rowOf(s) === 0 || colOf(s) === 0 || colOf(s) === 7);
  const back = all.filter((s) => rowOf(s) <= 1);
  const bk = rng.chance(0.65) ? place(KING | 8, all.filter((s) => rowOf(s) === 0)) : place(KING | 8, edge);
  const kr = rowOf(bk), kc = colOf(bk);
  // pawn shield in front of the king
  for (const dc of [-1, 0, 1]) {
    const c = kc + dc;
    if (c < 0 || c > 7 || kr + 1 > 6 || !rng.chance(0.6)) continue;
    const rr = kr + 1 + (rng.chance(0.25) ? 1 : 0);
    if (rr <= 6 && free(rr * 8 + c)) b[rr * 8 + c] = PAWN | 8;
  }
  const extras = rng.int(0, r.blackExtras);
  for (let i = 0; i < extras; i++) {
    const t = rng.pick([PAWN, PAWN, ROOK, BISHOP, KNIGHT, QUEEN]);
    place(t | 8, t === PAWN ? all.filter((s) => rowOf(s) >= 1 && rowOf(s) <= 5) : rng.chance(0.6) ? back : all);
  }
  const wk = place(KING, all.filter((s) => rowOf(s) >= 5 && Math.max(Math.abs(rowOf(s) - kr), Math.abs(colOf(s) - kc)) > 2));
  if (wk < 0) return null;
  for (const t of rng.pick(r.attackers)) place(t, all.filter((s) => rowOf(s) >= 1));
  const pawns = rng.int(0, r.whitePawns);
  for (let i = 0; i < pawns; i++) place(PAWN, all.filter((s) => rowOf(s) >= 1 && rowOf(s) <= 6));
  const pos: Position = { b, turn: WHITE, castle: 0, ep: -1, half: 0, full: 1 };
  if (inCheck(pos, BLACK) || inCheck(pos, WHITE)) return null;
  if (kingSquare(b, WHITE) < 0 || kingSquare(b, BLACK) < 0) return null;
  return pos;
}

/** Exact proof: mate in n, none shorter, exactly one first move. */
export function isPuzzle(pos: Position, n: number): Move | null {
  if (n > 1 && mateIn(pos, n - 1)) return null;
  const firsts = matingMoves(pos, n);
  return firsts.length === 1 ? firsts[0] : null;
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<ChessPuzzle, ChessSolution> {
  const n = MATE_FOR[difficulty];
  const recipe = RECIPES[difficulty];
  for (let attempt = 0; attempt < 60000; attempt++) {
    const pos = samplePosition(rng, recipe);
    if (!pos) continue;
    // Cheap filter first: checks-only below the root, with a node budget. Proofs below are exact.
    if (n > 1 && !mateIn(pos, n, { checksOnly: n > 2, budget: { n: 40000 } })) continue;
    const first = isPuzzle(pos, n);
    if (!first) continue;
    const after = make(pos, first);
    if (recipe.quietFirst && (inCheck(after) || isCapture(pos, first))) continue;
    // Skip puzzles that open with a promotion or a capture of the queen: too obvious.
    if (first.promo || typeOf(pos.b[first.to]) === QUEEN) continue;
    const puzzle: ChessPuzzle = { fen: toFen(pos), mateIn: n };
    const line = solveLine(puzzle)!;
    return { puzzle, solution: { line }, grade: grade(puzzle, line) };
  }
  throw new Error(`chess: could not generate a mate in ${n}`);
}

/* ---------------- Verification ---------------- */

function wellFormed(state: unknown): state is ChessState {
  const s = state as ChessState;
  return !!s && Array.isArray(s.moves) && s.moves.length <= 8 && s.moves.every((m) => typeof m === "string");
}

export function verify(p: ChessPuzzle, sol: ChessSolution, state: ChessState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  if (!state.moves.length) return { ok: false, progress: 0, reason: "no moves" };
  if (state.moves[0] !== sol.line[0]) return { ok: false, progress: 0, reason: "wrong first move" };
  const r = replay(p, state.moves);
  const progress = r.good / p.mateIn;
  if (r.illegal) return { ok: false, progress, reason: "illegal move" };
  if (r.wrongAt >= 0) return { ok: false, progress, reason: "move does not keep the mate" };
  if (!r.mated) return { ok: false, progress, reason: "incomplete" };
  return { ok: true, progress: 1 };
}

export function progress(p: ChessPuzzle, _sol: ChessSolution, state: ChessState): number {
  if (!wellFormed(state)) return 0;
  const r = replay(p, state.moves);
  return r.mated ? 1 : r.good / p.mateIn;
}

const NAMES = ["", "pawn", "knight", "bishop", "rook", "queen", "king"];

export function hint(p: ChessPuzzle, sol: ChessSolution, state: ChessState): Hint | null {
  const moves = wellFormed(state) ? state.moves : [];
  const r = replay(p, moves);
  if (r.mated) return null;
  if (r.illegal || r.wrongAt >= 0) return { target: null, text: "Undo that move. It lets the king out." };
  const left = p.mateIn - r.good;
  const m = r.good === 0 ? fromUci(r.pos, sol.line[0]) : matingMoves(r.pos, left)[0];
  if (!m) return null;
  const pc = r.pos.b[m.from];
  const after = make(r.pos, m);
  const why = inCheck(after) ? "Every check counts." : "A quiet move first. Take away the squares.";
  return { target: { from: sqName(m.from) }, text: `Try the ${NAMES[typeOf(pc)]} on ${sqName(m.from)}. ${why}` };
}

const logic: GameLogic<ChessPuzzle, ChessSolution, ChessState> = {
  id: "chess",
  generate,
  countSolutions,
  verify,
  progress,
  hint,
};
export default logic;

