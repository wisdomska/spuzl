/** Wire types shared by the multiplayer API and its screens. Times are epoch ms on the server clock. */
import type { PartyMode } from "@/lib/party-adult/modes";
import type { Stroke } from "@/lib/party-adult/strokes";

export interface MatchPlayerView {
  id: string;
  nickname: string;
  color: string;
  /** R3-15: the Shop hat they wear (a public cosmetic, like the colour), null for none */
  hat?: string | null;
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
  /** sat out the current Party round ("Skip this round") */
  passed: boolean;
  /** R3-01: the host started this set without them (spectating until Run it back) */
  satOut?: boolean;
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
  /** R3-08: a score race round's points, from the server (null for time races) */
  score?: number | null;
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
  /** Party: the host lets anyone with the code watch the big-screen view (/party/<code>/tv) */
  tvOpen?: boolean;
  maxPlayers: number;
  rated: boolean;
  isBot: boolean;
  roundStartedAt: number | null;
  /** the 3-2-1-SPUZL! countdown's length in ms (admin setting party.countdownSeconds), as the server schedules it */
  countdownMs?: number;
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
  /** Duels with a person: your all-time record against them (this duel included once it's over); null otherwise */
  h2h?: { me: number; them: number; draws: number; played: number } | null;
  /** Party mode: "race" (puzzles), an 18+ party game ("draw", "truths") or Draw It for 16+ ("drawfam", R2-P5) */
  mode: PartyMode;
  /** the current 18+ party round as you may see it; null in races and outside a round */
  party: AdultRoundView | null;
}

/**
 * One Draw It or Two Truths round as one player sees it. The server leaves out what they mustn't see: the
 * word is only sent to the drawer until the reveal, the lie only to its writer, and picks only at the reveal.
 */
export interface AdultRoundView {
  mode: "draw" | "truths";
  round: number;
  rounds: number;
  phase: "write" | "play" | "reveal" | "done";
  leadId: string | null;
  startedAt: number;
  endsAt: number;
  /** Draw It: the secret word (drawer while drawing, everyone at the reveal) */
  word: string | null;
  /** Draw It: letters per word, for the blanks */
  shape: number[] | null;
  strokes: Stroke[];
  /** Draw It guesses, oldest first. text is null for correct guesses and once the round closes. */
  guesses: { id: number; playerId: string; text: string | null; correct: boolean }[];
  /** Two Truths statements (writer always; everyone once voting opens) */
  statements: string[] | null;
  /** the lie's index (writer always; everyone at the reveal) */
  lie: number | null;
  /** Two Truths: this player's vote; 16+ Draw It: their pick from `options` */
  myPick: number | null;
  /** 16+ Draw It (R2-P5): the four preset words guessers pick from; null in 18+ rooms (typed guesses) */
  options: string[] | null;
  /** who has voted; picks only at the reveal */
  voters: string[];
  votes: { playerId: string; pick: number }[] | null;
  /** points this round, at the reveal */
  awards: Record<string, number> | null;
  /** Two Truths: the writer ran out of time or left */
  skipped: boolean;
  iCorrect: boolean;
  /** Draw It: the drawer's pass for the live ink relay while drawing (R4-24); null for everyone else */
  inkPass?: string | null;
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
  /** R3-15: the Shop hat they wear, null for none (and for the bot) */
  hat?: string | null;
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
  /** live: each player's starting time (the time control); null for async */
  clockBaseMs: number | null;
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

/** Where a friend's code leads (POST /api/v1/codes): a Duel waiting for its rival, a Party room, a Board Games invite. */
export type CodeTarget = { kind: "duel"; code: string } | { kind: "party"; code: string } | { kind: "bay"; id: string; code: string };

/** What a friend is invited into (POST /api/v1/game-invites). */
export type InviteKind = "duel" | "party" | "bay";
