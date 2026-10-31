// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardApi } from "@/games/types";
import DuskBoard from "@/games/dusk/Board";
import { EMPTY, MOON, SUN, type DuskPuzzle, type DuskState } from "@/games/dusk/logic";
import { SETTLE_MS } from "@/games/dusk/input";

vi.mock("@/lib/audio", () => ({ play: vi.fn() }));

const mockApi = <St,>() => ({
  onMove: vi.fn<BoardApi<St>["onMove"]>(),
  onSolved: vi.fn(),
  feedback: vi.fn(),
  ruleBreak: vi.fn(),
  announce: vi.fn(),
  setControls: vi.fn(),
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Dusk input (SPZ-08)", () => {
  // Row 1 starts with two given suns, so a sun in column 3 would make three in a row.
  const givens = new Array(36).fill(EMPTY);
  givens[0] = givens[1] = SUN;
  const puzzle: DuskPuzzle = { size: 6, givens, links: [{ a: 2, b: 3, same: true }] };
  const cell = (r: number, c: number) => screen.getByRole("gridcell", { name: new RegExp(`^Row ${r}, column ${c},`) });

  it("a double-tap places a moon without counting the transient sun as a slip", () => {
    const api = mockApi<DuskState>();
    render(<DuskBoard puzzle={puzzle} mode="free" api={api} />);
    fireEvent.click(cell(1, 3));
    fireEvent.click(cell(1, 3));
    act(() => vi.advanceTimersByTime(SETTLE_MS + 10));
    expect(api.ruleBreak).not.toHaveBeenCalled();
    expect(api.onMove).toHaveBeenCalledTimes(1);
    const [state, info] = api.onMove.mock.calls[0];
    expect(state[2]).toBe(MOON);
    expect(info?.mistake).toBe(false);
  });

  it("a single tap that settles into a real break counts once, after the settle", () => {
    const api = mockApi<DuskState>();
    render(<DuskBoard puzzle={puzzle} mode="free" api={api} />);
    fireEvent.click(cell(1, 3));
    expect(api.ruleBreak).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(SETTLE_MS + 10));
    expect(api.ruleBreak).toHaveBeenCalledTimes(1);
    expect(api.onMove.mock.calls[0][1]?.mistake).toBe(true);
  });

  it("reads = and × constraints in the cell labels", () => {
    render(<DuskBoard puzzle={puzzle} mode="free" api={mockApi<DuskState>()} />);
    expect(cell(1, 3).getAttribute("aria-label")).toBe("Row 1, column 3, empty, equals the cell to the right");
    expect(cell(1, 4).getAttribute("aria-label")).toBe("Row 1, column 4, empty, equals the cell to the left");
  });
});
