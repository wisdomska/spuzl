import { describe, expect, it } from "vitest";
import { sameHud, type Hud } from "./hud";

const base: Hud = {
  deaths: 0,
  metres: 0,
  score: 0,
  progress: 0,
  ghostProgress: 0,
  delta: null,
  level: "Room 1",
  cleared: 0,
  started: false,
  finished: false,
};

describe("sameHud (the 10 Hz HUD read keeps the old object when nothing changed)", () => {
  it("is true for an equal read", () => {
    expect(sameHud(base, { ...base })).toBe(true);
  });
  it("is false when any shown field changes", () => {
    const changes: Partial<Hud>[] = [
      { deaths: 1 },
      { metres: 3 },
      { score: 10 },
      { progress: 0.1 },
      { ghostProgress: 0.2 },
      { delta: 0.4 },
      { level: "Room 2" },
      { cleared: 1 },
      { started: true },
      { finished: true },
    ];
    for (const c of changes) expect(sameHud(base, { ...base, ...c })).toBe(false);
  });
});
