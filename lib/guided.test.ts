import { describe, expect, it } from "vitest";
import { needsGuided } from "./guided";

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
