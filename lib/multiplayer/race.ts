/**
 * Party Race rules (2 to 8). Everyone gets the same puzzle; places by verified finish time, then
 * fewer slips; players who don't finish rank by progress. Points add up over the set (3 games).
 */
import { TIMING } from "./constants";

export interface Racer {
  id: string;
  /** server finish time, null when not finished */
  timeMs: number | null;
  mistakes: number;
  progress: number;
  /** left the room or lost connection for good */
  gone?: boolean;
  /** sat this round out ("Skip this round"): 0 points, placed last, and the round doesn't wait for them */
  passed?: boolean;
}

export interface Placed extends Racer {
  place: number;
  points: number;
}

/** Live order for the rail: finishers by time, then everyone else by progress. */
export function raceOrder<T extends Racer>(racers: T[]): T[] {
  return [...racers].sort((a, b) => {
    if (a.timeMs !== null && b.timeMs !== null) return a.timeMs - b.timeMs || a.mistakes - b.mistakes || a.id.localeCompare(b.id);
    if (a.timeMs !== null) return -1;
    if (b.timeMs !== null) return 1;
    if (!!a.passed !== !!b.passed) return a.passed ? 1 : -1;
    if (!!a.gone !== !!b.gone) return a.gone ? 1 : -1;
    return b.progress - a.progress || a.mistakes - b.mistakes || a.id.localeCompare(b.id);
  });
}

/**
 * Points for one game: finishers get 500 + 100 per player beaten + a speed bonus (up to 300 for
 * finishing within 5 minutes); non-finishers get up to 300 for progress; a player who skipped the round gets 0.
 */
export function racePoints(r: Racer, place: number, n: number): number {
  if (r.passed && r.timeMs === null) return 0;
  if (r.timeMs === null) return Math.round(Math.max(0, Math.min(1, r.progress)) * 300);
  const speed = Math.max(0, 300 - Math.floor(r.timeMs / 1000));
  return 500 + 100 * (n - place) + speed;
}

export function placeRace(racers: Racer[]): Placed[] {
  const order = raceOrder(racers);
  return order.map((r, i) => ({ ...r, place: i + 1, points: racePoints(r, i + 1, order.length) }));
}

/** The game ends when every racer still here has finished, 90 s after the first finish, or at the cap. */
export function raceOver(racers: Racer[], startedAt: number, firstFinishAt: number | null, now: number): boolean {
  const here = racers.filter((r) => !r.gone && !r.passed);
  if (here.length && here.every((r) => r.timeMs !== null)) return true;
  if (!here.length) return true;
  if (firstFinishAt !== null && now - firstFinishAt >= TIMING.raceAfterFirstMs) return true;
  return now - startedAt >= TIMING.raceCapMs;
}

/**
 * Party results in rank order (podium, lists, TV board): most points first, then the server's place, then a stable
 * id order, the same tie-break the server uses when it places the set. Index 0 is first place.
 */
export function standingOrder<T extends { id: string; points: number; place: number | null }>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => b.points - a.points || (a.place ?? Infinity) - (b.place ?? Infinity) || a.id.localeCompare(b.id));
}

/** Who overtook whom between two orders (ids). Returns pairs [passer, passed] involving `me`. */
export function overtakes(before: string[], after: string[], me: string): { passer: string; passed: string }[] {
  const out: { passer: string; passed: string }[] = [];
  const b = new Map(before.map((id, i) => [id, i]));
  const a = new Map(after.map((id, i) => [id, i]));
  if (!b.has(me) || !a.has(me)) return out;
  for (const id of after) {
    if (id === me || !b.has(id)) continue;
    const wasAhead = b.get(id)! < b.get(me)!;
    const isAhead = a.get(id)! < a.get(me)!;
    if (!wasAhead && isAhead) out.push({ passer: id, passed: me });
    if (wasAhead && !isAhead) out.push({ passer: me, passed: id });
  }
  return out;
}

/** New host when the host leaves: the earliest joiner still in the room, players before spectators. */
export function nextHost(members: { id: string; joinedAt: number; gone?: boolean; spectator?: boolean }[], leaving: string): string | null {
  const left = members.filter((m) => m.id !== leaving && !m.gone);
  left.sort((a, b) => Number(!!a.spectator) - Number(!!b.spectator) || a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));
  return left[0]?.id ?? null;
}

export type PartyPhase = "lobby" | "countdown" | "race" | "podium" | "final";

export function partyPhase(m: { status: string; roundStartedAt: number | null }, now: number): PartyPhase {
  if (m.status === "lobby") return "lobby";
  if (m.status === "finished") return "final";
  if (m.status === "round_end") return "podium";
  if (m.roundStartedAt !== null && now < m.roundStartedAt) return "countdown";
  return "race";
}
