import { describe, expect, it } from "vitest";
import { START_FEN, legalMoves, parseFen, parseSq, sqName, toRows, uci } from "./engine";
import { PREMOVE_MAX, applyPremoves, canPremoveFrom, premoveTargets, premoveUci, queuePremove, resolvePremove } from "./premove";

const sq = parseSq;
const names = (list: number[]) => list.map(sqName).sort();

describe("premove targets", () => {
  const start = parseFen(START_FEN).b;
  it("a pawn at home: one or two ahead and both diagonals", () => {
    expect(names(premoveTargets(start, sq("e2")))).toEqual(["d3", "e3", "e4", "f3"]);
    expect(names(premoveTargets(start, sq("a7")))).toEqual(["a5", "a6", "b6"]);
  });
  it("sliding pieces ignore whatever stands in the way (it may be gone by then)", () => {
    // the rook on a1 behind its own pawn still reaches the whole file and rank
    const t = names(premoveTargets(start, sq("a1")));
    expect(t).toHaveLength(14);
    expect(t).toContain("a8");
    expect(t).toContain("h1");
  });
  it("knights jump, kings step and may castle from home toward a rook in its corner", () => {
    expect(names(premoveTargets(start, sq("g1")))).toEqual(["e2", "f3", "h3"]);
    expect(names(premoveTargets(start, sq("e1")))).toEqual(["c1", "d1", "d2", "e2", "f1", "f2", "g1"]);
    const noRooks = parseFen("4k3/8/8/8/8/8/8/4K3 w - - 0 1").b;
    expect(names(premoveTargets(noRooks, sq("e1")))).toEqual(["d1", "d2", "e2", "f1", "f2"]);
  });
  it("only your own pieces can be premoved", () => {
    expect(canPremoveFrom(start, sq("e2"), 0)).toBe(true);
    expect(canPremoveFrom(start, sq("e7"), 0)).toBe(false);
    expect(canPremoveFrom(start, sq("e4"), 0)).toBe(false);
  });
});

describe("the imagined board", () => {
  it("draws queued premoves as made, a castling king bringing its rook", () => {
    const b = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1").b;
    const rows = toRows(applyPremoves(b, ["e1g1"]));
    expect(rows[7]).toBe("R....RK.");
  });
  it("a pawn premoved to the last rank becomes a queen", () => {
    const b = parseFen("8/P3k3/8/8/8/8/8/4K3 b - - 0 1").b;
    expect(premoveUci(b, sq("a7"), sq("a8"))).toBe("a7a8q");
    expect(premoveUci(b, sq("e1"), sq("e2"))).toBe("e1e2");
    expect(toRows(applyPremoves(b, ["a7a8q"]))[0]).toBe("Q.......");
  });
  it("later premoves start where earlier ones left the piece", () => {
    const b = applyPremoves(parseFen(START_FEN).b, ["g1f3"]);
    expect(canPremoveFrom(b, sq("f3"), 0)).toBe(true);
    expect(names(premoveTargets(b, sq("f3")))).toContain("e5");
  });
});

describe("the queue", () => {
  it("holds up to three", () => {
    let q: string[] = [];
    for (const m of ["e2e4", "d2d4", "g1f3", "b1c3"]) q = queuePremove(q, m);
    expect(q).toEqual(["e2e4", "d2d4", "g1f3"]);
    expect(PREMOVE_MAX).toBe(3);
  });

  it("plays the first premove when it is legal on your turn and keeps the rest", () => {
    // Black answered 1. e4 with e5; white's premove Nf3 is legal now.
    const p = parseFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    const legal = legalMoves(p).map(uci);
    expect(resolvePremove(["g1f3", "f1c4"], legal)).toEqual({ play: "g1f3", rest: ["f1c4"], dropped: false });
  });

  it("drops the whole queue when the first isn't legal after the reply", () => {
    // White premoved e4-e5, but black's pawn now stands on e5.
    const p = parseFen("rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
    const legal = legalMoves(p).map(uci);
    expect(resolvePremove(["e4e5", "d2d4"], legal)).toEqual({ play: null, rest: [], dropped: true });
  });

  it("does nothing with an empty queue, and nothing on the other side's turn (no legal moves of yours)", () => {
    expect(resolvePremove([], ["e2e4"])).toEqual({ play: null, rest: [], dropped: false });
    expect(resolvePremove(["e2e4"], []).play).toBeNull();
  });

  it("a promotion premove plays as a queen", () => {
    const p = parseFen("8/P3k3/8/8/8/8/8/4K3 w - - 0 1");
    const legal = legalMoves(p).map(uci);
    expect(resolvePremove(["a7a8q"], legal).play).toBe("a7a8q");
  });
});
