import { describe, expect, it, vi } from "vitest";
import { CODE_ALPHABET, isRoomCode, makeRoomCode, normalizeRoomCode, roomExpired } from "@/lib/multiplayer/roomCode";
import { botDue, compatible, pickOpponent, ratingWindow, type QueueEntry } from "@/lib/multiplayer/matchmaking";
import { throttle, validateProgress } from "@/lib/multiplayer/progress";
import { countdownBeat, duelPhase, matchState, resolveRound, botProgress } from "@/lib/multiplayer/duel";
import { nextHost, overtakes, placeRace, raceOrder, raceOver } from "@/lib/multiplayer/race";
import { TIMING } from "@/lib/multiplayer/constants";
import { createRng } from "@/lib/rng";
import crownfall from "@/games/crownfall/logic";

describe("room codes", () => {
  it("never uses 0, O, 1 or I and is always 4 characters", () => {
    for (const ch of "0O1I") expect(CODE_ALPHABET).not.toContain(ch);
    const rng = createRng("codes");
    for (let i = 0; i < 2000; i++) {
      const c = makeRoomCode(() => rng.next());
      expect(c).toHaveLength(4);
      expect(isRoomCode(c)).toBe(true);
    }
  });
  it("normalises case-insensitive input and rejects lookalikes", () => {
    expect(normalizeRoomCode(" k7qx ")).toBe("K7QX");
    expect(normalizeRoomCode("k7-qx")).toBe("K7QX");
    expect(normalizeRoomCode("K0QX")).toBeNull();
    expect(normalizeRoomCode("KIQX")).toBeNull();
    expect(normalizeRoomCode("K7Q")).toBeNull();
  });
  it("expires 2 h after the room empties", () => {
    const now = Date.parse("2026-11-01T12:00:00Z");
    expect(roomExpired(null, now)).toBe(false);
    expect(roomExpired(new Date(now - TIMING.roomTtlMs + 1000).toISOString(), now)).toBe(false);
    expect(roomExpired(new Date(now - TIMING.roomTtlMs - 1000).toISOString(), now)).toBe(true);
  });
});

describe("matchmaking", () => {
  const e = (id: string, rating: number, o: Partial<QueueEntry> = {}): QueueEntry => ({
    playerId: id,
    gameId: "sixer",
    rating,
    region: "GH",
    enqueuedAt: 0,
    ...o,
  });
  it("widens the rating window the longer you wait", () => {
    expect(ratingWindow(0)).toBe(100);
    expect(ratingWindow(10_000)).toBe(350);
    expect(ratingWindow(10 * 60_000)).toBe(600);
  });
  it("only pairs compatible games and ratings", () => {
    expect(compatible(e("a", 1400), e("b", 1480), 0)).toBe(true);
    expect(compatible(e("a", 1400), e("b", 1600), 0)).toBe(false);
    expect(compatible(e("a", 1400), e("b", 1600), 5000)).toBe(true);
    expect(compatible(e("a", 1400), e("b", 1400, { gameId: "quads" }), 0)).toBe(false);
    expect(compatible(e("a", 1400, { gameId: null }), e("b", 1400, { gameId: "quads" }), 0)).toBe(true);
    expect(compatible(e("a", 1400), e("a", 1400), 0)).toBe(false);
  });
  it("prefers the same region, then the closest rating, then the longest wait", () => {
    const me = e("me", 1420);
    const pick = pickOpponent(me, [e("ng", 1425, { region: "NG" }), e("gh", 1480), e("gh2", 1480, { enqueuedAt: -5 })], 0);
    expect(pick?.playerId).toBe("gh2");
    expect(pickOpponent(me, [e("far", 2000)], 0)).toBeNull();
  });
  it("offers the Practice bot after 20 s", () => {
    expect(botDue(0, 19_999)).toBe(false);
    expect(botDue(0, 20_000)).toBe(true);
  });
});

describe("progress validation", () => {
  const g = crownfall.generate(createRng("mp-progress"), "easy");
  const n = g.puzzle.size;
  const solved = new Array(n * n).fill(0);
  g.solution.forEach((c, r) => (solved[r * n + c] = 2));
  it("computes progress from the state with the game's own progress()", () => {
    const half = new Array(n * n).fill(0);
    g.solution.slice(0, 2).forEach((c, r) => (half[r * n + c] = 2));
    const v = validateProgress(crownfall, g.puzzle, g.solution, { state: half, mistakes: 0 });
    expect(v.ok).toBe(true);
    expect(v.progress).toBeCloseTo(crownfall.progress(g.puzzle, g.solution, half), 3);
    expect(validateProgress(crownfall, g.puzzle, g.solution, { state: solved, mistakes: 0 }).progress).toBe(1);
  });
  it("never shows 100% for a state verify() rejects", () => {
    const fake = { progress: () => 1, verify: () => ({ ok: false, progress: 1 }) };
    expect(validateProgress(fake, null, null, { state: [], mistakes: 0 }).progress).toBe(0.99);
  });
  it("clamps, refuses huge or broken states and keeps mistakes monotonic", () => {
    const wild = { progress: () => 7, verify: () => ({ ok: true, progress: 1 }) };
    expect(validateProgress(wild, null, null, { state: [], mistakes: 0 }).progress).toBe(1);
    const nan = { progress: () => NaN, verify: () => ({ ok: false, progress: 0 }) };
    expect(validateProgress(nan, null, null, { state: [], mistakes: 0 }).ok).toBe(false);
    const thrower = {
      progress: () => {
        throw new Error("bad");
      },
      verify: () => ({ ok: false, progress: 0 }),
    };
    expect(validateProgress(thrower, null, null, { state: {}, mistakes: 0 }).ok).toBe(false);
    expect(validateProgress(crownfall, g.puzzle, g.solution, { state: "x".repeat(70_000), mistakes: 0 }).ok).toBe(false);
    expect(validateProgress(crownfall, g.puzzle, g.solution, { state: solved, mistakes: 1 }, 3).mistakes).toBe(3);
    expect(validateProgress(crownfall, g.puzzle, g.solution, { state: solved, mistakes: 99 }, 3).mistakes).toBe(13);
    expect(validateProgress(crownfall, g.puzzle, g.solution, { state: solved, mistakes: -1 }, 0).ok).toBe(false);
  });
  it("throttles to 2 per second, keeping the latest state", () => {
    vi.useFakeTimers();
    const calls: number[] = [];
    const t = throttle((x: number) => calls.push(x), TIMING.progressMs);
    t(1);
    t(2);
    t(3);
    expect(calls).toEqual([1]);
    vi.advanceTimersByTime(500);
    expect(calls).toEqual([1, 3]);
    t(4);
    t.flush();
    expect(calls).toEqual([1, 3, 4]);
    vi.useRealTimers();
  });
});

describe("duel rules", () => {
  it("first verified clear takes the round", () => {
    expect(
      resolveRound([
        { id: "b", timeMs: 2400, mistakes: 0 },
        { id: "a", timeMs: 2000, mistakes: 3 },
      ]),
    ).toMatchObject({ winner: "a", tie: false, margin: 400 });
    expect(resolveRound([{ id: "a", timeMs: 1000, mistakes: 0 }]).winner).toBe("a");
  });
  it("same tenth of a second: fewer slips takes it, otherwise a drawn round", () => {
    expect(
      resolveRound([
        { id: "a", timeMs: 2043, mistakes: 1 },
        { id: "b", timeMs: 2049, mistakes: 0 },
      ]),
    ).toMatchObject({ winner: "b", tie: true });
    expect(
      resolveRound([
        { id: "a", timeMs: 2043, mistakes: 0 },
        { id: "b", timeMs: 2049, mistakes: 0 },
      ]),
    ).toMatchObject({ winner: null, tie: true });
    expect(
      resolveRound([
        { id: "a", timeMs: 2099, mistakes: 0 },
        { id: "b", timeMs: 2101, mistakes: 0 },
      ]).winner,
    ).toBe("a");
  });
  it("best of 3, draws possible", () => {
    expect(matchState({ a: 2, b: 0 }, 2)).toMatchObject({ over: true, winner: "a" });
    expect(matchState({ a: 1, b: 1 }, 2)).toMatchObject({ over: false });
    expect(matchState({ a: 1, b: 1 }, 3)).toMatchObject({ over: true, draw: true });
    expect(matchState({ a: 1, b: 0 }, 3)).toMatchObject({ over: true, winner: "a" });
  });
  it("phases follow the server clock", () => {
    const start = 100_000;
    expect(duelPhase({ status: "playing", round: 1, roundStartedAt: start }, start - 5000)).toBe("versus");
    expect(duelPhase({ status: "playing", round: 2, roundStartedAt: start }, start - 5000)).toBe("round_end");
    expect(duelPhase({ status: "playing", round: 1, roundStartedAt: start }, start - 1000)).toBe("countdown");
    expect(duelPhase({ status: "playing", round: 1, roundStartedAt: start }, start + 1)).toBe("playing");
    expect(duelPhase({ status: "playing", round: 1, roundStartedAt: start, pausedAt: start + 5 }, start + 10)).toBe("paused");
    expect(duelPhase({ status: "finished", round: 3, roundStartedAt: start }, start)).toBe("match_end");
  });
  it("counts 3, 2, 1, SPUZL! on 800 ms beats", () => {
    expect(countdownBeat(4000).label).toBe("3");
    expect(countdownBeat(3100).label).toBe("2");
    expect(countdownBeat(2300).label).toBe("1");
    expect(countdownBeat(1500).label).toBe("SPUZL!");
    expect(countdownBeat(10).label).toBe("SPUZL!");
  });
  it("bot progress rises to its finish time and never shows 100% early", () => {
    expect(botProgress(0, 60_000)).toBe(0);
    expect(botProgress(30_000, 60_000)).toBeGreaterThan(0.5);
    expect(botProgress(59_000, 60_000)).toBeLessThan(1);
  });
});

describe("party race", () => {
  const r = (id: string, timeMs: number | null, progress = 0, mistakes = 0, gone = false) => ({ id, timeMs, progress, mistakes, gone });
  it("orders finishers by time, then slips, then the rest by progress", () => {
    const order = raceOrder([r("a", null, 0.5), r("b", 30_000), r("c", 30_000, 1, 2), r("d", null, 0.8), r("e", null, 0.9, 0, true)]);
    expect(order.map((x) => x.id)).toEqual(["b", "c", "d", "a", "e"]);
  });
  it("gives points for place and speed, partial points for progress", () => {
    const placed = placeRace([r("a", 60_000), r("b", 90_000), r("c", null, 0.5)]);
    expect(placed.map((p) => p.place)).toEqual([1, 2, 3]);
    expect(placed[0].points).toBe(500 + 200 + 240);
    expect(placed[1].points).toBe(500 + 100 + 210);
    expect(placed[2].points).toBe(150);
  });
  it("ends when everyone here finished, 90 s after the first finish, or at the cap", () => {
    expect(raceOver([r("a", 10), r("b", 20)], 0, 10, 30)).toBe(true);
    expect(raceOver([r("a", 10), r("b", null, 0.5)], 0, 10, 30)).toBe(false);
    expect(raceOver([r("a", 10), r("b", null, 0.5, 0, true)], 0, 10, 30)).toBe(true);
    expect(raceOver([r("a", 10), r("b", null)], 0, 10, 10 + TIMING.raceAfterFirstMs)).toBe(true);
    expect(raceOver([r("a", null), r("b", null)], 0, null, TIMING.raceCapMs)).toBe(true);
  });
  it("spots overtakes that involve you (swoosh)", () => {
    expect(overtakes(["me", "kofi"], ["kofi", "me"], "me")).toEqual([{ passer: "kofi", passed: "me" }]);
    expect(overtakes(["kofi", "me"], ["me", "kofi"], "me")).toEqual([{ passer: "me", passed: "kofi" }]);
    expect(overtakes(["a", "b", "me"], ["b", "a", "me"], "me")).toEqual([]);
  });
  it("hands the room to the earliest player still here", () => {
    const m = [
      { id: "host", joinedAt: 0 },
      { id: "teacher", joinedAt: 1, spectator: true },
      { id: "late", joinedAt: 9 },
      { id: "early", joinedAt: 5 },
      { id: "gone", joinedAt: 2, gone: true },
    ];
    expect(nextHost(m, "host")).toBe("early");
    expect(nextHost([{ id: "host", joinedAt: 0 }], "host")).toBeNull();
  });
});
