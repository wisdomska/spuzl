import { describe, expect, it } from "vitest";
import { holdState, type HoldInput } from "./hold";

const base: HoldInput = {
  paused: false,
  external: false,
  confirmHint: false,
  menuOpen: false,
  leaveAsking: false,
  canPause: true,
  solved: false,
};

describe("held and covered boards (R2-16)", () => {
  it("plays normally when nothing holds the game", () => expect(holdState(base)).toEqual({ held: false, covered: false }));

  it("Pause always covers the board, in every mode (live matches too)", () => {
    expect(holdState({ ...base, paused: true })).toEqual({ held: true, covered: true });
    expect(holdState({ ...base, paused: true, canPause: false })).toEqual({ held: true, covered: true });
  });

  it("How to play and the hint confirm cover it too", () => {
    expect(holdState({ ...base, external: true }).covered).toBe(true);
    expect(holdState({ ...base, confirmHint: true }).covered).toBe(true);
  });

  it("the menu and the leave confirm hold only where the mode can pause (a live round keeps running)", () => {
    expect(holdState({ ...base, menuOpen: true }).covered).toBe(true);
    expect(holdState({ ...base, leaveAsking: true }).covered).toBe(true);
    expect(holdState({ ...base, menuOpen: true, canPause: false })).toEqual({ held: false, covered: false });
    expect(holdState({ ...base, leaveAsking: true, canPause: false })).toEqual({ held: false, covered: false });
  });

  it("a cleared board is never covered (it is held up for the result)", () => {
    expect(holdState({ ...base, solved: true, menuOpen: true })).toEqual({ held: false, covered: false });
    expect(holdState({ ...base, solved: true, paused: true }).covered).toBe(false);
  });
});
