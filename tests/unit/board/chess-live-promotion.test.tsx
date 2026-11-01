// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveBoard } from "@/components/multiplayer/bay/boards";
import chessRules, { initialMatch } from "@/games/chess/rules";

afterEach(cleanup);

describe("Live chess board (vs bot)", () => {
  const state = initialMatch("8/P3k3/8/8/8/8/8/4K3 w - - 0 1");
  const setup = (coords = true) => {
    const onMove = vi.fn();
    render(
      <LiveBoard
        game="chess"
        state={state}
        seat={0}
        legal={chessRules.legalMoves(state, 0)}
        disabled={false}
        lastMove={null}
        onMove={onMove}
        announce={() => {}}
        coords={coords}
      />,
    );
    return onMove;
  };
  const square = (name: string) => screen.getByRole("gridcell", { name: new RegExp(`^${name}\\b`) });

  it("lets the player choose the promotion piece", () => {
    const onMove = setup();
    fireEvent.click(square("a7"));
    fireEvent.click(square("a8"));
    expect(onMove).not.toHaveBeenCalled();
    const group = screen.getByRole("group", { name: "Promote to" });
    expect(group.querySelectorAll("button")).toHaveLength(4);
    fireEvent.click(screen.getByRole("button", { name: "Promote to knight" }));
    expect(onMove).toHaveBeenCalledWith("a7a8n");
    expect(screen.queryByRole("group", { name: "Promote to" })).toBeNull();
  });

  it("tapping the board instead puts the pawn back", () => {
    const onMove = setup();
    fireEvent.click(square("a7"));
    fireEvent.click(square("a8"));
    fireEvent.click(square("d4"));
    expect(screen.queryByRole("group", { name: "Promote to" })).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it("shows file and rank labels only when asked", () => {
    setup(true);
    expect(square("a1").textContent).toContain("1");
    expect(square("a1").textContent).toContain("a");
    expect(square("a8").textContent).toBe("8");
    expect(square("h1").textContent).toBe("h");
    expect(square("h8").textContent).toBe("");
    cleanup();
    setup(false);
    expect(square("a1").textContent).toBe("");
  });
});
