/**
 * Mate search over the full-rules generator in engine.ts. Proves "mate in N" exactly:
 * every defence is searched, so a forced mate is forced, and uniqueness counts every first move.
 */
import { inCheck, legalMoves, make, isCapture, type Move, type Position } from "./engine";

export interface MateOptions {
  /** Only consider checking attacker moves below the root (fast candidate filter). Never used for proofs. */
  checksOnly?: boolean;
  /** Node budget; the search reports "no mate" once exhausted (only used by the generator filter). */
  budget?: { n: number };
}

/** Can the side to move force mate within `n` of its own moves? */
export function mateIn(p: Position, n: number, o: MateOptions = {}, root = true): boolean {
  if (n <= 0) return false;
  for (const m of legalMoves(p)) {
    if (o.budget && --o.budget.n < 0) return false;
    const after = make(p, m);
    const check = inCheck(after);
    if ((n === 1 || (o.checksOnly && !root)) && !check) continue;
    if (defenderLost(after, n - 1, o, check)) return true;
  }
  return false;
}

/**
 * Defender to move: is it mate now, or does every reply leave the attacker a mate within `k`?
 * Stalemate is never a loss.
 */
export function defenderLost(p: Position, k: number, o: MateOptions = {}, check = inCheck(p)): boolean {
  const replies = legalMoves(p);
  if (!replies.length) return check;
  if (k <= 0) return false;
  // Captures and king moves first: they refute most false tries quickest.
  replies.sort((a, b) => score(p, b) - score(p, a));
  for (const r of replies) if (!mateIn(make(p, r), k, o, false)) return false;
  return true;
}

function score(p: Position, m: Move) {
  return (isCapture(p, m) ? 2 : 0) + ((p.b[m.from] & 7) === 6 ? 1 : 0);
}

/** Smallest n <= max with a forced mate, or 0 when there is none. */
export function mateDistance(p: Position, max: number): number {
  for (let n = 1; n <= max; n++) if (mateIn(p, n)) return n;
  return 0;
}

/** All first moves that force mate within n (full width, exact). */
export function matingMoves(p: Position, n: number, o: MateOptions = {}): Move[] {
  const out: Move[] = [];
  for (const m of legalMoves(p)) {
    const after = make(p, m);
    const check = inCheck(after);
    if (n === 1 && !check) continue;
    if (defenderLost(after, n - 1, o, check)) out.push(m);
  }
  return out;
}

/**
 * Defender's reply in a lost position: the one that delays mate longest (prototype puzzles reply
 * "naturally"); ties go to captures, then generation order. Deterministic on client and server.
 */
export function bestDefence(p: Position, k: number): Move | null {
  const replies = legalMoves(p);
  if (!replies.length) return null;
  let best: Move | null = null,
    bestD = -1,
    bestCap = false;
  for (const r of replies) {
    const after = make(p, r);
    let d = mateDistance(after, k);
    if (d === 0) d = k + 1; // escapes (only in a position that is not actually lost)
    const cap = isCapture(p, r);
    if (d > bestD || (d === bestD && cap && !bestCap)) {
      best = r;
      bestD = d;
      bestCap = cap;
    }
  }
  return best;
}
