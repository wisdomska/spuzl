// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetQuiet, markBoardReady, markPlayTap, whenQuiet } from "./quiet";

/** performance.now() and timers move together under fake timers. */
describe("whenQuiet (R2-01)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "Date"] });
    __resetQuiet();
    window.history.replaceState(null, "", "/");
  });
  afterEach(() => vi.useRealTimers());

  const settled = async (p: Promise<void>) => {
    let done = false;
    void p.then(() => (done = true));
    await vi.advanceTimersByTimeAsync(0);
    return () => done;
  };

  it("off the Play screen: waits for the page to have been up a few seconds", async () => {
    const done = await settled(whenQuiet());
    await vi.advanceTimersByTimeAsync(2000);
    expect(done()).toBe(false);
    await vi.advanceTimersByTimeAsync(3000);
    expect(done()).toBe(true);
  });

  it("after a Play tap: waits for that board, then a short pause", async () => {
    await vi.advanceTimersByTimeAsync(5000); // Home has been up a while
    markPlayTap();
    window.history.replaceState(null, "", "/play/crownfall");
    const done = await settled(whenQuiet());
    await vi.advanceTimersByTimeAsync(6000);
    expect(done()).toBe(false); // the board isn't ready yet: nothing downloads
    markBoardReady();
    await vi.advanceTimersByTimeAsync(500);
    expect(done()).toBe(false);
    await vi.advanceTimersByTimeAsync(2500);
    expect(done()).toBe(true);
  });

  it("never waits forever for a board that never comes", async () => {
    markPlayTap();
    window.history.replaceState(null, "", "/play/quickfire");
    const done = await settled(whenQuiet());
    await vi.advanceTimersByTimeAsync(16_500);
    expect(done()).toBe(true);
  });
});
