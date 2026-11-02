// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeave } from "@/components/game/useLeave";
import { leavePolicy, type LeaveInput } from "@/lib/game/leave";

type Api = ReturnType<typeof useLeave>;

/** Hands each render's hook result to the test. */
function Harness({
  input,
  exit,
  forfeit,
  onApi,
}: {
  input: LeaveInput;
  exit: () => void;
  forfeit?: () => Promise<unknown>;
  onApi: (api: Api) => void;
}) {
  onApi(useLeave({ policy: leavePolicy(input), exit, forfeit }));
  return null;
}

function setup(input: LeaveInput) {
  const exit = vi.fn();
  const forfeit = vi.fn(async () => ({ ok: true }));
  const out: { api?: Api } = {};
  const view = render(<Harness input={input} exit={exit} forfeit={forfeit} onApi={(a) => (out.api = a)} />);
  return { exit, forfeit, out, view };
}

/** jsdom's history fires no popstate on back(): do the traversal by hand. */
function goBack() {
  act(() => {
    window.history.replaceState(null, "");
    window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
  });
}

beforeEach(() => {
  window.history.replaceState(null, "", "/play/quickfire");
});
afterEach(async () => {
  cleanup();
  // Let an unmounted guard's clean-up (a 0 ms timer) run before the next test watches history.
  await new Promise((r) => setTimeout(r, 0));
  vi.restoreAllMocks();
});

describe("useLeave", () => {
  it("solo play: Back leaves at once, no history entry, no server call", async () => {
    const push = vi.spyOn(window.history, "pushState");
    const { exit, forfeit, out } = setup({ context: "solo", game: "crownfall", started: true });
    expect(push).not.toHaveBeenCalled();
    await act(async () => out.api!.request());
    expect(exit).toHaveBeenCalledTimes(1);
    expect(forfeit).not.toHaveBeenCalled();
    expect(out.api!.asking).toBe(false);
  });

  it("a timed run asks first; Keep playing stays, Leave exits without a forfeit call", async () => {
    const { exit, forfeit, out } = setup({ context: "solo", game: "quickfire", started: true });
    act(() => out.api!.request());
    expect(out.api!.asking).toBe(true);
    act(() => out.api!.keep());
    expect(out.api!.asking).toBe(false);
    expect(exit).not.toHaveBeenCalled();

    act(() => out.api!.request());
    const back = vi.spyOn(window.history, "back").mockImplementation(() => goBack());
    await act(async () => out.api!.confirm());
    // The guard entry comes off first, then the exit runs.
    expect(back).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(forfeit).not.toHaveBeenCalled();
  });

  it("guards the back gesture with one entry: the first back asks, a second back leaves and tells the server", () => {
    const push = vi.spyOn(window.history, "pushState");
    const { exit, forfeit, out } = setup({ context: "duel" });
    expect(push).toHaveBeenCalledTimes(1);
    expect((window.history.state as Record<string, unknown>).spuzlLeaveGuard).toBe(true);

    goBack();
    expect(out.api!.asking).toBe(true);
    expect(exit).not.toHaveBeenCalled();

    goBack();
    expect(forfeit).toHaveBeenCalledTimes(1);
    expect(forfeit).toHaveBeenCalledWith({ keepalive: true });
  });

  it("Keep playing after a back gesture puts the guard back", () => {
    const push = vi.spyOn(window.history, "pushState");
    const { out } = setup({ context: "party" });
    goBack();
    act(() => out.api!.keep());
    expect(push).toHaveBeenCalledTimes(2);
    expect((window.history.state as Record<string, unknown>).spuzlLeaveGuard).toBe(true);
  });

  it("a live match: Leave calls the leave endpoint before exiting", async () => {
    vi.spyOn(window.history, "back").mockImplementation(() => goBack());
    const { exit, forfeit, out } = setup({ context: "bay-live" });
    act(() => out.api!.request());
    await act(async () => out.api!.confirm());
    expect(forfeit).toHaveBeenCalledWith({ keepalive: false });
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("Escape asks to leave when no dialog or menu is open, and is left alone otherwise", () => {
    const { out } = setup({ context: "duel" });
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(out.api!.asking).toBe(false);
    dialog.remove();
    act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(out.api!.asking).toBe(true);
  });

  it("takes the guard off again when the run ends, so Back is never swallowed", async () => {
    vi.useFakeTimers();
    try {
      const back = vi.spyOn(window.history, "back").mockImplementation(() => {});
      const exit = vi.fn();
      const out: { api?: Api } = {};
      const view = render(<Harness input={{ context: "solo", game: "echo", started: true }} exit={exit} onApi={(a) => (out.api = a)} />);
      view.rerender(
        <Harness input={{ context: "solo", game: "echo", started: true, over: true }} exit={exit} onApi={(a) => (out.api = a)} />,
      );
      await act(async () => void vi.runAllTimers());
      expect(back).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
