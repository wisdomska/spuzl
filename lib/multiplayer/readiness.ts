/**
 * R3-01: Party Start readiness. The host's Start needs everyone present ready; "Start without them" starts with only
 * the ready players, and the server seats the rest as spectators for that set (they watch, and come back in on Run
 * it back). Pure, shared by the lobby (what the host sees) and the start endpoint (the authority).
 */
import { PARTY_MIN } from "./constants";

export interface Seat {
  id: string;
  nickname: string;
  ready: boolean;
  left?: boolean;
  spectator?: boolean;
}

export interface Readiness<T extends Seat = Seat> {
  /** racers in the room: present, not spectating */
  racers: T[];
  ready: T[];
  /** present racers not ready yet, in seat order */
  waiting: T[];
  /** enough racers and every one of them ready: Start is open */
  all: boolean;
  /** some are not ready, but enough are: the host may start with only the ready ones */
  canStartWithout: boolean;
}

export function readiness<T extends Seat>(players: T[]): Readiness<T> {
  const racers = players.filter((p) => !p.left && !p.spectator);
  const ready = racers.filter((p) => p.ready);
  const waiting = racers.filter((p) => !p.ready);
  return {
    racers,
    ready,
    waiting,
    all: racers.length >= PARTY_MIN && waiting.length === 0,
    canStartWithout: waiting.length > 0 && ready.length >= PARTY_MIN,
  };
}

/** A compact list of names: the first `max` names, then how many more. */
export function shortNames(names: string[], max = 3): { shown: string[]; more: number } {
  return { shown: names.slice(0, max), more: Math.max(0, names.length - max) };
}
