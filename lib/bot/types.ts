import type { BoardGameRules } from "@/games/types";
import type { Rng } from "@/lib/rng";
import { greedy, searchBest, type SearchGame } from "./search";

export const BOT_LEVELS = ["easy", "medium", "hard"] as const;
export type BotLevel = (typeof BOT_LEVELS)[number];
export const isBotLevel = (v: unknown): v is BotLevel => typeof v === "string" && (BOT_LEVELS as readonly string[]).includes(v);

/** Hard bot thinking budget: well under the 300 ms target even on a slow phone (search depth adapts). */
export const HARD_BUDGET_MS = 220;

export interface Bot<S, M> {
  rules: BoardGameRules<S, M>;
  /** A legal move for `seat` (which must be to move) at this level. Throws when there is none. */
  choose(state: S, seat: number, level: BotLevel, rng: Rng, budgetMs?: number): M;
}

/**
 * Builds a bot from the match rules and a search adapter:
 * - easy: half the time any legal move, otherwise the best-looking move one ply ahead (with noise);
 * - medium: the existing Practice bot from the rules (greedy, one to two plies);
 * - hard: alpha-beta over the adapter with iterative deepening inside the time budget.
 */
export function makeBot<S, M, P, N>(
  rules: BoardGameRules<S, M>,
  game: SearchGame<P, N>,
  bridge: { toPos(s: S): P; toMove(n: N, s: S): M; maxDepth: number; qDepth?: number },
): Bot<S, M> {
  return {
    rules,
    choose(state, seat, level, rng, budgetMs = HARD_BUDGET_MS) {
      const legal = rules.legalMoves(state, seat);
      if (!legal.length) throw new Error("no legal moves");
      if (level === "medium" && rules.botMove) return rules.botMove(state, seat, rng);
      const pos = bridge.toPos(state);
      if (level === "easy") {
        if (rng.chance(0.5)) return rng.pick(legal);
        return bridge.toMove(greedy(game, pos, seat, rng, 2), state);
      }
      const r = searchBest(game, pos, seat, { budgetMs, maxDepth: bridge.maxDepth, rng, qDepth: bridge.qDepth });
      return bridge.toMove(r.move, state);
    },
  };
}
