import { describe, expect, it } from "vitest";
import { leavePolicy, TIMED_RUNS, type LeaveContext } from "@/lib/game/leave";
import { GAMES } from "@/lib/catalog";

describe("leavePolicy", () => {
  it("lets solo play go at once: free play, levels, guided practice, the device bot, async and bot Board Bay games", () => {
    for (const context of ["solo", "guided", "bot", "bay-async", "bay-bot"] as LeaveContext[])
      for (const started of [false, true])
        expect(leavePolicy({ context, game: "crownfall", started }), `${context} started=${started}`).toEqual({
          kind: "none",
          forfeit: false,
          guard: false,
        });
  });

  it("asks once before leaving a timed scored run that has started, without a forfeit call", () => {
    for (const game of ["quickfire", "echo", "flinch", "gotcha", "dash"]) {
      expect(leavePolicy({ context: "solo", game, started: true })).toEqual({ kind: "run", forfeit: false, guard: true });
      // Nothing to lose before the run starts, or once it is over.
      expect(leavePolicy({ context: "solo", game, started: false }).kind).toBe("none");
      expect(leavePolicy({ context: "solo", game, started: true, over: true }).kind).toBe("none");
    }
  });

  it("only lists live games as timed runs", () => {
    const live = new Set(GAMES.map((g) => g.id));
    for (const id of TIMED_RUNS) expect(live.has(id), id).toBe(true);
  });

  it("asks before leaving a live match against people and calls the leave endpoint", () => {
    expect(leavePolicy({ context: "duel" })).toEqual({ kind: "match", forfeit: true, guard: true });
    expect(leavePolicy({ context: "bay-live" })).toEqual({ kind: "match", forfeit: true, guard: true });
    expect(leavePolicy({ context: "party" })).toEqual({ kind: "party", forfeit: true, guard: true });
  });

  it("leaves a Practice-bot Duel without asking but still tells the server", () => {
    expect(leavePolicy({ context: "duel-bot" })).toEqual({ kind: "none", forfeit: true, guard: false });
  });

  it("never asks once a match is over", () => {
    for (const context of ["duel", "duel-bot", "bay-live", "party"] as LeaveContext[])
      expect(leavePolicy({ context, over: true })).toEqual({ kind: "none", forfeit: false, guard: false });
  });
});
