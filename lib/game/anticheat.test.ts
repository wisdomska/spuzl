import { describe, expect, it } from "vitest";
import { lookMs, timingFlag, WALL_SLACK_MS } from "./anticheat";

const floorMs = 4000;

describe("finish timing checks after R2-15 (clock from the first move)", () => {
  it("a player who studies the board, then solves fast, is not flagged", () => {
    // 20 s looking, 2.5 s of moves: the floor reads the look time.
    expect(timingFlag({ activeMs: 2_500, boardMs: 22_500, wallMs: 24_000, floorMs })).toBeNull();
  });

  it("still flags an impossible solve, look time included", () => {
    expect(timingFlag({ activeMs: 900, boardMs: 1_500, wallMs: 3_000, floorMs })).toMatch(/below human floor \(1500 < 4000/);
  });

  it("an old client without boardMs is judged on activeMs, as before", () => {
    expect(timingFlag({ activeMs: 3_000, wallMs: 30_000, floorMs })).toMatch(/below human floor \(3000/);
    expect(timingFlag({ activeMs: 5_000, wallMs: 30_000, floorMs })).toBeNull();
  });

  it("look time can never be claimed beyond the server's wall clock (plus slack)", () => {
    // A tampered client says it looked for a minute; the server saw 1 s pass since the attempt started.
    expect(lookMs({ activeMs: 500, boardMs: 60_000, wallMs: 1_000 })).toBe(1_000 + WALL_SLACK_MS);
    expect(timingFlag({ activeMs: 500, boardMs: 60_000, wallMs: 0, floorMs })).toMatch(/below human floor \(3000 < 4000/);
  });

  it("look time is never less than the play time", () => {
    expect(lookMs({ activeMs: 9_000, boardMs: 100, wallMs: 20_000 })).toBe(9_000);
    expect(lookMs({ activeMs: 9_000, boardMs: Number.NaN, wallMs: 20_000 })).toBe(9_000);
  });

  it("client time later than the wall clock is flagged; an honest first-move clock never trips it", () => {
    expect(timingFlag({ activeMs: 40_000, boardMs: 40_000, wallMs: 30_000, floorMs })).toMatch(/exceeds server wall time/);
    // The attempt was primed at the tap: the wall clock includes loading and thinking, the play clock does not.
    expect(timingFlag({ activeMs: 12_000, boardMs: 18_000, wallMs: 19_500, floorMs })).toBeNull();
    // Within the slack (clock skew between a phone and the server).
    expect(timingFlag({ activeMs: 31_000, boardMs: 31_000, wallMs: 30_000, floorMs })).toBeNull();
  });
});
