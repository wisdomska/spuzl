import { describe, expect, it } from "vitest";
import { TIMING, beatsOfCountdown, countdownBeats, countdownMsFor } from "./constants";
import { countdownBeat, duelPhase, firstRoundStart, inRulesBreak, nextRoundStart, partyRoundStart } from "./duel";
import { partyPhase, standingOrder } from "./race";

/** R2-03: one countdown for Duel and Party, its length from the setting party.countdownSeconds. */
describe("round-start countdown length", () => {
  it("3 beats is the original 4 s countdown; each beat is 800 ms, SPUZL! held 1.6 s", () => {
    expect(countdownMsFor(3)).toBe(TIMING.countdownMs);
    expect(countdownMsFor(2)).toBe(3200);
    expect(countdownMsFor(5)).toBe(5600);
    for (const n of [2, 3, 4, 5]) expect(beatsOfCountdown(countdownMsFor(n))).toBe(n);
  });

  it("falls back to 3 for anything outside 2 to 5", () => {
    expect(countdownBeats(1)).toBe(3);
    expect(countdownBeats(6)).toBe(3);
    expect(countdownBeats(2.5)).toBe(3);
    expect(countdownBeats("4")).toBe(3);
    expect(countdownMsFor(9)).toBe(TIMING.countdownMs);
  });

  it("counts down from the setting, then SPUZL!", () => {
    const ms = countdownMsFor(5);
    expect(countdownBeat(ms, 5).label).toBe("5");
    expect(countdownBeat(ms - 800, 5).label).toBe("4");
    expect(countdownBeat(ms - 4 * 800, 5).label).toBe("1");
    expect(countdownBeat(TIMING.spuzlHoldMs, 5)).toEqual({ label: "SPUZL!", beat: 5 });
    expect(countdownBeat(countdownMsFor(2), 2).label).toBe("2");
    expect(countdownBeat(1, 2).label).toBe("SPUZL!");
    // the Party start buffer (before the countdown proper) shows the first number
    expect(countdownBeat(countdownMsFor(3) + TIMING.startBufferMs, 3).label).toBe("3");
    // the default is unchanged for callers that pass no length
    expect(countdownBeat(4000).label).toBe("3");
  });

  it("Duel phases and starts follow the countdown length", () => {
    const ms = countdownMsFor(5);
    expect(firstRoundStart(0, ms)).toBe(TIMING.versusMs + ms);
    expect(nextRoundStart(0, 2000, ms)).toBe(2000 + ms);
    expect(duelPhase({ status: "playing", round: 2, roundStartedAt: 10_000 }, 10_000 - 5000, ms)).toBe("countdown");
    expect(duelPhase({ status: "playing", round: 2, roundStartedAt: 10_000 }, 10_000 - 5000)).toBe("round_end");
    expect(inRulesBreak(ms + 1, ms)).toBe(true);
    expect(inRulesBreak(ms, ms)).toBe(false);
  });

  it("Party rounds start a small buffer after the countdown, and the board unlocks only at that start", () => {
    const ms = countdownMsFor(3);
    const start = partyRoundStart(1000, ms);
    expect(start).toBe(1000 + ms + TIMING.startBufferMs);
    expect(TIMING.startBufferMs).toBeGreaterThan(0);
    expect(TIMING.startBufferMs).toBeLessThanOrEqual(1000);
    expect(partyPhase({ status: "playing", roundStartedAt: start }, start - 1)).toBe("countdown");
    expect(partyPhase({ status: "playing", roundStartedAt: start }, start)).toBe("race");
  });
});

describe("Party results order (R2-03)", () => {
  it("ranks by points, then the server's place, then id", () => {
    const out = standingOrder([
      { id: "c", points: 900, place: 2 },
      { id: "a", points: 1200, place: 1 },
      { id: "d", points: 900, place: 3 },
      { id: "b", points: 300, place: null },
      { id: "e", points: 300, place: null },
    ]);
    expect(out.map((p) => p.id)).toEqual(["a", "c", "d", "b", "e"]);
  });

  it("does not change the list it is given", () => {
    const list = [
      { id: "x", points: 1, place: 2 },
      { id: "y", points: 2, place: 1 },
    ];
    standingOrder(list);
    expect(list[0].id).toBe("x");
  });
});
