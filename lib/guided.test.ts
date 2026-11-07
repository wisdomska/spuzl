import { describe, expect, it } from "vitest";
import { GAME_BY_ID } from "@/lib/catalog";
import { allLearned, knowsGame, learnedToSync, needsGuided, needsHowItWorks, shouldPrime } from "./guided";

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

describe("R2-07: practice round from every entry", () => {
  const base = { id: "dusk", played: [] as string[], learned: new Set<string>(), started: false, available: true };
  it("runs from levels (Continue), the Daily Five and games vs the bot, not just Daily and free play", () => {
    for (const mode of ["daily", "five", "free", "archive", "level", "bot"]) expect(needsGuided({ ...base, mode }), mode).toBe(true);
    for (const mode of ["duel", "race", "challenge", "ghost", "tutorial"]) expect(needsGuided({ ...base, mode }), mode).toBe(false);
  });
  it("the admin can turn a game's practice round off", () => {
    expect(needsGuided({ ...base, mode: "level", disabled: ["dusk"] })).toBe(false);
    expect(needsGuided({ ...base, mode: "level", disabled: ["nine"] })).toBe(true);
  });
  it("knows a game cleared once or learned on any device", () => {
    expect(knowsGame("dusk", ["dusk"], new Set())).toBe(true);
    expect(knowsGame("dusk", undefined, new Set(["dusk"]))).toBe(true);
    expect(knowsGame("dusk", [], new Set())).toBe(false);
  });
  it("live rounds: How it works only for a game new to the player, never while the account is unknown", () => {
    expect(needsHowItWorks({ id: "dusk", played: [], learned: new Set() })).toBe(true);
    expect(needsHowItWorks({ id: "dusk", played: ["dusk"], learned: new Set() })).toBe(false);
    expect(needsHowItWorks({ id: "dusk", played: undefined, learned: new Set() })).toBe(false);
    expect(needsHowItWorks({ id: "dusk", played: [], learned: new Set(), disabled: ["dusk"] })).toBe(false);
  });
  it("never primes an attempt the practice round would make useless", () => {
    const p = { id: "dusk", played: [] as string[], learned: new Set<string>(), available: true };
    expect(shouldPrime(p)).toBe(false);
    expect(shouldPrime({ ...p, played: ["dusk"] })).toBe(true);
    expect(shouldPrime({ ...p, learned: new Set(["dusk"]) })).toBe(true);
    // no practice board, or practice turned off: straight to the game, so priming helps
    expect(shouldPrime({ ...p, available: false })).toBe(true);
    expect(shouldPrime({ ...p, disabled: ["dusk"] })).toBe(true);
    // account not known yet: only what this device learned
    expect(shouldPrime({ ...p, played: undefined })).toBe(false);
    expect(shouldPrime({ ...p, played: undefined, learned: new Set(["dusk"]) })).toBe(true);
  });
});
