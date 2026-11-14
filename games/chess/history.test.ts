import { describe, expect, it } from "vitest";
import chessRules, { initialMatch } from "./rules";
import { START_FEN } from "./engine";
import { createRng } from "@/lib/rng";

const rng = createRng("history");
import { capturedPieces, movePairs, replay, startFenFromKey } from "./history";

const play = (moves: string[], fen?: string) => moves.reduce((s, m) => chessRules.apply(s, chessRules.turn(s), m, rng), initialMatch(fen));

describe("move list", () => {
  it("numbers the moves in pairs, standard notation", () => {
    const s = play(["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"]);
    expect(s.sans).toEqual(["e4", "e5", "Nf3", "Nc6", "Bb5"]);
    expect(movePairs(s.sans)).toEqual([
      { n: 1, white: "e4", black: "e5" },
      { n: 2, white: "Nf3", black: "Nc6" },
      { n: 3, white: "Bb5", black: null },
    ]);
  });
  it("a game where black moves first starts with an empty white slot", () => {
    expect(movePairs(["Kd7", "Kd2"], true)).toEqual([
      { n: 1, white: null, black: "Kd7" },
      { n: 2, white: "Kd2", black: null },
    ]);
  });
});

describe("replay (review)", () => {
  it("rebuilds the start from the first repetition key", () => {
    expect(startFenFromKey(initialMatch().keys[0])).toBe(START_FEN);
    const custom = initialMatch("8/P3k3/8/8/8/8/8/4K3 w - - 0 1");
    expect(startFenFromKey(custom.keys[0])).toBe("8/P3k3/8/8/8/8/8/4K3 w - - 0 1");
    expect(startFenFromKey(undefined)).toBeNull();
  });
  it("gives every position of the game, with the move that led there", () => {
    const s = play(["e2e4", "e7e5", "g1f3", "b8c6", "e1e2"]);
    const plies = replay(s.sans, startFenFromKey(s.keys[0])!, s.fen)!;
    expect(plies).toHaveLength(6);
    expect(plies[0]).toEqual({ fen: START_FEN, move: null });
    expect(plies.map((p) => p.move)).toEqual([null, "e2e4", "e7e5", "g1f3", "b8c6", "e1e2"]);
    expect(plies[5].fen.split(" ")[0]).toBe(s.fen.split(" ")[0]);
  });
  it("replays castling, captures, checks and promotion", () => {
    const s = play(["a7a8q", "e7d6"], "8/P3k3/8/8/8/8/8/4K3 w - - 0 1");
    expect(s.sans).toEqual(["a8=Q", "Kd6"]);
    expect(replay(s.sans, startFenFromKey(s.keys[0])!, s.fen)).not.toBeNull();
  });
  it("is null when the list doesn't reach the position (no review offered)", () => {
    const s = play(["e2e4"]);
    expect(replay(["e4", "Nf6??"], START_FEN)).toBeNull();
    expect(replay(s.sans, START_FEN, initialMatch().fen)).toBeNull();
  });
});

describe("captured pieces and material", () => {
  it("nothing taken at the start", () => {
    expect(capturedPieces(START_FEN)).toEqual({ byWhite: [], byBlack: [], diff: 0 });
  });
  it("lists what each side took, lowest value first, and who is ahead", () => {
    // white is missing a pawn; black is missing a knight and a pawn
    const c = capturedPieces("r1bqkbnr/ppp2ppp/8/8/8/8/PPP1PPPP/RNBQKBNR w KQkq - 0 4");
    expect(c.byWhite).toEqual(["p", "p", "n"]);
    expect(c.byBlack).toEqual(["p"]);
    expect(c.diff).toBe(4);
  });
  it("a promoted pawn is not a capture, and the new queen counts in the lead", () => {
    const c = capturedPieces("Q7/4k3/8/8/8/8/1PPPPPPP/RNBQKBNR b KQ - 0 1");
    expect(c.byBlack).toEqual([]);
    expect(c.diff).toBe(47);
  });
});
