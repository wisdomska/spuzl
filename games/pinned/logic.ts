/**
 * Pinned: read a landmark's name and description, drop a pin where it is. Five rounds a day: four on
 * the world map and one on the Africa map. Each round scores 1000 * exp(-distance / scale), so a pin
 * on the spot earns 1000 and the score fades smoothly with great-circle distance.
 */
import type { ContentLogic, Difficulty, Generated, Hint, VerifyResult } from "@/games/types";
import { createRng, type Rng } from "@/lib/rng";
import { puzzleKey, rotation, seal } from "@/games/_shared/cluecave";
import { CONTENT, type Landmark } from "./content";
import { VIEWS } from "./geo";

export const ROUNDS = 5;
export const AFRICA_PER_DAY = 1;
export const DAYS = 60;
export const EARTH_KM = 6371;

export type LatLon = [number, number];

export interface PinnedRound {
  name: string;
  line: string;
  map: "world" | "africa";
}
export interface PinnedPuzzle {
  ref: string;
  rounds: PinnedRound[];
  /** sealed true positions, for the reveal after each pin */
  sealed: string;
}
export interface PinnedSolution {
  spots: LatLon[];
}
export interface PinnedState {
  /** [lat, lon] per round, null when the player gave up on it */
  pins: (LatLon | null)[];
}

export const sealKey = (ref: string) => puzzleKey("pinned", ref);

/** Great-circle distance in km (haversine). */
export function distanceKm([lat1, lon1]: LatLon, [lat2, lon2]: LatLon) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function pointsFor(km: number, map: PinnedRound["map"]) {
  return Math.round(1000 * Math.exp(-km / VIEWS[map].scaleKm));
}

const POOLS = {
  africa: CONTENT.filter((l) => l.map === "africa"),
  world: CONTENT.filter((l) => l.map === "world"),
};

function build(items: Landmark[], ref: string, grade: number): Generated<PinnedPuzzle, PinnedSolution> {
  const spots = items.map((l) => [l.lat, l.lon] as LatLon);
  return {
    puzzle: { ref, rounds: items.map((l) => ({ name: l.name, line: l.line, map: l.map })), sealed: seal(spots, sealKey(ref)) },
    solution: { spots },
    grade,
  };
}

/** Far from the big landmass centres and on the world map is harder; small places on the Africa map are easier to find. */
export function gradeOf(items: Landmark[]) {
  const world = items.filter((l) => l.map === "world").length;
  const south = items.filter((l) => l.lat < 0).length;
  return Math.min(100, 20 + world * 10 + south * 5);
}

export const contentCount = DAYS;

export function generateAt(index: number): Generated<PinnedPuzzle, PinnedSolution> {
  const africa = rotation(POOLS.africa.length, AFRICA_PER_DAY, index, "pinned:africa").map((i) => POOLS.africa[i]);
  const world = rotation(POOLS.world.length, ROUNDS - AFRICA_PER_DAY, index, "pinned:world").map((i) => POOLS.world[i]);
  const items = createRng(`pinned-order:${index}`).shuffle([...world, ...africa]);
  return build(items, `d${index}`, gradeOf(items));
}

/** Free play: easy days lean on the Africa map, expert days are all world rounds. */
export function generate(rng: Rng, difficulty: Difficulty): Generated<PinnedPuzzle, PinnedSolution> {
  const africaCount = { easy: 3, medium: 2, hard: 1, expert: 0, mega: 1 }[difficulty];
  const items = rng.shuffle([...rng.shuffle(POOLS.africa.slice()).slice(0, africaCount), ...rng.shuffle(POOLS.world.slice()).slice(0, ROUNDS - africaCount)]);
  return build(items, `f${rng.int(0, 1e9)}`, gradeOf(items));
}

function badPin(pin: unknown, map: PinnedRound["map"]): boolean {
  if (pin === null) return false;
  if (!Array.isArray(pin) || pin.length !== 2 || !pin.every((x) => typeof x === "number" && Number.isFinite(x))) return true;
  const v = VIEWS[map];
  const [lat, lon] = pin as LatLon;
  return lat < v.south || lat > v.north || lon < v.west || lon > v.east;
}

export function score(p: PinnedPuzzle, sol: PinnedSolution, pins: (LatLon | null)[]) {
  return pins.reduce((a, pin, i) => a + (pin ? pointsFor(distanceKm(pin, sol.spots[i]), p.rounds[i].map) : 0), 0);
}

export function verify(p: PinnedPuzzle, sol: PinnedSolution, state: PinnedState): VerifyResult {
  if (!state || !Array.isArray(state.pins) || state.pins.length > p.rounds.length) return { ok: false, progress: 0, reason: "malformed state" };
  if (state.pins.some((pin, i) => badPin(pin, p.rounds[i].map))) return { ok: false, progress: 0, reason: "pin off the map" };
  const progress = state.pins.length / p.rounds.length;
  if (state.pins.length < p.rounds.length) return { ok: false, progress, reason: "rounds left" };
  return { ok: true, progress: 1, score: score(p, sol, state.pins) };
}

export function progress(p: PinnedPuzzle, _sol: PinnedSolution, state: PinnedState): number {
  return Array.isArray(state?.pins) ? Math.min(state.pins.length, p.rounds.length) / p.rounds.length : 0;
}

/** A box around the spot (40 degrees on the world map, 16 on Africa), offset at random so its centre is not the answer. */
export function hint(p: PinnedPuzzle, sol: PinnedSolution, state: PinnedState): Hint | null {
  const i = Array.isArray(state?.pins) ? state.pins.length : 0;
  if (i >= p.rounds.length) return null;
  const v = VIEWS[p.rounds[i].map];
  const size = v.id === "world" ? 40 : 16;
  const rng = createRng(`pinned-hint:${p.ref}:${i}`);
  const [lat, lon] = sol.spots[i];
  const south = Math.max(v.south, Math.min(v.north - size, lat - size * (0.2 + 0.6 * rng.next())));
  const west = Math.max(v.west, Math.min(v.east - size, lon - size * (0.2 + 0.6 * rng.next())));
  return { target: { question: i, box: [south, west, south + size, west + size] }, text: "It is somewhere inside the box." };
}

const logic: ContentLogic<PinnedPuzzle, PinnedSolution, PinnedState> = {
  id: "pinned",
  contentCount,
  generateAt,
  generate,
  verify,
  progress,
  hint,
};
export default logic;
