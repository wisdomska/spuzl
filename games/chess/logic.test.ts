import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import type { Difficulty } from "@/games/types";
import {
  START_FEN,
  fromUci,
  inCheck,
  insufficientMaterial,
  isCheckmate,
  isStalemate,
  legalMoves,
  make,
  parseFen,
  positionKey,
  san,
  toFen,
  toRows,
  uci,
  type Position,
} from "./engine";
import logic, {
  COPY,
  MATE_FOR,
  countSolutions,
  generate,
  grade,
  hint,
  isPuzzle,
  replay,
  solveLine,
  verify,
  type ChessPuzzle,
} from "./logic";
import { bestDefence, mateDistance, mateIn, matingMoves } from "./solver";
import chessRules, { initialMatch } from "./rules";

function perft(p: Position, d: number): number {
  if (!d) return 1;
  let n = 0;
  for (const m of legalMoves(p)) n += perft(make(p, m), d - 1);
  return n;
}
const play = (fen: string, ...moves: string[]) => moves.reduce((p, m) => make(p, fromUci(p, m)!), parseFen(fen));

describe("chess engine", { timeout: 60_000 }, () => {
  it("matches published perft counts (castling, en passant, promotion, pins)", () => {
    expect(perft(parseFen(START_FEN), 3)).toBe(8902);
    expect(perft(parseFen("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1"), 2)).toBe(2039);
    expect(perft(parseFen("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1"), 4)).toBe(43238);
    expect(perft(parseFen("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1"), 3)).toBe(9467);
  });

  it("round-trips FEN and the prototype row format", () => {
    expect(toFen(parseFen(START_FEN))).toBe(START_FEN);
    expect(toRows(parseFen(START_FEN).b)[7]).toBe("RNBQKBNR");
    expect(() => parseFen("bad")).toThrow();
    expect(() => parseFen("8/8/8/8/8/8/8 w - - 0 1")).toThrow();
    expect(() => parseFen("9/8/8/8/8/8/8/8 w - - 0 1")).toThrow();
    expect(() => parseFen("8/8/8/8/8/8/8/7X w - - 0 1")).toThrow();
    expect(() => parseFen("8/8/8/8/8/8/8/8 x - - 0 1")).toThrow();
  });

  it("castles both ways, and not through check", () => {
    const p = parseFen("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const names = legalMoves(p).map((m) => san(p, m));
    expect(names).toContain("O-O");
    expect(names).toContain("O-O-O");
    const after = play("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1g1");
    expect(toRows(after.b)[7]).toBe("R....RK.");
    expect(after.castle & 3).toBe(0);
    const q = play("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "e1c1");
    expect(toRows(q.b)[7]).toBe("..KR...R");
    const blocked = parseFen("r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1");
    expect(legalMoves(blocked).map(uci)).not.toContain("e1g1");
    // capturing a rook removes that castling right
    const rx = play("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", "a1a8");
    expect(rx.castle & 8).toBe(0);
  });

  it("captures en passant and promotes", () => {
    const p = play(START_FEN, "e2e4", "a7a6", "e4e5", "d7d5");
    const ep = fromUci(p, "e5d6");
    expect(ep).not.toBeNull();
    expect(san(p, ep!)).toBe("exd6");
    const after = make(p, ep!);
    expect(toRows(after.b)[3][3]).toBe(".");
    const promo = parseFen("8/P6k/8/8/8/8/8/K7 w - - 0 1");
    expect(legalMoves(promo).filter((m) => m.promo).length).toBe(4);
    expect(san(promo, fromUci(promo, "a7a8q")!)).toBe("a8=Q");
    expect(fromUci(promo, "a7a8")).toBeNull();
    expect(fromUci(promo, "zz")).toBeNull();
  });

  it("detects mate, stalemate and dead positions", () => {
    expect(isCheckmate(play(START_FEN, "f2f3", "e7e5", "g2g4", "d8h4"))).toBe(true);
    expect(isStalemate(parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"))).toBe(true);
    expect(insufficientMaterial(parseFen("8/8/8/4k3/8/8/2B5/4K3 w - - 0 1").b)).toBe(true);
    expect(insufficientMaterial(parseFen("8/8/8/4k3/8/8/2BB4/4K3 w - - 0 1").b)).toBe(false);
    expect(insufficientMaterial(parseFen("8/8/8/4k3/8/8/2N5/4KN2 w - - 0 1").b)).toBe(false);
    expect(insufficientMaterial(parseFen("8/8/8/4k3/8/8/2R5/4K3 w - - 0 1").b)).toBe(false);
  });

  it("disambiguates SAN and marks check", () => {
    const p = parseFen("4k3/8/8/8/8/8/8/R4RK1 w - - 0 1");
    expect(san(p, fromUci(p, "a1d1")!)).toBe("Rad1");
    const q = parseFen("4k3/8/8/8/R7/8/8/R3K3 w - - 0 1");
    expect(san(q, fromUci(q, "a1a2")!)).toBe("R1a2");
    expect(san(q, fromUci(q, "a4a8")!)).toBe("Ra8+");
    const r = parseFen("4k3/8/8/8/1Q6/8/1Q3Q2/4K3 w - - 0 1");
    expect(san(r, fromUci(r, "b2d4")!)).toBe("Qb2d4");
  });
});

describe("chess mate search", () => {
  const backRank = "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1";

  it("ports the prototype CH_PUZ mates", () => {
    const p = parseFen(backRank);
    expect(matingMoves(p, 1).map(uci)).toEqual(["e1e8"]);
    expect(mateDistance(p, 3)).toBe(1);
    expect(isPuzzle(p, 1)).not.toBeNull();
    expect(matingMoves(parseFen("1k6/ppp5/8/8/8/8/8/1K1R4 w - - 0 1"), 1).map(uci)).toEqual(["d1d8"]);
  });

  it("proves a mate in 2 and finds the longest defence", () => {
    const p = parseFen("3k4/2ppr3/8/2p1Q3/7R/8/5K2/8 w - - 0 1");
    expect(mateIn(p, 1)).toBe(false);
    expect(mateIn(p, 2)).toBe(true);
    const after = play("3k4/2ppr3/8/2p1Q3/7R/8/5K2/8 w - - 0 1", "h4h8");
    expect(uci(bestDefence(after, 1)!)).toBe("e7e8");
    expect(bestDefence(parseFen("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 1)).toBeNull();
  });

  it("never counts stalemate as mate", () => {
    const p = parseFen("7k/8/5QK1/8/8/8/8/8 w - - 0 1");
    expect(matingMoves(p, 1).map(uci)).not.toContain("f6f7");
  });

  it("respects a node budget in the generator filter", () => {
    expect(mateIn(parseFen(backRank), 2, { budget: { n: 0 } })).toBe(false);
  });
});

describe("chess puzzles", { timeout: 120_000 }, () => {
  for (const d of ["easy", "medium", "hard", "expert"] as Difficulty[]) {
    it(`generates a deterministic, unique ${d} mate in ${MATE_FOR[d]}`, () => {
      const a = generate(createRng(`daily:2026-11-02:${d}`), d);
      const b = generate(createRng(`daily:2026-11-02:${d}`), d);
      expect(a).toEqual(b);
      expect(a.puzzle.mateIn).toBe(MATE_FOR[d]);
      expect(countSolutions(a.puzzle, 2)).toBe(1);
      expect(solveLine(a.puzzle)).toEqual(a.solution.line);
      expect(parseFen(a.puzzle.fen).turn).toBe(0);
    });
  }

  it("generates many unique mates in 1 and 2 (20+ seeds)", () => {
    for (let i = 0; i < 24; i++) {
      const d: Difficulty = i % 2 ? "medium" : "easy";
      const g = generate(createRng(`free:${i}`), d);
      expect(countSolutions(g.puzzle, 3)).toBe(1);
      expect(mateDistance(parseFen(g.puzzle.fen), g.puzzle.mateIn)).toBe(g.puzzle.mateIn);
      expect(verify(g.puzzle, g.solution, { moves: g.solution.line.filter((_, k) => k % 2 === 0) }).ok).toBe(true);
    }
  });

  it("hard puzzles open with a quiet move", () => {
    const g = generate(createRng("quiet"), "hard");
    const p = parseFen(g.puzzle.fen);
    const first = fromUci(p, g.solution.line[0])!;
    expect(inCheck(make(p, first))).toBe(false);
  });

  it("verifies the solution and rejects near misses and malformed input", () => {
    const g = generate(createRng("verify"), "medium");
    const whites = g.solution.line.filter((_, k) => k % 2 === 0);
    expect(verify(g.puzzle, g.solution, { moves: whites })).toEqual({ ok: true, progress: 1 });
    expect(verify(g.puzzle, g.solution, { moves: whites.slice(0, 1) })).toMatchObject({ ok: false, progress: 0.5 });
    const p = parseFen(g.puzzle.fen);
    const other = legalMoves(p)
      .map(uci)
      .find((m) => m !== whites[0])!;
    expect(verify(g.puzzle, g.solution, { moves: [other, ...whites.slice(1)] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { moves: [whites[0], "a1a1"] })).toMatchObject({ ok: false, reason: "illegal move" });
    expect(verify(g.puzzle, g.solution, { moves: [] }).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, null as never).ok).toBe(false);
    expect(verify(g.puzzle, g.solution, { moves: [1, 2] } as never).ok).toBe(false);
    // a second move that lets the king out
    const after = replay(g.puzzle, whites.slice(0, 1)).pos;
    const bad = legalMoves(after)
      .map(uci)
      .find((m) => !isCheckmate(make(after, fromUci(after, m)!)));
    if (bad) expect(verify(g.puzzle, g.solution, { moves: [whites[0], bad] }).reason).toBe("move does not keep the mate");
  });

  it("accepts any mating final move, not only the main line", () => {
    // Re8 is forced first; the queen can also finish from several squares in some lines.
    const pz: ChessPuzzle = { fen: "3k4/2ppr3/8/2p1Q3/7R/8/5K2/8 w - - 0 1", mateIn: 2 };
    const line = solveLine(pz)!;
    const r = replay(pz, [line[0]]);
    for (const m of matingMoves(r.pos, 1)) expect(replay(pz, [line[0], uci(m)]).mated).toBe(true);
  });

  it("reports progress without leaking the line", () => {
    const g = generate(createRng("progress"), "medium");
    const whites = g.solution.line.filter((_, k) => k % 2 === 0);
    expect(logic.progress(g.puzzle, g.solution, { moves: [] })).toBe(0);
    expect(logic.progress(g.puzzle, g.solution, { moves: whites.slice(0, 1) })).toBe(0.5);
    expect(logic.progress(g.puzzle, g.solution, { moves: whites })).toBe(1);
    expect(logic.progress(g.puzzle, g.solution, "x" as never)).toBe(0);
  });

  it("hints are safe: following them always mates", () => {
    for (const d of ["easy", "medium"] as Difficulty[]) {
      const g = generate(createRng(`hint:${d}`), d);
      const moves: string[] = [];
      for (let k = 0; k < g.puzzle.mateIn; k++) {
        const h = hint(g.puzzle, g.solution, { moves });
        expect(h).not.toBeNull();
        const from = (h!.target as { from: string }).from;
        const pos = replay(g.puzzle, moves).pos;
        const m = matingMoves(pos, g.puzzle.mateIn - k).find((x) => uci(x).startsWith(from))!;
        moves.push(k === 0 ? g.solution.line[0] : uci(m));
      }
      expect(verify(g.puzzle, g.solution, { moves }).ok).toBe(true);
      expect(hint(g.puzzle, g.solution, { moves })).toBeNull();
    }
    const g = generate(createRng("hint:wrong"), "medium");
    const p = parseFen(g.puzzle.fen);
    const other = legalMoves(p)
      .map(uci)
      .find((m) => m !== g.solution.line[0])!;
    expect(hint(g.puzzle, g.solution, { moves: [other] })?.text).toMatch(/Undo/);
  });

  it("grades harder difficulties higher", () => {
    const avg = (d: Difficulty) => {
      let s = 0;
      for (let i = 0; i < 3; i++) s += generate(createRng(`g${i}:${d}`), d).grade;
      return s / 3;
    };
    const e = avg("easy"),
      m = avg("medium"),
      h = avg("hard"),
      x = avg("expert");
    expect(e).toBeLessThan(m);
    expect(m).toBeLessThanOrEqual(h);
    expect(h).toBeLessThan(x);
    expect(grade({ fen: "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", mateIn: 1 }, ["e1e8"])).toBeLessThan(40);
  });

  it("keeps the prototype copy", () => {
    expect(COPY.mate).toBe("Checkmate.");
    expect(COPY.notMate).toBe("Not mate. The king slips out.");
  });
});

describe("chess match rules", { timeout: 60_000 }, () => {
  const rng = createRng("match");

  it("plays a legal game and validates turns server-side", () => {
    let s = chessRules.initial(2, rng);
    expect(chessRules.turn(s)).toBe(0);
    expect(chessRules.legalMoves(s, 0)).toHaveLength(20);
    expect(chessRules.legalMoves(s, 1)).toEqual([]);
    expect(chessRules.isLegal(s, 1, "e7e5")).toBe(false);
    expect(chessRules.isLegal(s, 0, "e2e5")).toBe(false);
    expect(() => chessRules.apply(s, 1, "e7e5", rng)).toThrow();
    expect(() => chessRules.apply(s, 0, "e2e5", rng)).toThrow();
    for (const [seat, m] of [
      [0, "f2f3"],
      [1, "e7e5"],
      [0, "g2g4"],
      [1, "d8h4"],
    ] as const)
      s = chessRules.apply(s, seat, m, rng);
    expect(s.sans).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(chessRules.status(s)).toEqual({ over: true, winner: 1, reason: "checkmate" });
    expect(chessRules.legalMoves(s, 0)).toEqual([]);
    expect(chessRules.isLegal(s, 0, "a2a3")).toBe(false);
    expect(() => chessRules.apply(s, 0, "a2a3", rng)).toThrow("game over");
  });

  it("draws by stalemate, material, fifty moves and repetition", () => {
    expect(chessRules.status(initialMatch("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")).reason).toBe("stalemate");
    expect(chessRules.status(initialMatch("8/8/8/4k3/8/8/8/4K3 w - - 0 1")).reason).toBe("insufficient material");
    expect(chessRules.status(initialMatch("4k3/8/8/8/8/8/8/R3K3 w - - 100 80")).reason).toBe("fifty-move rule");
    let s = chessRules.initial(2, rng);
    for (let i = 0; i < 2; i++)
      for (const [seat, m] of [
        [0, "g1f3"],
        [1, "g8f6"],
        [0, "f3g1"],
        [1, "f6g8"],
      ] as const)
        s = chessRules.apply(s, seat, m, rng);
    expect(chessRules.status(s)).toEqual({ over: true, winner: null, reason: "threefold repetition" });
    expect(positionKey(parseFen(START_FEN))).toContain(" 0 15 -");
  });

  it("practice bot plays legal moves, takes free material and mates in one", () => {
    const r = createRng("bot");
    let s = chessRules.initial(2, r);
    for (let i = 0; i < 16 && !chessRules.status(s).over; i++) {
      const seat = chessRules.turn(s);
      const m = chessRules.botMove!(s, seat, r);
      expect(chessRules.isLegal(s, seat, m)).toBe(true);
      s = chessRules.apply(s, seat, m, r);
    }
    expect(chessRules.botMove!(initialMatch("6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1"), 0, r)).toBe("e1e8");
    expect(chessRules.botMove!(initialMatch("4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1"), 0, r)).toBe("d1d5");
    expect(() => chessRules.botMove!(initialMatch("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1"), 1, r)).toThrow();
  });
});
