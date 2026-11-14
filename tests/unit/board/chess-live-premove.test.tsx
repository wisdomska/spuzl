// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveBoard, type LiveBoardProps } from "@/components/multiplayer/bay/boards";
import chessRules, { initialMatch, type ChessMatch } from "@/games/chess/rules";
import { createRng } from "@/lib/rng";

const rng = createRng("premove");

afterEach(cleanup);

/** The board as the player (white, seat 0) sees it; `apply` plays moves for both sides through the rules. */
const apply = (s: ChessMatch, ...moves: string[]) => moves.reduce((x, m) => chessRules.apply(x, chessRules.turn(x), m, rng), s);

function setup(start: ChessMatch, extra: Partial<LiveBoardProps> = {}) {
  const onMove = vi.fn();
  const note = vi.fn();
  const announce = vi.fn();
  const props = (s: ChessMatch): LiveBoardProps => ({
    game: "chess",
    state: s,
    seat: 0,
    legal: chessRules.turn(s) === 0 ? chessRules.legalMoves(s, 0) : [],
    disabled: chessRules.turn(s) !== 0,
    lastMove: null,
    onMove,
    announce,
    note,
    premoves: true,
    ...extra,
  });
  const view = render(<LiveBoard {...props(start)} />);
  const rerender = (s: ChessMatch) => act(() => view.rerender(<LiveBoard {...props(s)} />));
  return { onMove, note, announce, rerender };
}
const square = (name: string) => screen.getByRole("gridcell", { name: new RegExp(`^${name}\\b`) });

describe("Live chess board: premoves", () => {
  const afterE4 = apply(initialMatch(), "e2e4"); // black to move: white may premove

  it("queues a premove on the other side's turn and plays it the moment the turn comes", () => {
    const { onMove, rerender } = setup(afterE4);
    fireEvent.click(square("g1"));
    fireEvent.click(square("f3"));
    // not sent: it is black's turn
    expect(onMove).not.toHaveBeenCalled();
    expect(square("g1").getAttribute("aria-label")).toContain("premove g1 to f3 queued");
    expect(square("f3").getAttribute("aria-label")).toContain("premove g1 to f3 queued");
    // the knight is drawn on its planned square
    expect(square("f3").getAttribute("aria-label")).toContain("white knight");
    rerender(apply(afterE4, "e7e5"));
    expect(onMove).toHaveBeenCalledTimes(1);
    expect(onMove).toHaveBeenCalledWith("g1f3");
  });

  it("keeps up to three in order, playing one per turn", () => {
    const { onMove, rerender } = setup(afterE4);
    for (const [a, b] of [
      ["g1", "f3"],
      ["f1", "c4"],
      ["d2", "d3"],
      ["b1", "c3"],
    ]) {
      fireEvent.click(square(a));
      fireEvent.click(square(b));
    }
    expect(screen.getByRole("grid").getAttribute("aria-label")).toMatch(/g1 to f3.*f1 to c4.*d2 to d3/);
    expect(screen.getByRole("grid").getAttribute("aria-label")).not.toContain("b1 to c3");
    const s1 = apply(afterE4, "e7e5");
    rerender(s1);
    expect(onMove).toHaveBeenLastCalledWith("g1f3");
    const s2 = apply(s1, "g1f3", "b8c6");
    rerender(s2);
    expect(onMove).toHaveBeenLastCalledWith("f1c4");
    expect(onMove).toHaveBeenCalledTimes(2);
  });

  it("drops the premove quietly when the reply makes it illegal", () => {
    const { onMove, note, rerender } = setup(afterE4);
    fireEvent.click(square("e4"));
    fireEvent.click(square("e5"));
    rerender(apply(afterE4, "e7e5")); // e5 is now blocked
    expect(onMove).not.toHaveBeenCalled();
    expect(note).toHaveBeenCalledWith("Premove dropped: it isn't legal now.");
    expect(square("e5").getAttribute("aria-label")).not.toContain("premove");
  });

  it("an empty square, the same piece again, or Escape clears every premove", () => {
    const { onMove, rerender } = setup(afterE4);
    const queue = () => {
      fireEvent.click(square("g1"));
      fireEvent.click(square("f3"));
      expect(square("f3").getAttribute("aria-label")).toContain("premove");
    };
    queue();
    fireEvent.click(square("a5"));
    expect(square("f3").getAttribute("aria-label")).not.toContain("premove");

    queue();
    fireEvent.click(square("d2"));
    fireEvent.click(square("d2"));
    expect(square("f3").getAttribute("aria-label")).not.toContain("premove");

    queue();
    fireEvent.keyDown(square("a1"), { key: "Escape" });
    expect(square("f3").getAttribute("aria-label")).not.toContain("premove");

    rerender(apply(afterE4, "e7e5"));
    expect(onMove).not.toHaveBeenCalled();
  });

  it("a promotion premove auto-queens", () => {
    const start = initialMatch("4k3/P7/8/8/8/8/8/4K3 b - - 0 1");
    const { onMove, rerender } = setup(start);
    fireEvent.click(square("a7"));
    fireEvent.click(square("a8"));
    expect(screen.queryByRole("group", { name: "Promote to" })).toBeNull();
    rerender(apply(start, "e8d7"));
    expect(onMove).toHaveBeenCalledWith("a7a8q");
  });

  it("no premoves when the board doesn't offer them (the game is over, or a spectator)", () => {
    const { onMove } = setup(afterE4, { premoves: false });
    fireEvent.click(square("g1"));
    fireEvent.click(square("f3"));
    expect(square("f3").getAttribute("aria-label")).not.toContain("premove");
    expect(onMove).not.toHaveBeenCalled();
  });
});

describe("Live chess board: move list and review", () => {
  it("shows the moves in standard notation, steps back without changing the game, and returns", () => {
    const s = apply(initialMatch(), "e2e4", "e7e5", "g1f3");
    const { onMove } = setup(s);
    const moves = screen.getByRole("group", { name: "Moves" });
    expect(moves.textContent).toContain("1.e4e5");
    expect(moves.textContent).toContain("2.Nf3");
    expect(moves.querySelector("[aria-current]")?.textContent).toBe("Nf3");
    // ← steps back: the knight is home again on the board shown
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(square("g1").getAttribute("aria-label")).toContain("white knight");
    expect(moves.querySelector("[aria-current]")?.textContent).toBe("e5");
    // a tap on the board goes back to the game instead of moving
    fireEvent.click(square("b8"));
    expect(square("f3").getAttribute("aria-label")).toContain("white knight");
    expect(onMove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Previous move" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to the game" }));
    expect(square("f3").getAttribute("aria-label")).toContain("white knight");
  });

  it("Flip turns the board round", () => {
    setup(initialMatch());
    const first = () => screen.getAllByRole("gridcell")[0].getAttribute("aria-label");
    expect(first()).toMatch(/^a8/);
    fireEvent.click(screen.getByRole("button", { name: "Flip board" }));
    expect(first()).toMatch(/^h1/);
  });
});
