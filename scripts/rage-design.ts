/**
 * Rage Ridge level designer (offline tooling, never imported by the app).
 *
 * Builds the level ladders for Gotcha, Dash and Gauntlet: a seeded procedural designer strings together
 * obstacle and troll "chunks" whose size, count and timing grow with a difficulty tier (1..10), proves every
 * candidate beatable with the beam-search bot over the real fixed-step sim (phaser/sim/solver.ts), rejects
 * anything unfair, and orders the survivors (plus the hand-designed rooms and set pieces) into one ladder.
 *
 * Usage: pnpm tsx scripts/rage-design.ts <gotcha|dash|gauntlet|all>
 * Writes games/<id>/levels.generated.ts (generated rooms and the ladder order) and adds the bot's input
 * script for every new level to games/<id>/solutions.json. Re-running with the same code gives the same
 * files (seeded by `design:<game>:<tier>:<n>`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRng, type Rng } from "@/lib/rng";
import { compileLevel, type LevelDef, type PlatformDef, type TrapDef, type TriggerDef } from "@/phaser/sim/level";
import { BTN, logFromFrames, scriptFromLog } from "@/phaser/sim/input";
import { PlatformerCourse, type PlatformerConfig } from "@/phaser/sim/platformer";
import { solvePlatformer } from "@/phaser/sim/solver";
import { curate } from "@/lib/game/rage-variety";

type GameId = "gotcha" | "dash" | "gauntlet";

const H = 9;
const BASE_GY = 6;

/* ---------------- Room builder ---------------- */

class Room {
  readonly grid: string[][];
  x = 0;
  /** walking row: the runner's feet rest on row gy + 1 */
  gy = BASE_GY;
  traps: Record<string, TrapDef> = {};
  triggers: TriggerDef[] = [];
  platforms: PlatformDef[] = [];
  private nextTrap = 1;
  hazards = 0;

  constructor(maxW = 240) {
    this.grid = Array.from({ length: H }, () => Array<string>(maxW).fill("."));
  }

  set(x: number, y: number, ch: string) {
    if (y < 0 || y >= H || x < 0 || x >= this.grid[0].length) return;
    this.grid[y][x] = ch;
  }

  get(x: number, y: number) {
    return this.grid[y]?.[x] ?? "#";
  }

  /** Solid ground under the walking row for one column. */
  ground(x: number, gy = this.gy) {
    for (let y = gy + 1; y < H; y++) this.set(x, y, "#");
  }

  trapsLeft() {
    return 10 - this.nextTrap;
  }

  trap(def: TrapDef): string {
    if (this.nextTrap > 9) throw new Error("trap budget");
    const id = String(this.nextTrap++);
    this.traps[id] = def;
    return id;
  }

  trigger(x: number, y: number, w: number, h: number, fire: string[]) {
    this.triggers.push({ zone: [x, Math.max(0, y), w, h], fire });
  }

  flat(n: number) {
    for (let i = 0; i < n; i++) this.ground(this.x++);
  }

  def(id: string, name: string): LevelDef {
    const w = this.x;
    const tiles = this.grid.map((r) => r.slice(0, w).join(""));
    const d: LevelDef = { id, name, tiles };
    if (Object.keys(this.traps).length) d.traps = this.traps;
    if (this.triggers.length) d.triggers = this.triggers;
    if (this.platforms.length) d.platforms = this.platforms;
    return d;
  }
}

/* ---------------- Tier knobs ---------------- */

const lerp = (a: number, b: number, t: number) => Math.round(a + (b - a) * t);
/** 0 at tier 1, 1 at tier 10 */
const k = (tier: number) => (tier - 1) / 9;

/* ---------------- Dash chunks (auto-runner, fixed jump, walls kill) ---------------- */

type Chunk = (r: Room, rng: Rng, tier: number) => void;

const dashChunks: { w: number; min: number; f: Chunk }[] = [
  {
    w: 3,
    min: 1,
    f: (r, rng, tier) => {
      const n = Math.min(3, rng.int(1, tier < 3 ? 2 : 3));
      for (let i = 0; i < n; i++) {
        r.ground(r.x);
        r.set(r.x++, r.gy, "^");
      }
      r.hazards += n;
    },
  },
  {
    w: 3,
    min: 1,
    f: (r, rng, tier) => {
      const n = rng.int(2, tier < 4 ? 2 : 3);
      r.x += n;
      r.hazards += n;
    },
  },
  {
    w: 2,
    min: 1,
    f: (r, rng, tier) => {
      const h = tier >= 3 && rng.chance(0.4) ? 2 : 1;
      const wdt = rng.int(1, 2);
      for (let i = 0; i < wdt; i++) {
        r.ground(r.x);
        for (let y = r.gy - h + 1; y <= r.gy; y++) r.set(r.x, y, "#");
        r.x++;
      }
      r.hazards += h;
    },
  },
  {
    // step up one or two rows
    w: 2,
    min: 2,
    f: (r, rng) => {
      if (r.gy <= 4) return dashStepDown(r, rng);
      r.gy -= rng.int(1, r.gy - 4 >= 2 ? 2 : 1);
      r.hazards++;
    },
  },
  { w: 2, min: 2, f: (r, rng) => dashStepDown(r, rng) },
  {
    // low roof: ceiling spikes punish a jump
    w: 1,
    min: 3,
    f: (r, rng, tier) => {
      const n = rng.int(4, lerp(6, 10, k(tier)));
      for (let i = 0; i < n; i++) {
        r.ground(r.x);
        for (let y = 0; y < r.gy - 1; y++) r.set(r.x, y, "#");
        r.set(r.x, r.gy - 1, "v");
        r.x++;
      }
      r.hazards += 2;
    },
  },
  {
    // islands: a wide pit with floating slabs
    w: 2,
    min: 4,
    f: (r, rng, tier) => {
      const islands = rng.int(1, tier >= 7 ? 3 : 2);
      for (let i = 0; i < islands; i++) {
        const gap = rng.int(2, 3);
        r.x += gap;
        const lift = rng.int(0, 1);
        const len = rng.int(2, 3);
        for (let j = 0; j < len; j++) r.set(r.x++, lift ? r.gy : r.gy + 1, "=");
        r.hazards += 2;
      }
      r.x += rng.int(2, 3);
    },
  },
  {
    // spikes, a short landing, spikes again
    w: 2,
    min: 5,
    f: (r, rng, tier) => {
      const a = rng.int(1, 2);
      for (let i = 0; i < a; i++) {
        r.ground(r.x);
        r.set(r.x++, r.gy, "^");
      }
      r.flat(lerp(4, 2, k(tier)));
      const b = rng.int(1, 2);
      for (let i = 0; i < b; i++) {
        r.ground(r.x);
        r.set(r.x++, r.gy, "^");
      }
      r.hazards += a + b + 1;
    },
  },
  {
    // pit straight into a pillar
    w: 2,
    min: 6,
    f: (r, rng, tier) => {
      r.x += 2;
      r.flat(lerp(5, 3, k(tier)));
      r.ground(r.x);
      r.set(r.x++, r.gy, "#");
      r.hazards += 3;
    },
  },
];

function dashStepDown(r: Room, rng: Rng) {
  if (r.gy >= BASE_GY) {
    r.gy = Math.max(4, r.gy - 1);
    r.hazards++;
    return;
  }
  // a drop: the floor falls away one or two rows
  r.gy = Math.min(BASE_GY, r.gy + rng.int(1, 2));
  r.hazards++;
}

function designDash(rng: Rng, tier: number): Room {
  const r = new Room();
  r.flat(1);
  r.set(1, r.gy, "S");
  r.flat(lerp(7, 4, k(tier)));
  const chunks = lerp(4, 16, k(tier));
  const runMin = lerp(6, 3, k(tier)),
    runMax = lerp(10, 5, k(tier));
  let last = -1;
  for (let i = 0; i < chunks; i++) {
    const pool = dashChunks.filter((c, j) => c.min <= tier && j !== last);
    const total = pool.reduce((s, c) => s + c.w, 0);
    let roll = rng.next() * total;
    const c = pool.find((p) => (roll -= p.w) < 0) ?? pool[0];
    last = dashChunks.indexOf(c);
    const gyBefore = r.gy;
    c.f(r, rng, tier);
    // a step makes a wall face: draw it in the column before
    if (r.gy < gyBefore) for (let y = r.gy + 1; y <= gyBefore; y++) r.set(r.x, y, "#");
    r.flat(rng.int(runMin, runMax));
  }
  r.flat(2);
  r.set(r.x, r.gy, "E");
  r.flat(3);
  return r;
}

/* ---------------- Troll chunks (Gotcha and Gauntlet: free run, variable jump) ---------------- */

interface TrollChunk {
  name: string;
  w: number;
  min: number;
  traps: number;
  f: Chunk;
}

const pitBottom = (r: Room, x: number) => r.set(x, H - 1, "^");

const trollChunks: TrollChunk[] = [
  {
    name: "gap",
    w: 3,
    min: 1,
    traps: 0,
    f: (r, rng, tier) => {
      const n = rng.int(2, tier < 4 ? 2 : 3);
      for (let i = 0; i < n; i++) pitBottom(r, r.x++);
      r.hazards += n;
    },
  },
  {
    name: "spikes",
    w: 2,
    min: 1,
    traps: 0,
    f: (r, rng, tier) => {
      const n = rng.int(1, tier < 4 ? 2 : 3);
      for (let i = 0; i < n; i++) {
        r.ground(r.x);
        r.set(r.x++, r.gy, "^");
      }
      r.hazards += n;
    },
  },
  {
    name: "wall",
    w: 2,
    min: 1,
    traps: 0,
    f: (r, rng) => {
      const h = rng.int(1, 2);
      r.ground(r.x);
      for (let y = r.gy - h + 1; y <= r.gy; y++) r.set(r.x, y, "#");
      r.x++;
      r.hazards++;
    },
  },
  {
    name: "step",
    w: 2,
    min: 2,
    traps: 0,
    f: (r, rng) => {
      const before = r.gy;
      if (r.gy > 4 && rng.chance(0.6)) r.gy -= 1;
      else r.gy = Math.min(BASE_GY, r.gy + rng.int(1, 2));
      if (r.gy < before) {
        for (let y = r.gy + 1; y <= before; y++) r.set(r.x, y, "#");
        r.ground(r.x++);
      }
      r.hazards++;
    },
  },
  {
    // the floor lies: it drops a few frames after the runner reaches it
    name: "fake-floor",
    w: 4,
    min: 1,
    traps: 1,
    f: (r, rng, tier) => {
      const n = rng.int(2, tier < 5 ? 2 : 3);
      const id = r.trap({ kind: "drop", delay: lerp(5, 1, k(tier)) });
      const spiky = rng.chance(0.5);
      for (let i = 0; i < n; i++) {
        r.set(r.x + i, r.gy + 1, id);
        if (spiky) {
          r.set(r.x + i, r.gy + 2, "^");
          for (let y = r.gy + 3; y < H; y++) r.set(r.x + i, y, "#");
        } else for (let y = r.gy + 2; y < H; y++) r.set(r.x + i, y, id);
      }
      r.trigger(r.x, 0, n, r.gy + 1, [id]);
      r.x += n;
      r.hazards += n + 1;
    },
  },
  {
    // spikes pop up just past a bump the runner hops over
    name: "pop-up",
    w: 4,
    min: 1,
    traps: 1,
    f: (r, rng, tier) => {
      r.ground(r.x);
      r.set(r.x, r.gy, "#");
      const bump = r.x++;
      r.flat(1);
      const n = rng.int(1, tier < 5 ? 1 : 2);
      const id = r.trap({ kind: "spikes", delay: 0 });
      for (let i = 0; i < n; i++) {
        r.ground(r.x);
        r.set(r.x++, r.gy, id);
      }
      r.trigger(bump, 0, 1, r.gy, [id]);
      r.hazards += n + 1;
    },
  },
  {
    // a long stretch whose spikes pop after a while: hurry, or wait and hop
    name: "hurry",
    w: 2,
    min: 3,
    traps: 1,
    f: (r, rng, tier) => {
      const n = rng.int(4, lerp(6, 9, k(tier)));
      // walking a tile takes 10 frames; the margin shrinks with the tier
      const delay = n * 10 + lerp(60, 20, k(tier));
      const id = r.trap({ kind: "spikes", delay });
      r.trigger(r.x - 1, 0, 1, r.gy + 1, [id]);
      for (let i = 0; i < n; i++) {
        r.ground(r.x);
        r.set(r.x++, r.gy, id);
      }
      r.hazards += 2;
    },
  },
  {
    // a hidden block over a spiky pit bonks a full jump: hop low
    name: "bonk",
    w: 3,
    min: 3,
    traps: 1,
    f: (r) => {
      if (r.gy < 4) return;
      const id = r.trap({ kind: "block", delay: 0 });
      r.trigger(r.x - 2, r.gy - 4, 2, 3, [id]);
      for (let i = 0; i < 2; i++) {
        r.set(r.x, r.gy - 1, id);
        r.set(r.x, H - 1, "^");
        r.x++;
      }
      r.hazards += 3;
    },
  },
  {
    // a crumbling bridge over spikes: every section drops soon after it is touched
    name: "crumble",
    w: 3,
    min: 2,
    traps: 3,
    f: (r, rng, tier) => {
      const sections = Math.min(r.trapsLeft() - 1, rng.int(2, tier < 6 ? 2 : 3));
      if (sections < 1) return;
      const delay = lerp(16, 8, k(tier));
      for (let s = 0; s < sections; s++) {
        const id = r.trap({ kind: "drop", delay });
        r.trigger(r.x, r.gy, 3, 1, [id]);
        for (let i = 0; i < 3; i++) {
          r.set(r.x, r.gy + 1, id);
          r.set(r.x, H - 1, "^");
          r.x++;
        }
      }
      r.hazards += sections * 2;
    },
  },
  {
    // a moving slab over a spike pit
    name: "ferry",
    w: 2,
    min: 4,
    traps: 0,
    f: (r, rng, tier) => {
      const n = rng.int(5, lerp(6, 8, k(tier)));
      const from = r.x;
      for (let i = 0; i < n; i++) r.set(r.x++, H - 1, "^");
      r.platforms.push({ w: 2, from: [from, r.gy + 1], to: [from + n - 2, r.gy + 1], period: lerp(300, 180, k(tier)) * 2 });
      r.hazards += 3;
    },
  },
  {
    // a tunnel with a floor spike: the ceiling grows spikes once the runner is inside, so hop low
    name: "tunnel",
    w: 2,
    min: 5,
    traps: 1,
    f: (r, rng, tier) => {
      if (r.gy < 4) return;
      const n = rng.int(5, lerp(6, 9, k(tier)));
      const id = r.trap({ kind: "spikes", delay: lerp(8, 0, k(tier)) });
      const spikeAt = rng.int(2, n - 3);
      for (let i = 0; i < n; i++) {
        r.ground(r.x);
        for (let y = 0; y < r.gy - 2; y++) r.set(r.x, y, "#");
        r.set(r.x, r.gy - 2, id);
        if (i === spikeAt) r.set(r.x, r.gy, "^");
        r.x++;
      }
      r.trigger(r.x - n, r.gy - 1, 1, 2, [id]);
      r.hazards += 3;
    },
  },
  {
    // a safe-looking pillar top that drops: jump past it
    name: "fake-pillar",
    w: 2,
    min: 4,
    traps: 1,
    f: (r, rng, tier) => {
      r.set(r.x, H - 1, "^");
      r.x++;
      const id = r.trap({ kind: "drop", delay: lerp(4, 1, k(tier)) });
      r.set(r.x, r.gy, id);
      for (let y = r.gy + 1; y < H; y++) r.set(r.x, y, "#");
      r.trigger(r.x, 0, 1, r.gy, [id]);
      r.x++;
      for (let i = 0; i < 2; i++) r.set(r.x++, H - 1, "^");
      r.hazards += 4;
    },
  },
];

/** The exit runs: back behind the runner, up onto a ledge, or across a pit. Ends the room. */
function runningExit(r: Room, rng: Rng, tier: number, startX: number) {
  const style = rng.int(0, tier >= 4 ? 2 : 1);
  r.flat(2);
  const trigX = r.x;
  r.flat(3);
  const ex = r.x;
  r.set(ex, r.gy, "E");
  r.flat(1);
  if (style === 0) {
    // back to the start
    const id = r.trap({ kind: "exit", delay: 0, to: [startX + 2, BASE_GY], frames: lerp(50, 35, k(tier)) });
    r.trigger(trigX, 0, 1, r.gy + 1, [id]);
  } else if (style === 1) {
    // up to a ledge over the end of the room
    const ly = r.gy - 2;
    for (let i = 0; i < 3; i++) r.set(trigX + i, ly + 1, "=");
    const id = r.trap({ kind: "exit", delay: 0, to: [trigX + 1, ly], frames: lerp(40, 30, k(tier)) });
    r.trigger(trigX + 3, 0, 1, r.gy + 1, [id]);
  } else {
    // across a fresh pit
    r.flat(1);
    for (let i = 0; i < 2; i++) pitBottom(r, r.x++);
    r.flat(3);
    const id = r.trap({ kind: "exit", delay: 0, to: [r.x - 2, r.gy], frames: lerp(40, 25, k(tier)) });
    r.trigger(ex - 1, 0, 1, r.gy + 1, [id]);
  }
  r.flat(1);
  r.hazards += 2;
}

function designTroll(rng: Rng, tier: number, game: "gotcha" | "gauntlet"): Room {
  const r = new Room();
  r.flat(1);
  r.set(1, r.gy, "S");
  r.flat(3);
  const startX = 1;
  const chunks = game === "gauntlet" ? lerp(2, 4, k(tier)) : lerp(3, 10, k(tier));
  const runMin = game === "gauntlet" ? 1 : lerp(3, 2, k(tier)),
    runMax = game === "gauntlet" ? 2 : lerp(5, 3, k(tier));
  const trollShare = game === "gauntlet" ? 0.75 : lerp(50, 70, k(tier)) / 100;
  let last = "";
  let trolls = 0;
  for (let i = 0; i < chunks; i++) {
    const wantTroll = rng.chance(trollShare) || (i === chunks - 1 && trolls === 0);
    const pool = trollChunks.filter((c) => c.min <= tier && c.name !== last && c.traps > 0 === wantTroll && c.traps <= r.trapsLeft() - 1);
    if (!pool.length) continue;
    const total = pool.reduce((s, c) => s + c.w, 0);
    let roll = rng.next() * total;
    const c = pool.find((p) => (roll -= p.w) < 0) ?? pool[0];
    last = c.name;
    c.f(r, rng, tier);
    if (c.traps) trolls++;
    r.flat(rng.int(runMin, runMax));
  }
  const exitTroll = game === "gauntlet" ? rng.chance(0.35) : rng.chance(0.3 + 0.03 * tier);
  if (exitTroll && r.trapsLeft() >= 1) runningExit(r, rng, tier, startX);
  else {
    r.flat(2);
    r.set(r.x, r.gy, "E");
    r.flat(2);
  }
  return r;
}

/* ---------------- Names ---------------- */

const ADJ = [
  "Sly",
  "Sneaky",
  "Wobbly",
  "Cheeky",
  "Bouncy",
  "Crafty",
  "Dizzy",
  "Fuzzy",
  "Grumpy",
  "Jolly",
  "Lumpy",
  "Nifty",
  "Prickly",
  "Rusty",
  "Shifty",
  "Snappy",
  "Spiky",
  "Sticky",
  "Tricky",
  "Twisty",
  "Wonky",
  "Zippy",
  "Crooked",
  "Daring",
  "Fickle",
  "Giddy",
  "Hasty",
  "Jumpy",
  "Loopy",
  "Mighty",
  "Nimble",
  "Plucky",
  "Quirky",
  "Rowdy",
  "Scrappy",
  "Sleepy",
  "Swift",
  "Tiny",
  "Topsy",
  "Wiggly",
  "Brave",
  "Clumsy",
  "Dusty",
  "Frosty",
  "Gloomy",
  "Hollow",
  "Lucky",
  "Merry",
  "Noisy",
  "Silent",
];
const NOUN = [
  "Step",
  "Floor",
  "Ledge",
  "Pit",
  "Path",
  "Hop",
  "Leap",
  "Lane",
  "Trail",
  "Bridge",
  "Climb",
  "Drop",
  "Corner",
  "Hall",
  "Run",
  "Dash",
  "Gap",
  "Ridge",
  "Steps",
  "Room",
  "Tunnel",
  "Pass",
  "Walk",
  "Track",
  "Slope",
  "Crossing",
  "Detour",
  "Escape",
  "Hurdle",
  "Shuffle",
  "Sprint",
  "Stroll",
  "Tumble",
  "Twist",
  "Venture",
  "Wander",
  "Bounce",
  "Scramble",
  "Skip",
  "Spring",
  "Stumble",
  "Swerve",
  "Trick",
  "Turn",
  "Vault",
  "Wiggle",
  "Zigzag",
  "Riddle",
  "Puzzle",
  "Fable",
];

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/* ---------------- Verification ---------------- */

const { RIGHT: R, JUMP: J } = BTN;

/** A player who holds right and only jumps at walls: true when they die (the room lies or bites). */
export function naiveDies(level: LevelDef, cfg: PlatformerConfig): boolean {
  const sim = new PlatformerCourse([level], cfg);
  for (let i = 0; i < 1500 && !sim.deaths && !sim.finished; i++) sim.step(cfg.autorun ? 0 : R | (sim.world.body.vx === 0 && i > 5 ? J : 0));
  return sim.deaths > 0;
}

/**
 * Fairness: the room has a runway (no hazard within 3 tiles of the start), the exit stands on solid ground (or
 * runs to a spot that does). Beyond this, every room must be beaten without a death by the bot (so every lie
 * can be dodged once it is known; the renderer telegraphs every trap after the first death) with timing slack a
 * person can hit (see slack()), and Dash rooms must kill a runner who never jumps.
 */
function fair(level: LevelDef): string | null {
  const c = compileLevel(level);
  for (let x = 0; x <= c.start.x + 3; x++)
    for (let y = 0; y < c.h; y++) if ("^v123456789".includes(level.tiles[y][x])) return "hazard at start";
  const floor = (x: number, y: number) => y + 1 < c.h && "#=".includes(level.tiles[y + 1][x]);
  if (!floor(c.exit.x, c.exit.y)) return "exit floats";
  for (const t of c.traps) if (t.kind === "exit" && !floor(t.to![0], t.to![1])) return "exit runs onto air";
  return null;
}

/** Frames a solution survives when one of its jump presses is moved by `d` frames (timing slack). */
function slack(level: LevelDef, cfg: PlatformerConfig, frames: number[]): number {
  const presses: number[] = [];
  for (let i = 0; i < frames.length; i++) if (frames[i] & J && !(i && frames[i - 1] & J)) presses.push(i);
  if (!presses.length) return 1;
  let ok = 0,
    total = 0;
  for (const p of presses)
    for (const d of [-3, -2, 2, 3]) {
      const f = frames.slice();
      // shift the whole press (hold length kept) by d frames
      let end = p;
      while (end < f.length && f[end] & J) end++;
      const len = end - p;
      for (let i = p; i < end; i++) f[i] &= ~J;
      for (let i = p + d; i < p + d + len; i++) if (i >= 0 && i < f.length) f[i] |= J;
      const sim = new PlatformerCourse([level], cfg);
      for (let i = 0; i < f.length && !sim.finished; i++) sim.step(f[i]);
      for (let i = 0; i < 400 && !sim.finished && !sim.deaths; i++) sim.step(f[f.length - 1] & ~J);
      total++;
      if (sim.finished && !sim.deaths) ok++;
    }
  return ok / total;
}

interface Made {
  def: LevelDef;
  tier: number;
  frames: number[];
  /** higher is harder */
  score: number;
}

function solve(def: LevelDef, cfg: PlatformerConfig): number[] | null {
  const lvl = compileLevel(def);
  const budget = Math.min(60 * 120, Math.round(lvl.w * 16 * (cfg.autorun ? 0.8 : 1.6)) + 900);
  // 4-frame moves first; finer 2-frame moves find the short hops a tight room needs
  return (
    solvePlatformer(new PlatformerCourse([lvl], cfg), { maxFrames: budget }) ??
    (cfg.autorun ? null : solvePlatformer(new PlatformerCourse([lvl], cfg), { maxFrames: budget, macro: 2 }))
  );
}

/* ---------------- Ladder ---------------- */

interface GameSpec {
  id: GameId;
  perTier: number;
  design(rng: Rng, tier: number): Room;
  /** max room width */
  maxW: number;
  /** must a no-skill run die in every room (Dash) */
  mustBite: boolean;
  /** must the room hold at least one troll */
  mustTroll: boolean;
}

const SPECS: Record<GameId, GameSpec> = {
  dash: { id: "dash", perTier: 5, design: designDash, maxW: 260, mustBite: true, mustTroll: false },
  gotcha: { id: "gotcha", perTier: 5, design: (rng, t) => designTroll(rng, t, "gotcha"), maxW: 140, mustBite: false, mustTroll: true },
  gauntlet: {
    id: "gauntlet",
    perTier: 5,
    design: (rng, t) => designTroll(rng, t, "gauntlet"),
    maxW: 30,
    mustBite: false,
    mustTroll: true,
  },
};

async function build(spec: GameSpec) {
  const mod = (await import(`@/games/${spec.id}/levels`)) as {
    CONFIG: PlatformerConfig;
    HAND_LEVELS: LevelDef[];
    SET_PIECES: LevelDef[];
  };
  const cfg = mod.CONFIG;
  const solFile = path.resolve(`games/${spec.id}/solutions.json`);
  const solutions: Record<string, [number, number][]> = existsSync(solFile) ? JSON.parse(readFileSync(solFile, "utf8")) : {};
  const taken = new Set([...mod.HAND_LEVELS, ...mod.SET_PIECES].map((l) => l.id));
  const names = new Set([...mod.HAND_LEVELS, ...mod.SET_PIECES].map((l) => l.name));
  const nameRng = createRng(`names:${spec.id}`);
  const nextName = () => {
    for (;;) {
      const n = `${nameRng.pick(ADJ)} ${nameRng.pick(NOUN)}`;
      if (!names.has(n) && !taken.has(slug(n))) {
        names.add(n);
        return n;
      }
    }
  };

  // Set pieces are hand-designed; the bot only proves them.
  for (const l of mod.SET_PIECES) {
    const f = solve(l, cfg);
    if (!f) throw new Error(`${spec.id}: set piece ${l.id} has no solution`);
    solutions[l.id] = scriptFromLog(logFromFrames(f));
    console.log(`${spec.id} set piece ${l.id}: ${f.length} frames, slack ${slack(l, cfg, f).toFixed(2)}`);
  }
  if (process.argv.includes("--set-pieces")) return;

  const made: Made[] = [];
  // no two rooms alike (different seeds can draw the same short room)
  const sig = (l: LevelDef) => JSON.stringify({ ...l, id: "", name: "" });
  const seen = new Set([...mod.HAND_LEVELS, ...mod.SET_PIECES].map(sig));
  for (let tier = 1; tier <= 10; tier++) {
    let n = 0;
    for (let attempt = 0; n < spec.perTier && attempt < 400; attempt++) {
      const rng = createRng(`design:${spec.id}:${tier}:${attempt}`);
      let room: Room;
      try {
        room = spec.design(rng, tier);
      } catch {
        continue;
      }
      if (room.x > spec.maxW) continue;
      if (spec.mustTroll && !Object.keys(room.traps).length) continue;
      const shape = sig(room.def("", ""));
      if (seen.has(shape)) continue;
      seen.add(shape);
      const name = nextName();
      const def = room.def(slug(name), name);
      try {
        compileLevel(def);
      } catch (e) {
        console.log(`  reject ${def.id}: ${(e as Error).message}`);
        continue;
      }
      const why = fair(def);
      if (why) continue;
      if (spec.mustBite && !naiveDies(def, cfg)) continue;
      const t0 = Date.now();
      const frames = solve(def, cfg);
      if (!frames) {
        names.delete(name);
        console.log(`  tier ${tier} #${attempt}: unsolved (${Date.now() - t0} ms)`);
        continue;
      }
      const s = slack(def, cfg, frames);
      // keep timing humane: at least a third of nudged jumps must still clear (fewer on the top tiers)
      if (s < (tier >= 8 ? 0.2 : 0.3)) {
        names.delete(name);
        console.log(`  tier ${tier} #${attempt}: too tight (${s.toFixed(2)})`);
        continue;
      }
      const score = tier * 1000 + room.hazards * 10 + frames.length / 20 + (1 - s) * 100;
      made.push({ def, tier, frames, score });
      taken.add(def.id);
      n++;
      console.log(`${spec.id} tier ${tier} ${def.id}: w${room.x} ${frames.length}f slack ${s.toFixed(2)} (${Date.now() - t0} ms)`);
    }
    if (n < spec.perTier) throw new Error(`${spec.id}: tier ${tier} made only ${n}`);
  }

  // Ladder: hand rooms spread over tiers 1-4 in their own order, set pieces close tiers 3, 6, 9 and 10,
  // generated rooms by tier and then by measured difficulty.
  const keyed: { id: string; key: number }[] = [];
  mod.HAND_LEVELS.forEach((l, j) => keyed.push({ id: l.id, key: 1 + (3 * j) / mod.HAND_LEVELS.length + 0.001 }));
  const caps = [3.999, 6.999, 9.999, 10.999];
  mod.SET_PIECES.forEach((l, j) => keyed.push({ id: l.id, key: caps[Math.min(j, caps.length - 1)] + j * 1e-6 }));
  for (let tier = 1; tier <= 10; tier++) {
    const inTier = made.filter((m) => m.tier === tier).sort((a, b) => a.score - b.score);
    inTier.forEach((m, j) => keyed.push({ id: m.def.id, key: tier + (j + 0.5) / (inTier.length + 1) }));
  }
  keyed.sort((a, b) => a.key - b.key);
  // variety: no motif more than twice, never two alike in a row (lib/game/rage-variety.ts)
  const byId = new Map([...mod.HAND_LEVELS, ...mod.SET_PIECES, ...made.map((m) => m.def)].map((l) => [l.id, l]));
  const fixed = new Set([...mod.HAND_LEVELS, ...mod.SET_PIECES].map((l) => l.id));
  const ladder = curate(
    keyed.map((x) => x.id),
    byId,
    fixed,
  );

  for (const m of made) solutions[m.def.id] = scriptFromLog(logFromFrames(m.frames));
  // drop scripts for rooms an earlier run made and this one did not
  const keep = new Set(ladder);
  for (const key of Object.keys(solutions)) if (!keep.has(key)) delete solutions[key];
  const body = Object.entries(solutions)
    .map(([key, v]) => `  ${JSON.stringify(key)}: ${JSON.stringify(v)}`)
    .join(",\n");
  writeFileSync(solFile, `{\n${body}\n}\n`);

  const out = path.resolve(`games/${spec.id}/levels.generated.ts`);
  const src = `/**
 * Generated by scripts/rage-design.ts (seeded procedural designer). Do not edit by hand: change the designer
 * and re-run \`pnpm tsx scripts/rage-design.ts ${spec.id}\`. Every room here has a bot-found no-death solution in
 * solutions.json that the tests replay.
 */
import type { LevelDef } from "@/phaser/sim/level";

export const GENERATED: LevelDef[] = ${JSON.stringify(made.map((m) => m.def))};

/** Level ladder order (Level 1 first): hand rooms, set pieces and generated rooms by difficulty. */
export const LADDER: string[] = ${JSON.stringify(ladder)};
`;
  writeFileSync(out, src);
  execFileSync("pnpm", ["prettier", "--write", out, solFile], { stdio: "ignore" });
  console.log(`${spec.id}: ${ladder.length} levels (${made.length} generated)`);
}

async function main() {
  const arg = process.argv[2];
  // "runner" is an alias for Dash (some shells and sandboxes treat a bare "dash" argument as a shell)
  const ids: GameId[] = arg === "all" || !arg ? ["gauntlet", "gotcha", "dash"] : [arg === "runner" ? "dash" : (arg as GameId)];
  for (const id of ids) await build(SPECS[id]);
}

void main();
