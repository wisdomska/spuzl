/**
 * A small game-tree search shared by the "Play vs bot" opponents: minimax with alpha-beta pruning and
 * iterative deepening under a wall-clock budget, so the Hard bot answers in time on a slow phone
 * (it simply searches less deep there). Pure: no React, no DOM.
 *
 * Works for games where a side can move twice in a row (Flip passes, Oware never does): every node
 * asks whose turn it is and maximises for the bot's seat, minimises for the other.
 */
import type { Rng } from "@/lib/rng";

export interface SearchGame<P, M> {
  /** seat to move */
  toMove(p: P): number;
  /** game over before generating moves (a four, a draw rule): winner seat, or null for a draw */
  terminal(p: P): { winner: number | null } | null;
  /** legal moves for the side to move, best guesses first */
  moves(p: P): M[];
  /** result when the side to move has no legal move */
  stuck(p: P): { winner: number | null };
  play(p: P, m: M): P;
  /** static score from `seat`'s point of view; keep it well under WIN */
  evaluate(p: P, seat: number): number;
  /** optional captures-only moves for a quiescence search at the horizon (chess, draughts) */
  tactical?(p: P): M[];
}

export const WIN = 1_000_000;

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

class Timeout extends Error {}

export interface SearchOptions {
  /** wall-clock budget in ms for the whole search */
  budgetMs: number;
  maxDepth: number;
  rng: Rng;
  /** quiescence depth when the game has tactical moves */
  qDepth?: number;
}

export interface SearchResult<M> {
  move: M;
  score: number;
  /** deepest depth fully searched */
  depth: number;
}

/** Best move for `seat` (which must be to move). Always returns a legal move when one exists. */
export function searchBest<P, M>(g: SearchGame<P, M>, root: P, seat: number, o: SearchOptions): SearchResult<M> {
  const deadline = now() + o.budgetMs;
  const qDepth = o.qDepth ?? 0;
  // Shuffle first so equal moves vary from game to game, then let the game's own ordering lead.
  const rootMoves = g.moves(root);
  if (!rootMoves.length) throw new Error("no legal moves");
  const order = rootMoves.map((m, i) => ({ m, k: i + o.rng.next() * 0.9 })).sort((a, b) => a.k - b.k);
  let ordered = order.map((x) => x.m);
  let best: SearchResult<M> = { move: ordered[0], score: 0, depth: 0 };
  if (ordered.length === 1) return best;
  let nodes = 0;

  const tick = () => {
    if ((++nodes & 31) === 0 && now() > deadline) throw new Timeout();
  };

  const quiesce = (p: P, alpha: number, beta: number, depth: number, ply: number): number => {
    tick();
    const t = g.terminal(p);
    if (t) return t.winner === null ? 0 : t.winner === seat ? WIN - ply : -WIN + ply;
    const stand = g.evaluate(p, seat);
    if (depth <= 0 || !g.tactical) return stand;
    const caps = g.tactical(p);
    if (!caps.length) return stand;
    const max = g.toMove(p) === seat;
    if (max) {
      if (stand >= beta) return stand;
      let a = Math.max(alpha, stand);
      let v = stand;
      for (const m of caps) {
        v = Math.max(v, quiesce(g.play(p, m), a, beta, depth - 1, ply + 1));
        a = Math.max(a, v);
        if (a >= beta) break;
      }
      return v;
    }
    if (stand <= alpha) return stand;
    let b = Math.min(beta, stand);
    let v = stand;
    for (const m of caps) {
      v = Math.min(v, quiesce(g.play(p, m), alpha, b, depth - 1, ply + 1));
      b = Math.min(b, v);
      if (alpha >= b) break;
    }
    return v;
  };

  const ab = (p: P, depth: number, alpha: number, beta: number, ply: number): number => {
    tick();
    const t = g.terminal(p);
    if (t) return t.winner === null ? 0 : t.winner === seat ? WIN - ply : -WIN + ply;
    if (depth <= 0) return qDepth && g.tactical ? quiesce(p, alpha, beta, qDepth, ply) : g.evaluate(p, seat);
    const ms = g.moves(p);
    if (!ms.length) {
      const s = g.stuck(p);
      return s.winner === null ? 0 : s.winner === seat ? WIN - ply : -WIN + ply;
    }
    const max = g.toMove(p) === seat;
    let v = max ? -Infinity : Infinity;
    for (const m of ms) {
      const c = ab(g.play(p, m), depth - 1, alpha, beta, ply + 1);
      if (max) {
        if (c > v) v = c;
        if (v > alpha) alpha = v;
      } else {
        if (c < v) v = c;
        if (v < beta) beta = v;
      }
      if (alpha >= beta) break;
    }
    return v;
  };

  for (let depth = 1; depth <= o.maxDepth; depth++) {
    try {
      let alpha = -Infinity;
      let bestHere: M = ordered[0];
      const scores = new Map<M, number>();
      for (const m of ordered) {
        const c = ab(g.play(root, m), depth - 1, alpha, Infinity, 1);
        scores.set(m, c);
        if (c > alpha) {
          alpha = c;
          bestHere = m;
        }
      }
      best = { move: bestHere, score: alpha, depth };
      // Best first next time round; stop early once a forced result is known.
      ordered = [bestHere, ...ordered.filter((m) => m !== bestHere)];
      if (Math.abs(alpha) >= WIN - 1000) break;
    } catch (e) {
      if (e instanceof Timeout) break;
      throw e;
    }
    if (now() > deadline) break;
  }
  return best;
}

/** One-ply greedy choice: the move whose resulting position evaluates best for `seat`. */
export function greedy<P, M>(g: SearchGame<P, M>, root: P, seat: number, rng: Rng, noise = 0): M {
  const ms = g.moves(root);
  if (!ms.length) throw new Error("no legal moves");
  let best = ms[0],
    bestV = -Infinity;
  for (const m of ms) {
    const p = g.play(root, m);
    const t = g.terminal(p);
    const v = t ? (t.winner === null ? 0 : t.winner === seat ? WIN : -WIN) : g.evaluate(p, seat) + rng.next() * noise;
    if (v > bestV) {
      bestV = v;
      best = m;
    }
  }
  return best;
}
