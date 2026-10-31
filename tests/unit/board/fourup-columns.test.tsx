// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardApi } from "@/games/types";
import FourUpBoard from "@/games/fourup/Board";
import { generate as generateFourUp } from "@/games/fourup/logic";
import { COLS, dropRow } from "@/games/fourup/engine";
import { createRng } from "@/lib/rng";

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

describe("Four Up columns (SPZ-09)", () => {
  const { puzzle } = generateFourUp(createRng("spz-09"), "easy");

  it("renders one full-height button per column with a ghost disc where it would land", () => {
    render(<FourUpBoard puzzle={puzzle} mode="free" api={mockApi()} />);
    const buttons = screen.getAllByRole("button", { name: /^Column \d\./ });
    expect(buttons).toHaveLength(COLS);
    const c = [...Array(COLS).keys()].find((k) => dropRow(puzzle.grid, k) >= 0)!;
    const btn = buttons[c];
    expect(btn.querySelector("[data-ghost]")).toBeNull();
    fireEvent.focus(btn);
    const ghost = btn.querySelector("[data-ghost]");
    expect(ghost?.parentElement?.getAttribute("data-i")).toBe(String(dropRow(puzzle.grid, c) * COLS + c));
    fireEvent.blur(btn);
    expect(btn.querySelector("[data-ghost]")).toBeNull();
    fireEvent.pointerDown(btn);
    expect(btn.querySelector("[data-ghost]")).not.toBeNull();
  });
});
