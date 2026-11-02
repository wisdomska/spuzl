import { describe, expect, it } from "vitest";
import {
  BAY_QUEUE,
  bayCompatible,
  bayRatingWindow,
  blockedPair,
  isLive,
  pickBayOpponent,
  searchTimedOut,
  seatOrder,
  type BayQueueEntry,
} from "@/lib/multiplayer/bayMatchmaking";

const NOW = 1_000_000_000;
const e = (playerId: string, o: Partial<BayQueueEntry> = {}): BayQueueEntry => ({
  playerId,
  game: "chess",
  rating: 1000,
  hasRating: false,
  enqueuedAt: NOW - 1000,
  seenAt: NOW - 500,
  ...o,
});

describe("board bay live matchmaking", () => {
  it("pairs two players waiting for the same game, never yourself or a different game", () => {
    const me = e("me");
    expect(pickBayOpponent(me, [me], NOW)).toBeNull();
    expect(pickBayOpponent(me, [e("x", { game: "draughts" })], NOW)).toBeNull();
    expect(pickBayOpponent(me, [e("x", { game: "draughts" }), e("y")], NOW)?.playerId).toBe("y");
  });

  it("is first come, first served when nobody has a rating yet", () => {
    const me = e("me");
    const early = e("early", { enqueuedAt: NOW - 9000, rating: 1400 });
    const late = e("late", { enqueuedAt: NOW - 2000, rating: 1000 });
    expect(pickBayOpponent(me, [late, early], NOW)?.playerId).toBe("early");
    // One side unrated: still first come (no rating window applies).
    expect(bayCompatible(e("r", { hasRating: true, rating: 1800 }), me, NOW)).toBe(true);
  });

  it("prefers the closest rating when both players have one, inside a window that widens with the wait", () => {
    const me = e("me", { hasRating: true, rating: 1200, enqueuedAt: NOW - 1000 });
    const close = e("close", { hasRating: true, rating: 1250, enqueuedAt: NOW - 1000 });
    const far = e("far", { hasRating: true, rating: 1340, enqueuedAt: NOW - 5000 });
    expect(pickBayOpponent(me, [far, close], NOW)?.playerId).toBe("close");
    const wayOff = e("off", { hasRating: true, rating: 1600, enqueuedAt: NOW - 1000 });
    expect(pickBayOpponent(me, [wayOff], NOW)).toBeNull();
    // After 30 s of waiting anyone of the same game will do.
    const patient = { ...wayOff, enqueuedAt: NOW - 31_000, seenAt: NOW - 100 };
    expect(pickBayOpponent(me, [patient], NOW)?.playerId).toBe("off");
    expect(bayRatingWindow(0)).toBe(150);
    expect(bayRatingWindow(10_000)).toBe(250);
    expect(bayRatingWindow(30_000)).toBe(Infinity);
  });

  it("never pairs blocked players, whichever side blocked", () => {
    const me = e("me");
    const them = e("them", { enqueuedAt: NOW - 5000 });
    const other = e("other", { enqueuedAt: NOW - 2000 });
    expect(pickBayOpponent(me, [them, other], NOW, [["me", "them"]])?.playerId).toBe("other");
    expect(pickBayOpponent(me, [them, other], NOW, [["them", "me"]])?.playerId).toBe("other");
    expect(pickBayOpponent(me, [them], NOW, [["them", "me"]])).toBeNull();
    expect(blockedPair("a", "b", [["b", "a"]])).toBe(true);
    expect(blockedPair("a", "b", [["a", "c"]])).toBe(false);
  });

  it("skips players who left (stopped polling) or whose search ran out", () => {
    const me = e("me");
    const gone = e("gone", { seenAt: NOW - BAY_QUEUE.staleMs - 1 });
    const expired = e("expired", { enqueuedAt: NOW - BAY_QUEUE.timeoutMs, seenAt: NOW });
    expect(pickBayOpponent(me, [gone, expired], NOW)).toBeNull();
    expect(isLive(e("x"), NOW)).toBe(true);
    expect(searchTimedOut(NOW - 59_999, NOW)).toBe(false);
    expect(searchTimedOut(NOW - 60_000, NOW)).toBe(true);
  });

  it("tosses a fair coin for who moves first", () => {
    expect(seatOrder("a", "b", 0.2)).toEqual(["a", "b"]);
    expect(seatOrder("a", "b", 0.7)).toEqual(["b", "a"]);
  });
});
