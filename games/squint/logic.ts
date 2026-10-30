/**
 * Squint: spot the differences between two procedurally drawn scenes. A scene is a list of objects
 * placed in non-overlapping slots; picture B is picture A with seeded changes (recolour, remove, add,
 * move, resize, variant). The answer is the set of changed object ids; verify checks set equality.
 */
import type { Difficulty, GameLogic, Generated, Hint, VerifyResult } from "@/games/types";
import type { Rng } from "@/lib/rng";

export type Kind = "sun" | "cloud" | "bird" | "kite" | "balloon" | "house" | "tree" | "flower";
export interface Obj {
  id: string;
  kind: Kind;
  /** top-left in scene units */
  x: number;
  y: number;
  /** scale */
  s: number;
  color: string;
  /** kind-specific variant: house windows, tree shape, flower petals */
  v: number;
}
export interface Scene {
  sky: string;
  ground: string;
  hills: { x: number; w: number; h: number; color: string }[];
  objs: Obj[];
}
export interface SquintPuzzle {
  w: number;
  h: number;
  a: Scene;
  b: Scene;
}
/** ids of the changed objects, sorted */
export type SquintSolution = string[];
export interface SquintState {
  found: string[];
  misses: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const W = 300;
export const H = 200;
export const HORIZON = 120;
/** minimum hit box side in scene units (about 44 px on a phone) */
export const MIN_HIT = 38;

/** Unscaled size of each kind. */
export const SIZE: Record<Kind, [number, number]> = {
  sun: [30, 30],
  cloud: [46, 20],
  bird: [24, 10],
  kite: [18, 36],
  balloon: [18, 32],
  house: [40, 42],
  tree: [28, 46],
  flower: [14, 24],
};
const SKY_KINDS: Kind[] = ["cloud", "bird", "kite", "balloon"];
const GROUND_KINDS: Kind[] = ["house", "tree", "flower", "tree", "flower", "house"];
const VARIANTS: Record<Kind, number> = { sun: 1, cloud: 1, bird: 1, kite: 1, balloon: 1, house: 3, tree: 2, flower: 3 };

/** Illustration palette (art colours, not UI tokens). Pairs are [bold, subtle shift]. */
const COLORS = ["#FF6B6B", "#FFD23F", "#3DDC84", "#4D8BFF", "#8B7CFF", "#F27ADB", "#FF8A3D", "#2FD3E0"];
const SUBTLE: Record<string, string> = {
  "#FF6B6B": "#FF8F7A", "#FFD23F": "#FFE680", "#3DDC84": "#6BE3A2", "#4D8BFF": "#7AA7FF",
  "#8B7CFF": "#A99CFF", "#F27ADB": "#F59BE3", "#FF8A3D": "#FFA766", "#2FD3E0": "#6BE0EA",
};

export function bbox(o: Obj): Box {
  const [w, h] = SIZE[o.kind];
  return { x: o.x, y: o.y, w: w * o.s, h: h * o.s };
}

const pad = (b: Box, p: number): Box => ({ x: b.x - p, y: b.y - p, w: b.w + p * 2, h: b.h + p * 2 });
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

/** Hit box for a difference: both versions together, grown to a comfortable tap size. */
export function regionOf(p: SquintPuzzle, id: string): Box {
  const a = p.a.objs.find((o) => o.id === id), b = p.b.objs.find((o) => o.id === id);
  const box = a && b ? union(bbox(a), bbox(b)) : bbox((a ?? b)!);
  const gx = Math.max(0, (MIN_HIT - box.w) / 2), gy = Math.max(0, (MIN_HIT - box.h) / 2);
  return { x: box.x - gx - 4, y: box.y - gy - 4, w: box.w + gx * 2 + 8, h: box.h + gy * 2 + 8 };
}

/** Changed object ids, computed from the two scenes. */
export function differences(p: SquintPuzzle): string[] {
  const key = (o: Obj) => JSON.stringify(o);
  const ids = new Set([...p.a.objs.map((o) => o.id), ...p.b.objs.map((o) => o.id)]);
  return [...ids]
    .filter((id) => {
      const a = p.a.objs.find((o) => o.id === id), b = p.b.objs.find((o) => o.id === id);
      return !a || !b || key(a) !== key(b);
    })
    .sort();
}

/** The difference under a tap (scene units), if any. */
export function hitTest(p: SquintPuzzle, x: number, y: number, ignore: string[] = []): string | null {
  for (const id of differences(p)) {
    if (ignore.includes(id)) continue;
    const r = regionOf(p, id);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
  }
  return null;
}

/* ---------------- Generator ---------------- */

interface Spec {
  diffs: number;
  objs: number;
  subtle: number;
}
export const SPEC: Record<Difficulty, Spec> = {
  easy: { diffs: 3, objs: 12, subtle: 0 },
  medium: { diffs: 4, objs: 14, subtle: 0.25 },
  hard: { diffs: 5, objs: 16, subtle: 0.5 },
  expert: { diffs: 6, objs: 18, subtle: 0.75 },
  mega: { diffs: 7, objs: 19, subtle: 0.75 },
};

function place(rng: Rng, kind: Kind, taken: Box[], id: string): Obj | null {
  for (let t = 0; t < 40; t++) {
    const s = kind === "sun" ? 1 : Math.round((0.85 + rng.next() * 0.4) * 100) / 100;
    const [w, h] = SIZE[kind];
    const sky = SKY_KINDS.includes(kind) || kind === "sun";
    const x = rng.int(4, Math.floor(W - w * s - 4));
    const y = sky ? rng.int(6, Math.floor(HORIZON - 20 - h * s)) : rng.int(HORIZON + 4, Math.floor(H - h * s - 4));
    const o: Obj = { id, kind, x, y, s, color: rng.pick(COLORS), v: rng.int(0, VARIANTS[kind] - 1) };
    const b = pad(bbox(o), 6);
    if (taken.some((k) => overlap(k, b))) continue;
    taken.push(b);
    return o;
  }
  return null;
}

type Change = "color" | "remove" | "add" | "move" | "size" | "variant";

function changesFor(o: Obj): Change[] {
  const out: Change[] = ["color", "remove"];
  if (o.kind === "cloud" || o.kind === "bird" || o.kind === "balloon" || o.kind === "kite") out.push("move");
  if (o.kind === "sun" || o.kind === "cloud" || o.kind === "tree" || o.kind === "house") out.push("size");
  if (VARIANTS[o.kind] > 1) out.push("variant");
  return out;
}

/** 0..100 from difference count, subtlety and clutter. */
export function grade(p: SquintPuzzle): number {
  const d = differences(p).length;
  const subtle = p.b.objs.filter((o) => {
    const a = p.a.objs.find((x) => x.id === o.id);
    return a && SUBTLE[a.color] === o.color;
  }).length;
  return Math.max(0, Math.min(100, Math.round(d * 9 + subtle * 6 + p.a.objs.length * 1.5)));
}

export function generate(rng: Rng, difficulty: Difficulty): Generated<SquintPuzzle, SquintSolution> {
  const spec = SPEC[difficulty];
  for (let attempt = 0; attempt < 100; attempt++) {
    const taken: Box[] = [];
    const objs: Obj[] = [];
    const sun = place(rng, "sun", taken, "o0");
    if (sun) objs.push(sun);
    for (let k = 1; objs.length < spec.objs && k < spec.objs * 4; k++) {
      const kind = k % 3 === 0 ? rng.pick(SKY_KINDS) : rng.pick(GROUND_KINDS);
      const o = place(rng, kind, taken, `o${k}`);
      if (o) objs.push(o);
    }
    if (objs.length < spec.objs) continue;
    const a: Scene = {
      sky: rng.pick(["#BDE3FF", "#CFE8FF", "#FFE3C2", "#E4DCFF"]),
      ground: rng.pick(["#7BD88F", "#9BDB7A", "#6FCF97"]),
      hills: Array.from({ length: 3 }, (_, k) => ({ x: rng.int(-40, 260), w: rng.int(110, 170), h: rng.int(28, 50), color: ["#5DBB73", "#4FA866", "#70C985"][k] })),
      objs,
    };
    const b: Scene = { ...a, hills: a.hills.map((x) => ({ ...x })), objs: objs.map((o) => ({ ...o })) };
    // pick changes on objects far apart, so every region is its own spot
    const order = rng.shuffle(objs.map((o) => o.id));
    const chosen: Box[] = [];
    let made = 0;
    let addN = 0;
    for (const id of order) {
      if (made >= spec.diffs) break;
      const i = b.objs.findIndex((o) => o.id === id);
      const o = b.objs[i];
      const region = pad(bbox(o), 10);
      if (chosen.some((c) => overlap(c, region))) continue;
      const change = rng.pick(changesFor(o));
      if (change === "color") {
        const subtle = rng.chance(spec.subtle);
        o.color = subtle ? SUBTLE[o.color] : rng.pick(COLORS.filter((c) => c !== o.color && SUBTLE[o.color] !== c));
      } else if (change === "remove") b.objs.splice(i, 1);
      else if (change === "move") o.x = Math.min(W - bbox(o).w - 2, Math.max(2, o.x + (rng.chance(0.5) ? 1 : -1) * rng.int(14, 22)));
      else if (change === "size") o.s = Math.round(o.s * (rng.chance(0.5) ? 1.3 : 0.72) * 100) / 100;
      else o.v = (o.v + 1 + rng.int(0, VARIANTS[o.kind] - 2)) % VARIANTS[o.kind];
      chosen.push(pad(union(bbox(objs.find((x) => x.id === id)!), bbox(o)), 10));
      made++;
      // occasionally add a new object to B instead, in a free spot
      if (made < spec.diffs && rng.chance(0.25)) {
        const extra = place(rng, rng.pick(["flower", "bird", "balloon"] as Kind[]), [...taken, ...chosen], `n${addN++}`);
        if (extra) {
          b.objs.push(extra);
          chosen.push(pad(bbox(extra), 10));
          made++;
        }
      }
    }
    if (made !== spec.diffs) continue;
    const puzzle: SquintPuzzle = { w: W, h: H, a, b };
    const solution = differences(puzzle);
    if (solution.length !== spec.diffs) continue;
    // regions must not overlap so one tap never claims two differences
    const regions = solution.map((id) => regionOf(puzzle, id));
    if (regions.some((r, i) => regions.some((q, j) => j > i && overlap(r, q)))) continue;
    return { puzzle, solution, grade: grade(puzzle) };
  }
  throw new Error(`squint: could not generate a ${difficulty} scene`);
}

/* ---------------- Verification ---------------- */

function wellFormed(state: unknown): state is SquintState {
  if (!state || typeof state !== "object") return false;
  const s = state as SquintState;
  return Array.isArray(s.found) && s.found.every((x) => typeof x === "string") && Number.isInteger(s.misses) && s.misses >= 0;
}

/** Share of differences found. Wrong ids subtract, so guessing ids never helps. */
export function progress(_p: SquintPuzzle, sol: SquintSolution, state: SquintState): number {
  if (!wellFormed(state)) return 0;
  const found = new Set(state.found);
  const good = sol.filter((id) => found.has(id)).length;
  const bad = [...found].filter((id) => !sol.includes(id)).length;
  return Math.max(0, (good - bad) / sol.length);
}

export function verify(p: SquintPuzzle, sol: SquintSolution, state: SquintState): VerifyResult {
  if (!wellFormed(state)) return { ok: false, progress: 0, reason: "malformed state" };
  const found = new Set(state.found);
  const equal = found.size === sol.length && sol.every((id) => found.has(id)) && state.found.length === found.size;
  // the scenes themselves must still produce this answer (guards a tampered solution)
  const truth = differences(p);
  const consistent = truth.length === sol.length && truth.every((id, i) => id === sol[i]);
  if (!consistent) return { ok: false, progress: 0, reason: "answer does not match the scenes" };
  return equal ? { ok: true, progress: 1 } : { ok: false, progress: progress(p, sol, state), reason: "differences do not match" };
}

export function hint(p: SquintPuzzle, sol: SquintSolution, state: SquintState | undefined): Hint | null {
  // before the first move the shell has no state yet: hint from the empty board
  if (state === undefined) state = { found: [], misses: 0 };
  if (!wellFormed(state)) return null;
  const next = sol.find((id) => !state.found.includes(id));
  if (!next) return null;
  const r = regionOf(p, next);
  const where = `${r.y + r.h / 2 < H / 3 ? "top" : r.y + r.h / 2 > (H * 2) / 3 ? "bottom" : "middle"} ${r.x + r.w / 2 < W / 3 ? "left" : r.x + r.w / 2 > (W * 2) / 3 ? "right" : "centre"}`;
  return { target: r, text: `Look closely at the ${where}.` };
}

const logic: GameLogic<SquintPuzzle, SquintSolution, SquintState> = {
  id: "squint",
  generate,
  verify,
  progress,
  hint,
};
export default logic;
