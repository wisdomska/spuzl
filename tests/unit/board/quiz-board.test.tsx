// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardApi, ControlSpec } from "@/games/types";
import { localJudge, QuizBoard, type QuizAnswer, type QuizJudge, type QuizRound, type QuizVerdict } from "@/games/_shared/QuizBoard";
import { quick } from "@/lib/copy/quick";

vi.mock("@/lib/audio", () => ({ play: vi.fn() }));

type St = { answers: QuizAnswer[] };
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
const judge0 = () => localJudge([0, 0, 0], 15000);
/** Lets pending promises (the judge's replies) settle under fake timers. */
const flush = () => act(async () => {});
const option = (letter: string) => screen.getAllByRole("button").find((b) => b.getAttribute("aria-label")?.startsWith(`${letter}, `))!;

/** A judge the test answers by hand: each call waits until resolved or failed. */
function manualJudge() {
  const calls: {
    kind: "open" | "answer";
    q: number;
    pick?: number | null;
    ms?: number;
    ok: (v: unknown) => void;
    fail: (e: unknown) => void;
  }[] = [];
  const judge: QuizJudge = {
    open: (q) => new Promise((ok, fail) => calls.push({ kind: "open", q, ok: ok as (v: unknown) => void, fail })),
    answer: (q, pick, ms) => new Promise((ok, fail) => calls.push({ kind: "answer", q, pick, ms, ok: ok as (v: unknown) => void, fail })),
  };
  return { judge, calls };
}

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
    render(<QuizBoard rounds={rounds} judge={judge0()} limitMs={15000} noun="Question" mode="free" api={api} />);
    expect(api.start).not.toHaveBeenCalled();
    act(() => go(api).onPress());
    expect(api.start).toHaveBeenCalledTimes(1);
    expect(api.onMove).not.toHaveBeenCalled();
  });

  it("a run resumed from autosave reports its earlier wrong answers to the shell", () => {
    const api = mockApi();
    const initial = [
      { pick: 0, ms: 4000, right: true, answer: 0 },
      { pick: 3, ms: 5000, right: false, answer: 0 },
    ];
    render(<QuizBoard rounds={rounds} judge={judge0()} limitMs={15000} noun="Question" mode="free" initial={initial} api={api} />);
    expect(api.restoreMistakes).toHaveBeenCalledWith(1);
  });

  it("a fresh run reports no restored slips", () => {
    const api = mockApi();
    render(<QuizBoard rounds={rounds} judge={judge0()} limitMs={15000} noun="Question" mode="free" api={api} />);
    expect(api.restoreMistakes).not.toHaveBeenCalled();
  });
});

describe("QuizBoard with a server judge", () => {
  const verdict = (v: Partial<QuizVerdict>): QuizVerdict => ({ pick: 1, ms: 2000, right: false, answer: 2, ...v });

  it("opens each question, marks the pick at once and shows the judge's verdict", async () => {
    const api = mockApi();
    const { judge, calls } = manualJudge();
    render(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} />);
    act(() => go(api).onPress());
    expect(calls).toMatchObject([{ kind: "open", q: 0 }]);
    await act(async () => calls[0].ok({ leftMs: 15000 }));
    act(() => vi.advanceTimersByTime(2000));
    fireEvent.click(option("B"));
    await flush();
    // Marked as the pick, waiting for the judge; nothing is right or wrong yet.
    expect(option("B").getAttribute("aria-label")).toContain(quick.quiz.yourAnswerChecking);
    expect(api.onMove).not.toHaveBeenCalled();
    expect(calls[1]).toMatchObject({ kind: "answer", q: 0, pick: 1, ms: 2000 });
    await act(async () => calls[1].ok(verdict({ ms: 2100 })));
    expect(api.ruleBreak).toHaveBeenCalledWith(quick.quiz.wrong("c"));
    // The board keeps the judge's time, so the final state matches the server's record.
    expect(api.onMove).toHaveBeenLastCalledWith({ answers: [{ pick: 1, ms: 2100, right: false, answer: 2 }] }, { mistake: true });
    expect(option("C").getAttribute("aria-label")).toContain(quick.quiz.rightAnswer);
  });

  it("keeps the answer when the judge can't be reached, and Try again sends it", async () => {
    const api = mockApi();
    const { judge, calls } = manualJudge();
    render(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} />);
    act(() => go(api).onPress());
    await act(async () => calls[0].ok({ leftMs: 15000 }));
    act(() => vi.advanceTimersByTime(1000));
    fireEvent.click(option("A"));
    await flush();
    // Two quick retries, then the player is told and offered Try again.
    for (let k = 0; k < 3; k++) {
      await act(async () => calls.at(-1)!.fail(new Error("offline")));
      act(() => vi.advanceTimersByTime(1000));
      await flush();
    }
    expect(calls.filter((c) => c.kind === "answer")).toHaveLength(3);
    expect(api.feedback).toHaveBeenCalledWith(quick.quiz.offline, "danger", "wifi-slash");
    expect(go(api)).toMatchObject({ label: quick.quiz.retry, disabled: false });
    act(() => go(api).onPress());
    await flush();
    const again = calls.at(-1)!;
    expect(again).toMatchObject({ kind: "answer", q: 0, pick: 0, ms: 1000 });
    await act(async () => again.ok(verdict({ pick: 0, ms: 1000, right: true, answer: 0 })));
    expect(api.onMove).toHaveBeenLastCalledWith({ answers: [{ pick: 0, ms: 1000, right: true, answer: 0 }] }, { correctStreak: 1 });
  });

  it("an answer the judge says came too late counts as a timeout", async () => {
    const api = mockApi();
    const { judge, calls } = manualJudge();
    render(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} />);
    act(() => go(api).onPress());
    await act(async () => calls[0].ok({ leftMs: 15000 }));
    act(() => vi.advanceTimersByTime(14000));
    fireEvent.click(option("D"));
    await flush();
    await act(async () => calls[1].ok(verdict({ pick: null, ms: 15000, answer: 3, late: true })));
    expect(api.feedback).toHaveBeenCalledWith(quick.quiz.late("d"), "danger", "timer");
    expect(api.onMove).toHaveBeenLastCalledWith({ answers: [{ pick: null, ms: 15000, right: false, answer: 3 }] }, { mistake: true });
  });

  it("the judge's window wins: less time left shortens the bar, and the timeout is sent", async () => {
    const api = mockApi();
    const { judge, calls } = manualJudge();
    render(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} />);
    act(() => go(api).onPress());
    await act(async () => calls[0].ok({ leftMs: 4000 }));
    act(() => vi.advanceTimersByTime(4100));
    await flush();
    expect(calls[1]).toMatchObject({ kind: "answer", q: 0, pick: null, ms: 15000 });
  });

  it("a question the judge already answered (a resumed run) catches up from the open", async () => {
    const api = mockApi();
    const { judge, calls } = manualJudge();
    render(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} />);
    act(() => go(api).onPress());
    await act(async () => calls[0].ok({ leftMs: 0, verdict: verdict({ pick: 2, ms: 3000, right: true, answer: 2 }) }));
    expect(api.onMove).toHaveBeenLastCalledWith({ answers: [{ pick: 2, ms: 3000, right: true, answer: 2 }] }, { correctStreak: 1 });
    expect(calls.filter((c) => c.kind === "answer")).toHaveLength(0);
  });

  it("the question clock keeps running through a pause", async () => {
    const api = mockApi();
    const { judge, calls } = manualJudge();
    const { rerender } = render(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} />);
    act(() => go(api).onPress());
    await act(async () => calls[0].ok({ leftMs: 15000 }));
    rerender(<QuizBoard rounds={rounds} judge={judge} limitMs={15000} noun="Question" mode="free" api={api} disabled />);
    act(() => vi.advanceTimersByTime(15100));
    await flush();
    expect(calls[1]).toMatchObject({ kind: "answer", q: 0, pick: null });
  });
});
