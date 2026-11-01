/**
 * Duel rules (SRS 6): both players get the same new puzzle, first verified clear takes the round,
 * best of 3. Finishes in the same tenth of a second are a tie: fewer slips takes it, otherwise the
 * round is a draw (Overlays M4 "Draw. 2:04.3 each"). Pure functions shared by server and tests.
 */
import { DUEL_ROUNDS, DUEL_TO_WIN, TIMING } from "./constants";

export const BOT_ID = "bot";

export interface Finisher {
  id: string;
  timeMs: number;
  mistakes: number;
}

export interface RoundOutcome {
  /** winner id, or null for a drawn round */
  winner: string | null;
  /** same tenth of a second */
  tie: boolean;
  /** losing margin in ms (0 on a tie) */
  margin: number;
}

/** Decides a round from the verified finishes (any order). Needs at least one finisher. */
export function resolveRound(finishers: Finisher[]): RoundOutcome {
  if (!finishers.length) throw new Error("no finishers");
  const sorted = [...finishers].sort((a, b) => a.timeMs - b.timeMs || a.mistakes - b.mistakes || a.id.localeCompare(b.id));
  const [first, second] = sorted;
  if (!second) return { winner: first.id, tie: false, margin: 0 };
  const sameTenth = Math.floor(first.timeMs / TIMING.tieMs) === Math.floor(second.timeMs / TIMING.tieMs);
  if (!sameTenth) return { winner: first.id, tie: false, margin: second.timeMs - first.timeMs };
  if (first.mistakes !== second.mistakes) {
    const w = first.mistakes < second.mistakes ? first : second;
    return { winner: w.id, tie: true, margin: 0 };
  }
  return { winner: null, tie: true, margin: 0 };
}

export interface Score {
  [id: string]: number;
}

export interface MatchProgress {
  over: boolean;
  /** match winner id, null when drawn or still running */
  winner: string | null;
  draw: boolean;
}

/** Best of 3: first to 2. After round 3, the higher score wins, an equal score is a draw. */
export function matchState(score: Score, roundsPlayed: number): MatchProgress {
  const ids = Object.keys(score);
  const top = ids.find((id) => score[id] >= DUEL_TO_WIN);
  if (top) return { over: true, winner: top, draw: false };
  if (roundsPlayed < DUEL_ROUNDS) return { over: false, winner: null, draw: false };
  const sorted = [...ids].sort((a, b) => score[b] - score[a]);
  if (sorted.length > 1 && score[sorted[0]] === score[sorted[1]]) return { over: true, winner: null, draw: true };
  return { over: true, winner: sorted[0] ?? null, draw: false };
}

/** When the next round's puzzle unlocks: round end screen, then the countdown. */
export function nextRoundStart(now: number, roundEndMs: number = TIMING.roundEndMs): number {
  return now + roundEndMs + TIMING.countdownMs;
}

/**
 * Ranked Quick Match games (SPZ-12): a random mix only uses games both players have cleared, or failing
 * that either of them, so nobody meets a game for the first time with rating on the line when it can be
 * helped. When it can't (two brand-new players), that round starts with a rules break.
 */
export function rankedPool(known: Map<string, Set<string>>): string[] | undefined {
  const sets = [...known.values()];
  const both = [...(sets[0] ?? [])].filter((g) => sets.every((s) => s.has(g)));
  if (both.length) return both;
  const either = [...new Set(sets.flatMap((s) => [...s]))];
  return either.length ? either : undefined;
}

/**
 * The players for whom a round's game is new: never cleared by them. A ranked round of a game
 * that is new to anyone starts after a rules break (`rulesBreakMs`), the same for both players.
 */
export function newToGame(game: string | null | undefined, players: readonly string[], known: Map<string, Set<string>>): string[] {
  if (!game) return [];
  return players.filter((p) => !known.get(p)?.has(game));
}

export const rulesBreakMs = (newTo: readonly string[]): number => (newTo.length ? TIMING.rulesMs : 0);

/**
 * Before a round with a rules break: the round's rules card takes the last `rulesMs` before the countdown,
 * after the versus intro or the round end card. `msToStart` is the time to the round's start.
 */
export function inRulesBreak(msToStart: number): boolean {
  const toCountdown = msToStart - TIMING.countdownMs;
  return toCountdown > 0 && toCountdown <= TIMING.rulesMs;
}

export type RoundSide = "me" | "them" | "draw";

/**
 * Who took each finished round, read from the server's round rows (SPZ-03). A tie gives both players
 * place 1 and no point, so the listed rounds always add up to the score.
 */
export function roundOutcomes(
  rows: { round: number; playerId: string; won: boolean; place: number | null }[],
  meId: string,
  themId: string | null,
  roundsDone: number,
  isBot: boolean,
): RoundSide[] {
  const out: RoundSide[] = [];
  for (let r = 1; r <= roundsDone; r++) {
    const mine = rows.find((x) => x.round === r && x.playerId === meId);
    const theirs = themId ? rows.find((x) => x.round === r && x.playerId === themId) : undefined;
    if (!mine && !theirs) continue;
    if (mine?.won) out.push("me");
    else if (theirs?.won) out.push("them");
    else if (mine?.place === 1) out.push("draw");
    else out.push(isBot ? "them" : "draw");
  }
  return out;
}
export function firstRoundStart(now: number): number {
  return now + TIMING.versusMs + TIMING.countdownMs;
}

export type DuelPhase = "versus" | "round_end" | "countdown" | "playing" | "paused" | "match_end";

/** Client phase from the server's match row and the synced clock. */
export function duelPhase(m: { status: string; round: number; roundStartedAt: number; pausedAt?: number | null }, now: number): DuelPhase {
  if (m.status === "finished" || m.status === "abandoned") return "match_end";
  const toStart = m.roundStartedAt - now;
  if (toStart > TIMING.countdownMs) return m.round === 1 ? "versus" : "round_end";
  if (toStart > 0) return "countdown";
  return m.pausedAt ? "paused" : "playing";
}

/** Countdown label for the time left: "3", "2", "1", then "SPUZL!" (prototype: 800 ms beats, SPUZL! held). */
export function countdownBeat(msToStart: number): { label: string; beat: number } {
  const elapsed = TIMING.countdownMs - msToStart;
  const beat = Math.max(0, Math.floor(elapsed / TIMING.beatMs));
  if (beat >= 3) return { label: "SPUZL!", beat: 3 };
  return { label: String(3 - beat), beat };
}

/**
 * Practice bot finish times per round, in ms. Steady but beatable, a little slower in round 2
 * (prototype speeds 6, 9, 7). `r` is a 0..1 random number per round.
 */
export function botTimes(baseMs: number, r: number[]): number[] {
  const speed = [1, 0.8, 0.95];
  return speed.map((s, i) => Math.round((baseMs / s) * (0.85 + 0.3 * (r[i] ?? 0.5))));
}

/** Bot progress shown on the strip: a gentle curve that reaches 1 at its finish time. */
export function botProgress(elapsedMs: number, finishMs: number): number {
  if (elapsedMs <= 0) return 0;
  const t = Math.min(1, elapsedMs / finishMs);
  return Math.round(Math.min(0.99, t < 1 ? 1 - Math.pow(1 - t, 1.6) : 1) * 1000) / 1000;
}
