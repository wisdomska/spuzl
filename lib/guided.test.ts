import { describe, expect, it } from "vitest";
import { GAME_BY_ID } from "@/lib/catalog";
import { allLearned, learnedToSync, needsGuided } from "./guided";

describe("learned games on the account", () => {
  it("counts a game learned on this device or the account", () => {
    const learned = allLearned(new Set(["dusk"]), ["nine"]);
    expect([...learned].sort()).toEqual(["dusk", "nine"]);
    expect(allLearned(new Set(["dusk"]), undefined).has("dusk")).toBe(true);
    const base = { mode: "free", played: [] as string[], started: false, available: true };
    expect(needsGuided({ ...base, id: "nine", learned })).toBe(false); // learned on another device
    expect(needsGuided({ ...base, id: "five", learned })).toBe(true);
  });

  it("sends up only what the account lacks, once the account is known", () => {
    expect(learnedToSync(new Set(["dusk", "nine"]), ["nine"])).toEqual(["dusk"]);
    expect(learnedToSync(new Set(["dusk"]), ["dusk", "nine"])).toEqual([]);
    expect(learnedToSync(new Set(["dusk"]), undefined)).toEqual([]);
  });

  it("game ids fit the learned_games check", () => {
    for (const id of Object.keys(GAME_BY_ID)) expect(id).toMatch(/^[a-z0-9-]{2,24}$/);
  });
});

describe("guided first play", () => {
  const base = { id: "dusk", mode: "daily", played: [] as string[], learned: new Set<string>(), started: false, available: true };
  it("runs on the first try of a game", () => expect(needsGuided(base)).toBe(true));
  it("skips games cleared before, learned or skipped here, resumed, or unavailable", () => {
    expect(needsGuided({ ...base, played: ["dusk"] })).toBe(false);
    expect(needsGuided({ ...base, learned: new Set(["dusk"]) })).toBe(false);
    expect(needsGuided({ ...base, started: true })).toBe(false);
    expect(needsGuided({ ...base, available: false })).toBe(false);
    expect(needsGuided({ ...base, played: undefined })).toBe(false);
  });
  it("only applies to solo play", () => {
    expect(needsGuided({ ...base, mode: "challenge" })).toBe(false);
    expect(needsGuided({ ...base, mode: "free" })).toBe(true);
  });
});
