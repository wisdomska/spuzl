import { describe, expect, it } from "vitest";
import { createRng } from "@/lib/rng";
import rules, {
  CELLS,
  COLS,
  QUIET_LIMIT,
  applyMove,
  dropOk,
  initialMatch,
  isLegalMove,
  legalMovesOf,
  makesThree,
  statusOf,
  threeThrough,
  type DaraMatch,
} from "./rules";

const at = (r: number, c: number) => r * COLS + c;
/** A move-phase position from lists of cells for each side. */
function pos(mine: number[], theirs: number[], turn: 0 | 1 = 0, quiet = 0): DaraMatch {
  const board = new Array(CELLS).fill(0);
  mine.forEach((i) => (board[i] = 1));
  theirs.forEach((i) => (board[i] = 2));
  return { board, hand: [0, 0], turn, quiet };
}

describe("dara rules: drop phase", () => {
  it("starts empty with 12 stones each, seat 0 to drop", () => {
    const s = initialMatch();
    expect(s.hand).toEqual([12, 12]);
    expect(rules.turn(s)).toBe(0);
    expect(legalMovesOf(s)).toHaveLength(CELLS);
  });

  it("drops on any empty cell but never lines up three", () => {
    let s = initialMatch();
    s = applyMove(s, 0, { kind: "drop", to: at(0, 0) });
    s = applyMove(s, 1, { kind: "drop", to: at(4, 5) });
    s = applyMove(s, 0, { kind: "drop", to: at(0, 1) });
    s = applyMove(s, 1, { kind: "drop", to: at(4, 4) });
    expect(dropOk(s.board, at(0, 2), 1)).toBe(false);
    expect(isLegalMove(s, 0, { kind: "drop", to: at(0, 2) })).toBe(false);
    expect(isLegalMove(s, 0, { kind: "drop", to: at(0, 0) })).toBe(false); // occupied
    expect(isLegalMove(s, 1, { kind: "drop", to: at(2, 2) })).toBe(false); // not your turn
    expect(isLegalMove(s, 0, { kind: "move", from: at(0, 0), to: at(1, 0) })).toBe(false); // no moves yet
    expect(() => applyMove(s, 0, { kind: "drop", to: at(0, 2) })).toThrow();
    // a gap of one is fine; filling it later is not
    expect(dropOk(s.board, at(0, 3), 1)).toBe(true);
  });

  it("moves to the move phase after 24 drops, seat 0 first", () => {
    const rng = createRng("drops");
    let s = initialMatch();
    for (let k = 0; k < 24; k++) {
      const ms = legalMovesOf(s);
      s = applyMove(s, s.turn, rng.pick(ms));
    }
    expect(s.hand).toEqual([0, 0]);
    expect(s.board.filter((v) => v === 1)).toHaveLength(12);
    expect(s.board.filter((v) => v === 2)).toHaveLength(12);
    expect(s.turn).toBe(0);
    expect(legalMovesOf(s).every((m) => m.kind === "move")).toBe(true);
    // no three anywhere: drops never make one
    for (let i = 0; i < CELLS; i++) if (s.board[i]) expect(threeThrough(s.board, i, s.board[i])).toEqual([]);
  });
});

describe("dara rules: move phase", () => {
  it("moves one step across or down into an empty cell only", () => {
    const s = pos([at(2, 2), at(0, 0), at(4, 5)], [at(2, 3), at(4, 0), at(0, 5)]);
    expect(isLegalMove(s, 0, { kind: "move", from: at(2, 2), to: at(1, 2) })).toBe(true);
    expect(isLegalMove(s, 0, { kind: "move", from: at(2, 2), to: at(2, 3) })).toBe(false); // occupied
    expect(isLegalMove(s, 0, { kind: "move", from: at(2, 2), to: at(1, 1) })).toBe(false); // diagonal
    expect(isLegalMove(s, 0, { kind: "move", from: at(2, 2), to: at(0, 2) })).toBe(false); // two steps
    expect(isLegalMove(s, 0, { kind: "move", from: at(0, 5), to: at(1, 5) })).toBe(false); // not yours
    // no wrap round the row end
    expect(isLegalMove(s, 0, { kind: "move", from: at(4, 5), to: at(3, 5) })).toBe(true);
    expect(isLegalMove(s, 0, { kind: "move", from: at(0, 0), to: at(0, 0) - 1 })).toBe(false);
  });

  it("making exactly three captures a stone of your choice", () => {
    // yours at (1,0) (1,1), and (0,2) steps down to (1,2): three across
    const s = pos([at(1, 0), at(1, 1), at(0, 2), at(4, 4)], [at(3, 0), at(3, 3), at(4, 0), at(2, 5)]);
    expect(makesThree(s.board, at(0, 2), at(1, 2), 1)).toBe(true);
    const plain = { kind: "move" as const, from: at(0, 2), to: at(1, 2) };
    expect(isLegalMove(s, 0, plain)).toBe(false); // the take is required
    expect(isLegalMove(s, 0, { ...plain, take: at(4, 4) })).toBe(false); // your own stone
    expect(isLegalMove(s, 0, { ...plain, take: at(2, 2) })).toBe(false); // empty
    const t = applyMove(s, 0, { ...plain, take: at(3, 3) });
    expect(t.board[at(3, 3)]).toBe(0);
    expect(t.board[at(1, 2)]).toBe(1);
    expect(t.turn).toBe(1);
    expect(t.quiet).toBe(0);
    // legal moves list the three once per stone it could take
    expect(legalMovesOf(s).filter((m) => m.kind === "move" && m.to === at(1, 2) && m.from === at(0, 2))).toHaveLength(4);
  });

  it("four in a row does not capture, and a non-three move takes nothing", () => {
    const s = pos([at(1, 0), at(1, 1), at(1, 2), at(0, 3), at(4, 4)], [at(3, 0), at(3, 3), at(4, 0)]);
    expect(makesThree(s.board, at(0, 3), at(1, 3), 1)).toBe(false);
    expect(isLegalMove(s, 0, { kind: "move", from: at(0, 3), to: at(1, 3) })).toBe(true);
    expect(isLegalMove(s, 0, { kind: "move", from: at(0, 3), to: at(1, 3), take: at(3, 3) })).toBe(false);
    const t = applyMove(s, 0, { kind: "move", from: at(0, 3), to: at(1, 3) });
    expect(t.quiet).toBe(1);
  });

  it("three down counts too, and a line must include the moved stone", () => {
    const s = pos([at(0, 1), at(1, 1), at(2, 0), at(4, 5)], [at(4, 0), at(4, 2), at(3, 4)]);
    expect(makesThree(s.board, at(2, 0), at(2, 1), 1)).toBe(true);
    expect(threeThrough([...s.board.slice(0, at(2, 1)), 1, ...s.board.slice(at(2, 1) + 1)], at(2, 1), 1)).toEqual([
      at(0, 1),
      at(1, 1),
      at(2, 1),
    ]);
  });
});

describe("dara rules: end of game", () => {
  it("you lose on two stones", () => {
    const s = pos([at(1, 0), at(1, 1), at(0, 2)], [at(3, 0), at(3, 3), at(4, 5)]);
    const t = applyMove(s, 0, { kind: "move", from: at(0, 2), to: at(1, 2), take: at(4, 5) });
    expect(statusOf(t)).toEqual({ over: true, winner: 0, reason: "two stones left" });
    expect(legalMovesOf(t)).toEqual([]);
  });

  it("you lose when you cannot move", () => {
    // seat 1's stones in the corner are walled in by seat 0
    const s = pos([at(0, 2), at(1, 1), at(2, 0), at(4, 5)], [at(0, 0), at(0, 1), at(1, 0)], 1);
    expect(statusOf(s)).toEqual({ over: true, winner: 0, reason: "no moves" });
  });

  it("80 quiet plies draw", () => {
    const s = pos([at(0, 0), at(2, 2), at(4, 4)], [at(0, 5), at(2, 4), at(4, 1)], 0, QUIET_LIMIT);
    expect(statusOf(s)).toMatchObject({ over: true, winner: null });
  });

  it("random games stay legal and end", () => {
    for (const seed of ["a", "b", "c"]) {
      const rng = createRng(seed);
      let s = initialMatch();
      let plies = 0;
      while (!statusOf(s).over && plies < 2000) {
        const ms = legalMovesOf(s);
        const m = rng.pick(ms);
        expect(isLegalMove(s, s.turn, m)).toBe(true);
        s = applyMove(s, s.turn, m);
        plies++;
      }
      expect(statusOf(s).over).toBe(true);
    }
  });

  it("the practice bot plays legal moves and takes a free capture", () => {
    const s = pos([at(1, 0), at(1, 1), at(0, 2), at(4, 4)], [at(3, 0), at(3, 3), at(4, 0), at(2, 5)]);
    const m = rules.botMove!(s, 0, createRng("b"));
    expect(m).toMatchObject({ kind: "move", from: at(0, 2), to: at(1, 2) });
    expect(rules.isLegal(s, 0, m)).toBe(true);
  });
});
