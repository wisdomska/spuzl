import { describe, expect, it } from "vitest";
import {
  BAY_GAMES,
  canNudge,
  flagFallen,
  initialState,
  loadRules,
  replayMoves,
  spendClock,
  takebackPlies,
  validateMove,
} from "@/lib/multiplayer/bay";
import { TIMING } from "@/lib/multiplayer/constants";
import { createRng } from "@/lib/rng";

describe("board bay move validation", () => {
  it("accepts legal moves and rejects illegal, out-of-turn and garbage moves in every game", async () => {
    for (const game of BAY_GAMES) {
      const rules = await loadRules(game);
      const seats = rules.seats.min;
      const s = initialState(rules, seats, "seed");
      const seat = rules.turn(s);
      const legal = rules.legalMoves(s, seat);
      expect(legal.length, game).toBeGreaterThan(0);
      const ok = validateMove(rules, s, seat, legal[0], "seed", 0);
      expect(ok.ok, game).toBe(true);
      expect(validateMove(rules, s, (seat + 1) % seats, legal[0], "seed", 0).reason, game).toBe("not_your_turn");
      expect(validateMove(rules, s, seat, null, "seed", 0).ok, game).toBe(false);
      expect(validateMove(rules, s, seat, { nonsense: true }, "seed", 0).reason, game).toBe("illegal");
      expect(validateMove(rules, s, seat, 999, "seed", 0).ok, game).toBe(false);
    }
  });

  it("chess: a pawn can't jump three squares, and the game-over position takes no moves", async () => {
    const rules = await loadRules("chess");
    const s = initialState(rules, 2, "x");
    expect(validateMove(rules, s, 0, "e2e5", "x", 0).reason).toBe("illegal");
    let st = s;
    for (const [seat, m] of [
      [0, "f2f3"],
      [1, "e7e5"],
      [0, "g2g4"],
      [1, "d8h4"],
    ] as const) {
      const v = validateMove(rules, st, seat, m, "x", 0);
      expect(v.ok).toBe(true);
      st = v.next;
    }
    expect(rules.status(st)).toMatchObject({ over: true, winner: 1 });
    expect(validateMove(rules, st, 0, "a2a3", "x", 4).reason).toBe("game_over");
  });

  it("replays the move log deterministically (takebacks), including Ludo rolls", async () => {
    const rules = await loadRules("ludo");
    const seed = "ludo-seed";
    let s = initialState(rules, 2, seed);
    const moves: { seat: number; move: unknown }[] = [];
    const rng = createRng("bot");
    for (let ply = 0; ply < 30 && !rules.status(s).over; ply++) {
      const seat = rules.turn(s);
      const move = rules.botMove!(s, seat, rng);
      const v = validateMove(rules, s, seat, move, seed, ply);
      expect(v.ok).toBe(true);
      s = v.next;
      moves.push({ seat, move });
    }
    expect(replayMoves(rules, 2, seed, moves)).toEqual(s);
  });

  it("takes back one ply, or two when the opponent already replied", () => {
    expect(takebackPlies([], 0)).toBe(0);
    expect(takebackPlies([{ seat: 0 }], 0)).toBe(1);
    expect(takebackPlies([{ seat: 0 }, { seat: 1 }], 0)).toBe(2);
    expect(takebackPlies([{ seat: 1 }], 0)).toBe(0);
  });

  it("runs live clocks and flags", () => {
    expect(spendClock([300_000, 300_000], 0, 12_000)).toEqual([288_000, 300_000]);
    expect(spendClock([1000, 5], 1, 99)).toEqual([1000, 0]);
    expect(flagFallen([1000, 5000], 0, 0, 999)).toBe(false);
    expect(flagFallen([1000, 5000], 0, 0, 1000)).toBe(true);
    expect(flagFallen(null, 0, 0, 1e12)).toBe(false);
  });

  it("allows one nudge, 12 h into the opponent's turn", () => {
    expect(canNudge({ myTurn: false, turnStartedAt: 0, nudgedAt: null }, TIMING.nudgeAfterMs - 1)).toBe(false);
    expect(canNudge({ myTurn: false, turnStartedAt: 0, nudgedAt: null }, TIMING.nudgeAfterMs)).toBe(true);
    expect(canNudge({ myTurn: true, turnStartedAt: 0, nudgedAt: null }, TIMING.nudgeAfterMs)).toBe(false);
    expect(canNudge({ myTurn: false, turnStartedAt: 0, nudgedAt: 5 }, TIMING.nudgeAfterMs)).toBe(false);
  });
});
