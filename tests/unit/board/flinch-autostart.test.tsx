// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardApi } from "@/games/types";
import FlinchBoard from "@/games/flinch/Board";
import { DEFAULTS } from "@/lib/game-settings/schema";

vi.mock("@/lib/audio", () => ({ play: vi.fn() }));
vi.mock("@/lib/game-settings/client", () => ({ useGameSettings: () => DEFAULTS }));

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

describe("Flinch (SPZ-24)", () => {
  const puzzle = { delays: [2000, 2000, 2000], window: 1000 };
  const pad = () => screen.getByRole("button", { name: /\./ });

  it("shows Tap! (not only a colour change) and auto-starts the next round after the setting", () => {
    const api = mockApi();
    render(<FlinchBoard puzzle={puzzle} mode="free" api={api} />);
    fireEvent.pointerDown(pad());
    expect(pad().getAttribute("aria-label")).toMatch(/^Wait\./);
    act(() => vi.advanceTimersByTime(2000));
    expect(pad().getAttribute("aria-label")).toMatch(/^Tap!\./);
    expect(pad().textContent).toContain("Tap!");
    act(() => vi.advanceTimersByTime(250));
    fireEvent.pointerDown(pad());
    expect(pad().getAttribute("data-phase")).toBe("result");
    act(() => vi.advanceTimersByTime(DEFAULTS["flinch.autoStartMs"] - 10));
    expect(pad().getAttribute("data-phase")).toBe("result");
    act(() => vi.advanceTimersByTime(20));
    expect(pad().getAttribute("data-phase")).toBe("armed");
  });

  it("a tap skips the wait", () => {
    render(<FlinchBoard puzzle={puzzle} mode="free" api={mockApi()} />);
    fireEvent.pointerDown(pad());
    act(() => vi.advanceTimersByTime(2250));
    fireEvent.pointerDown(pad());
    act(() => vi.advanceTimersByTime(700));
    fireEvent.pointerDown(pad());
    expect(pad().getAttribute("data-phase")).toBe("armed");
  });
});
