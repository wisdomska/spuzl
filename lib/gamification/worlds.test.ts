import { describe, expect, it } from "vitest";
import { WORLD_COUNT_KINDS, worldsProgress } from "./worlds";
import { DAILY_POOL, WEEKLY_CHAIN } from "./quests";
import { WORLDS, gamesInWorld } from "@/lib/catalog";

const first = (w: string) => gamesInWorld(w as (typeof WORLDS)[number]["id"])[0].id;

describe("distinct-world quests", () => {
  it("covers the daily and weekly world quests", () => {
    expect(DAILY_POOL.find((q) => q.id === "d-new-world")!.goal.kind).toBe("worlds_today");
    expect(WEEKLY_CHAIN.find((q) => q.id === "w-3")!.goal.kind).toBe("worlds_week");
    expect(WORLD_COUNT_KINDS).toEqual(expect.arrayContaining(["worlds_today", "worlds_week"]));
  });

  it("every world quest goal is reachable with the live worlds", () => {
    for (const q of [...DAILY_POOL, ...WEEKLY_CHAIN].filter((q) => WORLD_COUNT_KINDS.includes(q.goal.kind))) {
      expect(q.goal.n).toBeLessThanOrEqual(WORLDS.length);
    }
  });

  it("counts distinct live worlds, not clears", () => {
    const [a, b] = WORLDS;
    const twoInA = gamesInWorld(a.id)
      .slice(0, 2)
      .map((g) => g.id);
    expect(worldsProgress([], 3)).toBe(0);
    expect(worldsProgress([...twoInA, ...twoInA], 3)).toBe(1);
    expect(worldsProgress([...twoInA, first(b.id)], 3)).toBe(2);
  });

  it("caps at the goal", () => {
    const all = WORLDS.map((w) => first(w.id));
    expect(worldsProgress(all, 3)).toBe(3);
    expect(worldsProgress(all, 5)).toBe(5);
  });

  it("ignores unknown game ids", () => {
    expect(worldsProgress(["nope", "constructor", first(WORLDS[0].id)], 3)).toBe(1);
  });
});
