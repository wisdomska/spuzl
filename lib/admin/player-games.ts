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
  /** everyone seated (the bot as BOT_ID) */
  players?: string[];
}

/** The bot's seat in Board Bay matches. */
export const BOT_ID = "00000000-0000-0000-0000-000000000000";

/** Who the player played: the bot (with its level when known) or the people at the table, by name. */
export type Against = { kind: "bot"; level: string | null } | { kind: "people"; players: { id: string; nickname: string }[] };

/** The ids of the people a match was played against (not the player, not the bot). */
export const opponentIds = (r: BoardMatchRow, playerId: string) => (r.players ?? []).filter((p) => p !== playerId && p !== BOT_ID);

/** A finished game against the bot from /play/<game>/bot (bot_games). */
export interface BotGameRow {
  id: string;
  game_id: string;
  level: string;
  outcome: string;
  duration_ms: number | null;
  created_at: string;
}

/** Results that end a game level (as BayScreen reads them): with no winner and one of these, nobody lost. */
const DRAWS = ["draw", "agreed draw", "stalemate", "insufficient material", "fifty-move rule", "threefold repetition"];

/**
 * One row of the player's recent Board Games, from their side: the outcome once finished (a bot win has no winner id,
 * so a bot match with no winner that is not a draw is a loss, as on the player's own game-over card), and the house
 * rules.
 */
export function boardGameRow(r: BoardMatchRow, playerId: string, names: Record<string, string> = {}) {
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
    against: (r.bot
      ? { kind: "bot", level: null }
      : { kind: "people", players: opponentIds(r, playerId).map((id) => ({ id, nickname: names[id] ?? "?" })) }) as Against,
    durationMs: null as number | null,
    created_at: r.created_at,
  };
}

/** A game from /play/<game>/bot in the same shape, so both kinds sit in one list. */
export function botGameRow(r: BotGameRow): ReturnType<typeof boardGameRow> {
  return {
    id: r.id,
    game_id: r.game_id,
    mode: "bot",
    status: "finished",
    result: null,
    outcome: r.outcome,
    rated: false,
    bot: true,
    house: null,
    against: { kind: "bot", level: r.level },
    durationMs: r.duration_ms,
    created_at: r.created_at,
  };
}

/** Board Bay matches and games against the bot, newest first. */
export function mergeBoardGames(
  matches: readonly BoardMatchRow[],
  bots: readonly BotGameRow[],
  playerId: string,
  names: Record<string, string>,
  limit = 40,
) {
  return [...matches.map((m) => boardGameRow(m, playerId, names)), ...bots.map(botGameRow)]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/** A Duel or Party round's reference ("<match id>:<set>:<round>") as a short label: first 8 of the id, set and round. */
export function roundRef(ref: string): string {
  const [match, set, round] = ref.split(":");
  if (!match || set === undefined || round === undefined) return ref.slice(0, 16);
  return `${match.slice(0, 8)} · set ${set} · round ${round}`;
}

/* ---------- One games table (owner, 13 Nov 2026): puzzles and board games together, filtered and sorted. ---------- */

/** How a game ended, from the player's side, for both kinds. */
export type GameResult = "won" | "lost" | "draw" | "solved" | "not_solved" | "suspicious" | "left" | "playing" | "waiting";
export const GAME_RESULTS: readonly GameResult[] = [
  "won",
  "solved",
  "lost",
  "not_solved",
  "draw",
  "left",
  "playing",
  "waiting",
  "suspicious",
];

export interface AttemptRow {
  id: string;
  game_id: string;
  mode: string;
  status: string;
  time_ms: number | null;
  started_at: string;
}

export interface GameRow {
  id: string;
  game_id: string;
  /** a puzzle attempt or a board game (Board Bay or the bot) */
  kind: "puzzle" | "board";
  mode: string;
  rated: boolean;
  against: Against | null;
  house: LudoHouseRule[] | null;
  result: GameResult;
  timeMs: number | null;
  started: string;
}

const ATTEMPT_RESULT: Record<string, GameResult> = {
  cleared: "solved",
  failed: "not_solved",
  flagged: "suspicious",
  abandoned: "left",
  in_progress: "playing",
};
const BOARD_RESULT: Record<string, GameResult> = { active: "playing", waiting: "waiting", abandoned: "left", finished: "draw" };

/** Puzzle attempts and board games in one list, newest first. */
export function allGames(attempts: readonly AttemptRow[], boards: readonly ReturnType<typeof boardGameRow>[]): GameRow[] {
  const rows: GameRow[] = [
    ...attempts.map((a) => ({
      id: a.id,
      game_id: a.game_id,
      kind: "puzzle" as const,
      mode: a.mode,
      rated: false,
      against: null,
      house: null,
      result: ATTEMPT_RESULT[a.status] ?? "playing",
      timeMs: a.time_ms,
      started: a.started_at,
    })),
    ...boards.map((b) => ({
      id: b.id,
      game_id: b.game_id,
      kind: "board" as const,
      mode: b.mode,
      rated: b.rated,
      against: b.against,
      house: b.house,
      result: ((b.outcome as GameResult | null) ?? BOARD_RESULT[b.status] ?? "playing") as GameResult,
      timeMs: b.durationMs,
      started: b.created_at,
    })),
  ];
  return rows.sort((a, b) => b.started.localeCompare(a.started));
}

export interface GameFilter {
  /** a game type (world id), or null for all */
  type: string | null;
  /** particular games, or null for every game of the type */
  games: readonly string[] | null;
  result: GameResult | null;
}
export const NO_GAME_FILTER: GameFilter = { type: null, games: null, result: null };

export function filterGames(rows: readonly GameRow[], f: GameFilter, typeOf: (game: string) => string): GameRow[] {
  return rows.filter(
    (r) => (!f.type || typeOf(r.game_id) === f.type) && (!f.games || f.games.includes(r.game_id)) && (!f.result || r.result === f.result),
  );
}

export type GameSortKey = "game" | "type" | "result" | "time" | "started";
export const GAME_SORT = {
  keys: ["game", "type", "result", "time", "started"],
  default: "started",
  dir: "desc",
  firstDir: { time: "asc", started: "desc" },
} as const;

/** Sorted copy. Ties keep newest first; games with no time sort last either way. */
export function sortGames(
  rows: readonly GameRow[],
  s: { sort: GameSortKey; dir: "asc" | "desc" },
  nameOf: (game: string) => string,
  typeOf: (game: string) => string,
): GameRow[] {
  const sign = s.dir === "asc" ? 1 : -1;
  const rank = (r: GameRow) => GAME_RESULTS.indexOf(r.result);
  const cmp = (a: GameRow, b: GameRow): number => {
    switch (s.sort) {
      case "game":
        return sign * nameOf(a.game_id).localeCompare(nameOf(b.game_id));
      case "type":
        return sign * typeOf(a.game_id).localeCompare(typeOf(b.game_id));
      case "result":
        return sign * (rank(a) - rank(b));
      case "time":
        if (a.timeMs === null || b.timeMs === null) return a.timeMs === b.timeMs ? 0 : a.timeMs === null ? 1 : -1;
        return sign * (a.timeMs - b.timeMs);
      default:
        return sign * a.started.localeCompare(b.started);
    }
  };
  return [...rows].sort((a, b) => cmp(a, b) || b.started.localeCompare(a.started));
}
