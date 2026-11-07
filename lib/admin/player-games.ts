/**
 * Player detail (R2-ADMIN): a player's recent Board Games and the rank moves from Duels and Parties, shaped for the
 * admin page. Pure and free of server imports, so the API and the tests share it.
 */

/** Ludo house rules in the order the setup sheet lists them (components/multiplayer/bay/LudoSetup.tsx). */
export const LUDO_HOUSE_RULES = ["backKick", "sideKick", "homeKick"] as const;
export type LudoHouseRule = (typeof LUDO_HOUSE_RULES)[number];

/**
 * The house rules a match was played with: for Ludo, the rules switched on in its state's `opts` ([] = standard);
 * null for every other game (no house rules to show).
 */
export function houseRulesOf(game: string, opts: unknown): LudoHouseRule[] | null {
  if (game !== "ludo") return null;
  if (!opts || typeof opts !== "object") return [];
  const o = opts as Record<string, unknown>;
  return LUDO_HOUSE_RULES.filter((k) => o[k] === true);
}

export interface BoardMatchRow {
  id: string;
  game_id: string;
  mode: string;
  status: string;
  result: string | null;
  winner_id: string | null;
  rated: boolean;
  bot: boolean;
  created_at: string;
  opts?: unknown;
}

/** Results that end a game level (as BayScreen reads them): with no winner and one of these, nobody lost. */
const DRAWS = ["draw", "agreed draw", "stalemate", "insufficient material", "fifty-move rule", "threefold repetition"];

/**
 * One row of the player's recent Board Games, from their side: the outcome once finished (a bot win has no winner id,
 * so a bot match with no winner that is not a draw is a loss, as on the player's own game-over card), and the house
 * rules.
 */
export function boardGameRow(r: BoardMatchRow, playerId: string) {
  const botWon = r.bot && !r.winner_id && !DRAWS.includes(r.result ?? "draw");
  const outcome = r.status !== "finished" ? null : r.winner_id === playerId ? "won" : r.winner_id || botWon ? "lost" : "draw";
  return {
    id: r.id,
    game_id: r.game_id,
    mode: r.mode,
    status: r.status,
    result: r.result,
    outcome,
    rated: r.rated,
    bot: r.bot,
    house: houseRulesOf(r.game_id, r.opts),
    created_at: r.created_at,
  };
}

/** A Duel or Party round's reference ("<match id>:<set>:<round>") as a short label: first 8 of the id, set and round. */
export function roundRef(ref: string): string {
  const [match, set, round] = ref.split(":");
  if (!match || set === undefined || round === undefined) return ref.slice(0, 16);
  return `${match.slice(0, 8)} · set ${set} · round ${round}`;
}
