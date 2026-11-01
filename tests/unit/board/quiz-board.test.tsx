// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardApi, ControlSpec } from "@/games/types";
import { QuizBoard, type QuizRound } from "@/games/_shared/QuizBoard";
import type { TimedAnswer } from "@/games/_shared/cluecave";

vi.mock("@/lib/audio", () => ({ play: vi.fn() }));

type St = { answers: TimedAnswer[] };
const mockApi = () => ({
  onMove: vi.fn<BoardApi<St>["onMove"]>(),
  onSolved: vi.fn(),
  feedback: vi.fn(),
  ruleBreak: vi.fn(),
  announce: vi.fn(),
  setControls: vi.fn<(c: ControlSpec[]) => void>(),
  start: vi.fn(),
  restoreMistakes: vi.fn(),
});
const rounds: QuizRound[] = [0, 1, 2].map((n) => ({ prompt: `Q${n}`, say: `Q${n}`, choices: ["a", "b", "c", "d"] }));
const go = (api: ReturnType<typeof mockApi>) => api.setControls.mock.lastCall![0].find((c) => c.id === "go")!;

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom has no Web Animations API; the drain bar only needs a handle.
  Element.prototype.animate = vi.fn(() => ({ play: vi.fn(), pause: vi.fn(), cancel: vi.fn() }) as unknown as Animation);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QuizBoard start and resume", () => {
  it("starts the shell clock when Start is pressed, before any answer", () => {
    const api = mockApi();
    render(<QuizBoard rounds={rounds} correct={[0, 0, 0]} limitMs={15000} noun="Question" mode="free" api={api} />);
    expect(api.start).not.toHaveBeenCalled();
    act(() => go(api).onPress());
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.onMove).not.toHaveBeenCalled();
  });

  it("a run resumed from autosave reports its earlier wrong answers to the shell", () => {
    const api = mockApi();
    const initial = [
      { pick: 0, ms: 4000 },
      { pick: 3, ms: 5000 },
    ];
    render(<QuizBoard rounds={rounds} correct={[0, 0, 0]} limitMs={15000} noun="Question" mode="free" initial={initial} api={api} />);
    expect(api.restoreMistakes).toHaveBeenCalledWith(1);
  });

  it("a fresh run reports no restored slips", () => {
    const api = mockApi();
    render(<QuizBoard rounds={rounds} correct={[0, 0, 0]} limitMs={15000} noun="Question" mode="free" api={api} />);
    expect(api.restoreMistakes).not.toHaveBeenCalled();
  });
});
