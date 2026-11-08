// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { afterLoadIdle } from "./idle";

describe("afterLoadIdle (R3-03)", () => {
  let state: DocumentReadyState = "loading";
  beforeEach(() => {
    vi.useFakeTimers();
    state = "loading";
    vi.spyOn(document, "readyState", "get").mockImplementation(() => state);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
  });

  const watch = (p: Promise<void>) => {
    let done = false;
    void p.then(() => (done = true));
    return () => done;
  };

  it("waits for the load event, then an idle moment", async () => {
    const idle: (() => void)[] = [];
    (window as { requestIdleCallback?: unknown }).requestIdleCallback = (cb: () => void) => idle.push(cb);
    const done = watch(afterLoadIdle());
    await vi.advanceTimersByTimeAsync(10_000);
    expect(done()).toBe(false);
    expect(idle).toHaveLength(0);
    state = "complete";
    window.dispatchEvent(new Event("load"));
    expect(idle).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(done()).toBe(false);
    idle[0]();
    await vi.advanceTimersByTimeAsync(0);
    expect(done()).toBe(true);
  });

  it("an already loaded page only waits for idle (a timer where requestIdleCallback is missing)", async () => {
    state = "complete";
    const done = watch(afterLoadIdle(4000));
    await vi.advanceTimersByTimeAsync(1000);
    expect(done()).toBe(false);
    await vi.advanceTimersByTimeAsync(600);
    expect(done()).toBe(true);
  });

  it("passes the timeout to requestIdleCallback so a busy page still gets there", () => {
    state = "complete";
    const ric = vi.fn();
    (window as { requestIdleCallback?: unknown }).requestIdleCallback = ric;
    void afterLoadIdle(2500);
    expect(ric).toHaveBeenCalledWith(expect.any(Function), { timeout: 2500 });
  });
});
