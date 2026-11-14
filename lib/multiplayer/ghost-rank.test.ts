import { describe, expect, it } from "vitest";
import { beatsGhost, ghostByDistance } from "./ghost-rank";

describe("Ghost Race ranking", () => {
  it("Dash ranks by distance: the longer run wins", () => {
    expect(ghostByDistance("dash")).toBe(true);
    expect(beatsGhost("dash", { timeMs: 40_000, deaths: 1 }, { timeMs: 30_000, deaths: 1 })).toBe(true);
    expect(beatsGhost("dash", { timeMs: 20_000, deaths: 1 }, { timeMs: 30_000, deaths: 1 })).toBe(false);
    expect(beatsGhost("dash", { timeMs: 30_000, deaths: 1 }, { timeMs: 30_000, deaths: 1 })).toBe(false);
  });

  it("course games rank fewest deaths, then the faster clear", () => {
    expect(ghostByDistance("gotcha")).toBe(false);
    expect(beatsGhost("gotcha", { timeMs: 90_000, deaths: 2 }, { timeMs: 30_000, deaths: 3 })).toBe(true);
    expect(beatsGhost("gotcha", { timeMs: 31_000, deaths: 3 }, { timeMs: 30_000, deaths: 3 })).toBe(false);
  });

  it("the first run always sets the ghost", () => {
    expect(beatsGhost("dash", { timeMs: 1, deaths: 1 }, null)).toBe(true);
  });
});
