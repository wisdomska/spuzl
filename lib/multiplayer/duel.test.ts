import { describe, expect, it } from "vitest";
import { TIMING } from "./constants";
import { duelPhase, firstRoundStart, inRulesBreak, newToGame, nextRoundStart, rankedPool, roundOutcomes, rulesBreakMs } from "./duel";

describe("ranked mix and rules breaks", () => {
  const known = (a: string[], b: string[]) =>
    new Map([
      ["a", new Set(a)],
      ["b", new Set(b)],
    ]);

  it("picks games both players know, else either, else any", () => {
    expect(rankedPool(known(["dusk", "nine"], ["nine", "five"]))).toEqual(["nine"]);
    expect(rankedPool(known(["dusk"], ["five"]))?.sort()).toEqual(["dusk", "five"]);
    expect(rankedPool(known([], []))).toBeUndefined();
  });

  it("names the players a round's game is new to", () => {
    expect(newToGame("nine", ["a", "b"], known(["nine"], []))).toEqual(["b"]);
    expect(newToGame("nine", ["a", "b"], known([], []))).toEqual(["a", "b"]);
    expect(newToGame("nine", ["a", "b"], known(["nine"], ["nine"]))).toEqual([]);
    expect(newToGame(undefined, ["a", "b"], known([], []))).toEqual([]);
  });

  it("adds the rules break only when someone is new", () => {
    expect(rulesBreakMs([])).toBe(0);
    expect(rulesBreakMs(["b"])).toBe(TIMING.rulesMs);
  });

  it("shows the rules card in the last stretch before the countdown, after the versus intro", () => {
    const now = 0;
    const start = firstRoundStart(now) + TIMING.rulesMs;
    expect(duelPhase({ status: "playing", round: 1, roundStartedAt: start }, now)).toBe("versus");
    expect(inRulesBreak(start - now)).toBe(false);
    expect(inRulesBreak(start - (now + TIMING.versusMs + 1))).toBe(true);
    const inCountdown = start - TIMING.countdownMs + 1;
    expect(inRulesBreak(start - inCountdown)).toBe(false);
    expect(duelPhase({ status: "playing", round: 1, roundStartedAt: start }, inCountdown)).toBe("countdown");
  });

  it("keeps the round end card before a later round's rules break", () => {
    const start = nextRoundStart(0, 2000) + rulesBreakMs(["a"]);
    expect(duelPhase({ status: "playing", round: 2, roundStartedAt: start }, 0)).toBe("round_end");
    expect(inRulesBreak(start - 1000)).toBe(false);
    expect(inRulesBreak(start - 2001)).toBe(true);
  });
});

describe("roundOutcomes (SPZ-03)", () => {
  const row = (round: number, playerId: string, won: boolean, place: number | null) => ({ round, playerId, won, place });
  it("adds up to the score: bot wins, a tie and my win", () => {
    const rows = [row(1, "me", false, 2), row(2, "me", false, 1), row(3, "me", true, 1)];
    const out = roundOutcomes(rows, "me", null, 3, true);
    expect(out).toEqual(["them", "draw", "me"]);
    expect(out.filter((o) => o === "me").length).toBe(1);
    expect(out.filter((o) => o === "them").length).toBe(1);
  });
  it("reads the rival's win between two players", () => {
    const rows = [row(1, "me", false, 2), row(1, "you", true, 1)];
    expect(roundOutcomes(rows, "me", "you", 1, false)).toEqual(["them"]);
  });
  it("uses the admin round result time", () => {
    expect(nextRoundStart(0, 3000)).toBe(3000 + 4000);
  });
});
