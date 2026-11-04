/**
 * Shared Vitest checks for a Rage Ridge level ladder (Levels mode): at least 40 levels, unique ids and names,
 * every level compiles and has a bot-found no-death solution that replays, the hand rooms keep their order
 * (or, with `offLadder`, stay out of the ladder but keep replaying),
 * and Daily or free-play courses still draw only from the hand rooms. Test-only module.
 */
import { expect, it } from "vitest";
import type { GameLogic } from "@/games/types";
import { createRng } from "@/lib/rng";
import { replay, type SimCore } from "./core";
import { LADDER_WINDOW, type CoursePuzzle, type CourseSolution, type RageState } from "./course";
import { compileLevel, type LevelDef } from "./level";
import { courseLog } from "./scripted";

export interface LadderKitOptions {
  logic: GameLogic<CoursePuzzle, CourseSolution, RageState>;
  levels: LevelDef[];
  hand: LevelDef[];
  dailyPool: string[];
  sim(p: CoursePuzzle): SimCore;
  solutions: Record<string, number[][]>;
  pause: number;
  /** rooms kept out of the ladder but still played in Daily courses (Gotcha's short hand rooms and set pieces) */
  offLadder?: LevelDef[];
}

export function ladderSuite(o: LadderKitOptions) {
  it("has a ladder of at least 40 varied levels with unique ids and names", () => {
    expect(o.levels.length).toBeGreaterThanOrEqual(40);
    expect(new Set(o.levels.map((l) => l.id)).size).toBe(o.levels.length);
    expect(new Set(o.levels.map((l) => l.name)).size).toBe(o.levels.length);
    for (const l of o.levels) expect(() => compileLevel(l), l.id).not.toThrow();
    // no two rooms alike
    const shapes = new Set(o.levels.map((l) => JSON.stringify({ ...l, id: "", name: "" })));
    expect(shapes.size).toBe(o.levels.length);
  });

  it("stores exactly one solution per level, and every one clears its level without a death", () => {
    const rooms = [...o.levels, ...(o.offLadder ?? [])];
    expect(Object.keys(o.solutions).sort()).toEqual([...new Set(rooms.map((l) => l.id))].sort());
    for (const l of rooms) {
      const r = replay(o.sim({ levels: [l.id] }), courseLog([l.id], o.solutions, o.pause));
      expect(r.ok, l.id).toBe(true);
      expect(r.deaths, l.id).toBe(0);
    }
  });

  it("keeps the hand rooms in their order, and free-play courses draw from the ladder window for their difficulty", () => {
    const at = o.hand.map((h) => o.levels.findIndex((l) => l.id === h.id));
    if (o.offLadder) expect(at.every((i) => i < 0)).toBe(true);
    else {
      expect(at.every((i) => i >= 0)).toBe(true);
      expect(at).toEqual(at.slice().sort((a, b) => a - b));
    }
    const ids = o.levels.map((l) => l.id);
    for (let i = 0; i < 20; i++) {
      const d = (["easy", "medium", "hard", "expert", "mega"] as const)[i % 5];
      const g = o.logic.generate(createRng(`ladder:${i}`), d);
      const idx = g.puzzle.levels.map((id) => ids.indexOf(id));
      expect(idx.every((x) => x >= 0)).toBe(true);
      expect(idx).toEqual(idx.slice().sort((a, b) => a - b)); // still ramps
      const [lo, hi] = LADDER_WINDOW[d];
      expect(Math.min(...idx)).toBeGreaterThanOrEqual(Math.floor(lo * ids.length));
      if (d === "easy") expect(Math.max(...idx)).toBeLessThan(Math.max(Math.ceil(hi * ids.length), 10));
    }
  });

  it("serves level n as a one-room course that verifies with its solution", () => {
    for (const n of [1, Math.ceil(o.levels.length / 2), o.levels.length]) {
      const g = o.logic.level!(n)!;
      const id = o.levels[n - 1].id;
      expect(g.puzzle).toEqual({ levels: [id] });
      const log = courseLog([id], o.solutions, o.pause);
      const r = replay(o.sim(g.puzzle), log);
      const v = o.logic.verify(g.puzzle, g.solution, { log, deaths: r.deaths, timeMs: r.timeMs });
      expect(v.ok, v.reason).toBe(true);
    }
    expect(o.logic.level!(o.levels.length + 1)).toBeNull();
  });
}
