/** Wire types shared by the multiplayer API and its screens. Times are epoch ms on the server clock. */

export interface MatchPlayerView {
  id: string;
  nickname: string;
  color: string;
  level: number;
  country: string | null;
  city: string | null;
  rating: number;
  seat: number;
  ready: boolean;
  roundsWon: number;
  points: number;
  progress: number;
  mistakes: number;
  finishedMs: number | null;
  place: number | null;
  host: boolean;
  spectator: boolean;
  left: boolean;
  /** no heartbeat for a while: shown as disconnected */
  stale: boolean;
  rematch: boolean;
  ratingBefore: number | null;
  ratingAfter: number | null;
}

export interface MatchRoundView {
  round: number;
  playerId: string;
  gameId: string | null;
  timeMs: number | null;
  mistakes: number;
  place: number | null;
  points: number;
  won: boolean;
}

export interface MatchView {
  id: string;
  kind: "duel" | "race";
  status: "queue" | "lobby" | "countdown" | "playing" | "round_end" | "finished" | "abandoned";
  code: string | null;
  hostId: string | null;
  round: number;
  bestOf: number;
  setNo: number;
  /** the room's chosen game, null for a random mix */
  gameId: string | null;
  games: string[];
  /** party: the host's hand-picked games, each set races PARTY_GAMES of them (empty: gameId or a random mix) */
  chosenGames: string[];
  difficulty: string;
  mix: boolean;
  classroom: boolean;
  maxPlayers: number;
  rated: boolean;
  isBot: boolean;
  roundStartedAt: number | null;
  roundFirstAt: number | null;
  pausedAt: number | null;
  pauseMs: number;
  winnerId: string | null;
  result: string | null;
  rematchId: string | null;
  emptiedAt: number | null;
  serverNow: number;
  me: string;
  players: MatchPlayerView[];
  rounds: MatchRoundView[];
  bot: { name: string; roundsWon: number; finishMs: number | null; times: number[] } | null;
  /** the current round's puzzle, only once its countdown has begun */
  puzzle: { round: number; game: string; data: unknown } | null;
  /** before a ranked round's countdown: the players its game is new to (a rules break), else null */
  rulesFor?: string[] | null;
  /** your saved board for this round (reconnect) */
  myState: unknown;
  /** rewards for you once the match is over */
  reward: { xp: number; sparks: number } | null;
}

/** Realtime events the server sends on match:<id> */
export type ServerEvent =
  | { type: "progress"; player: string; progress: number; mistakes: number; round: number }
  | { type: "finish"; player: string; timeMs: number; round: number }
  | { type: "changed"; reason: string };

export interface BayPlayerView {
  id: string;
  nickname: string;
  color: string;
  rating: number;
  seat: number;
}

export interface BayView {
  id: string;
  game: string;
  mode: "live" | "async";
  status: "waiting" | "active" | "finished" | "abandoned";
  seats: number;
  rated: boolean;
  bot: boolean;
  ply: number;
  turn: number;
  state: unknown;
  players: BayPlayerView[];
  mySeat: number | null;
  inviteCode: string | null;
  clockMs: number[] | null;
  turnStartedAt: number | null;
  moveDeadline: number | null;
  nudgedAt: number | null;
  drawOffer: number | null;
  takebackOffer: number | null;
  result: string | null;
  winnerId: string | null;
  rematchId: string | null;
  moves: { ply: number; seat: number; move: unknown }[];
  serverNow: number;
}
